import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GatewayState,
  RouteMetrics,
  Finding,
  Report,
  VerificationResult,
  CitationDetail
} from './types';
import {
  fetchState,
  fetchMetrics,
  fetchFindings,
  startScenario,
  resetScenario,
  startInvestigation,
  subscribeInvestigation,
  resolveCitation
} from './lib/api';
import { Header } from './components/Header';
import { AppSidebar, MainViewTab } from './components/AppSidebar';
import { MetricsChart } from './components/MetricsChart';
import { ApiMetricsTable } from './components/ApiMetricsTable';
import { IncidentAnalysisPipelineTimeline } from './components/IncidentAnalysisPipelineTimeline';
import { FindingsRail } from './components/FindingsRail';
import { InvestigationFeed } from './components/InvestigationFeed';
import { AttackPathGraph } from './components/AttackPathGraph';
import { BlastRadiusGraph } from './components/BlastRadiusGraph';
import { MitigationView } from './components/MitigationView';
import { CulpritCodeSnippetCard } from './components/CulpritCodeSnippetCard';
import { RollbackControlCard } from './components/RollbackControlCard';
import { PitchRcaView } from './components/PitchRcaView';
import { IncidentStepper, IncidentStep } from './components/IncidentStepper';
import { ReportExportModal } from './components/ReportExportModal';
import { CitationDrawer } from './components/CitationDrawer';
import {
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Cpu,
  CheckCircle2,
  Sparkles,
  Zap,
  RotateCcw,
  Shield,
  FileCode,
  Layers,
  ChevronDown
} from 'lucide-react';
import { cn } from './lib/utils';

export function App() {
  const [currentTab, setCurrentTab] = useState<MainViewTab>('overview');
  const [state, setState] = useState<GatewayState | null>(null);
  const [metrics, setMetrics] = useState<Record<string, RouteMetrics> | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [events, setEvents] = useState<Array<{ type: string; data: any }>>([]);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [markerText, setMarkerText] = useState<string | undefined>(undefined);
  const [selectedCitation, setSelectedCitation] = useState<CitationDetail | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<IncidentStep>('telemetry');

  const rcaRef = useRef<HTMLDivElement>(null);

  // Initial load and periodic polling
  const loadInitialData = useCallback(async () => {
    try {
      const [s, m, f] = await Promise.all([
        fetchState().catch(() => null),
        fetchMetrics().catch(() => null),
        fetchFindings().catch(() => [])
      ]);
      if (s) setState(s);
      if (m) setMetrics(m);
      if (f) setFindings(f);
      if (s?.active_scenario) setActiveScenario(s.active_scenario);
    } catch (err) {
      console.warn('Backend connecting or offline, will retry', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(async () => {
      try {
        const [s, m] = await Promise.all([
          fetchState().catch(() => null),
          fetchMetrics().catch(() => null)
        ]);
        if (s) setState(s);
        if (m) setMetrics(m);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [loadInitialData]);

  const handleSelectScenario = async (scenario: 'a_exploit' | 'b_regression') => {
    try {
      setActiveScenario(scenario);
      setEvents([]);
      setReport(null);
      setVerification(null);
      setMarkerText(scenario === 'a_exploit' ? 'Exploit Injected into Docker Container' : '100% Shift to 1.5.0');
      setCurrentStep('telemetry');
      await startScenario(scenario);
      await loadInitialData();
    } catch (err: any) {
      setErrorBanner(`Failed to trigger scenario: ${err.message}`);
    }
  };

  const handleReset = async () => {
    try {
      setActiveScenario(null);
      setReport(null);
      setVerification(null);
      setEvents([]);
      setMarkerText(undefined);
      setCurrentStep('telemetry');
      await resetScenario();
      await loadInitialData();
    } catch (err: any) {
      setErrorBanner(`Failed to reset: ${err.message}`);
    }
  };

  const handleInvestigate = async () => {
    setIsInvestigating(true);
    setCurrentStep('gemma_rca');
    setEvents([]);
    setReport(null);
    setVerification(null);
    setErrorBanner(null);

    try {
      const { run_id } = await startInvestigation();
      subscribeInvestigation(run_id, {
        onToolCall: (data) => {
          setEvents((prev) => [...prev, { type: 'tool_call', data }]);
        },
        onToolResult: (data) => {
          setEvents((prev) => [...prev, { type: 'tool_result', data }]);
        },
        onReport: (rep) => {
          setReport(rep);
          setCurrentStep('blast_radius');
        },
        onVerification: (ver) => {
          setVerification(ver);
        },
        onDone: () => {
          setIsInvestigating(false);
        },
        onError: (err) => {
          console.error('Investigation stream error', err);
          setIsInvestigating(false);
        }
      });
    } catch (err: any) {
      setErrorBanner(`Failed to start investigation: ${err.message}`);
      setIsInvestigating(false);
    }
  };

  const isDegraded = (metrics?.['/api/orders|all']?.p95_ms || 0) > 800 || (metrics?.['/api/orders|all']?.err_rate || 0) > 0.02 || activeScenario !== null;

  // Autonomous AI Call on Failure Detection with mandatory Console Log
  useEffect(() => {
    if (isDegraded && !report && !isInvestigating) {
      console.log(
        '%c[CULPRIT AUTO-RCA] 🚨 Multi-API Degradation & Blast Radius Cascade Detected!',
        'color: #000000; background: #fef08a; font-weight: bold; font-size: 13px;'
      );
      console.log(
        '%c[CULPRIT AUTO-RCA] Root Cause Endpoint: POST /api/orders (p95 > 1000ms, DB Pool Starvation)',
        'color: #000000; font-weight: bold;'
      );
      console.log(
        '%c[CULPRIT AUTO-RCA] Cascaded Impact: GET /api/products, POST /api/payments experiencing 504 timeouts',
        'color: #71717a;'
      );
      console.log(
        '%c[CULPRIT AUTO-RCA] 🤖 Autonomous AI Invocation: Launching Gemma 4 Tool-Calling Investigation Stream...',
        'color: #18181b; font-weight: bold;'
      );

      const timer = setTimeout(() => {
        handleInvestigate();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isDegraded, report, isInvestigating]);

  const handleSelectCitation = async (citeStr: string) => {
    try {
      const detail = await resolveCitation(citeStr);
      setSelectedCitation(detail);
    } catch (err) {
      console.error('Error resolving citation', err);
    }
  };

  const handleMitigationExecuted = (action: string) => {
    setMarkerText(`Mitigation Applied: ${action}`);
    loadInitialData();
  };

  const handleScrollToRca = () => {
    setCurrentTab('overview');
    if (rcaRef.current) {
      rcaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const mode = state?.mode || 'LIVE';

  return (
    <div className="flex h-screen w-screen bg-white text-zinc-900 overflow-hidden font-sans">
      {/* Clean Left Navigation Sidebar */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        state={state}
        activeScenario={activeScenario}
        onSelectScenario={handleSelectScenario}
        onReset={handleReset}
        onSelectCitation={handleSelectCitation}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAFAFA]">
        {/* Top Minimalist Header */}
        <Header
          mode={mode}
          activeScenario={activeScenario}
          isInvestigating={isInvestigating}
          onInitiateAttack={() => handleSelectScenario('a_exploit')}
          onReset={handleReset}
          onInvestigate={handleInvestigate}
          onExportReport={() => setIsExportOpen(true)}
        />

        {/* High-Contrast Incident Alert Banner */}
        {isDegraded && (
          <div className="bg-black text-white px-6 py-2.5 flex items-center justify-between border-b border-zinc-800 shadow-md shrink-0">
            <div className="flex items-center space-x-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-bold tracking-wide uppercase text-red-400">Incident Alert:</span>
                <span className="text-zinc-200">
                  Whitebox Attack Active — Latency Surge & DB Pool Contention on <code className="font-mono bg-zinc-800 px-1 py-0.5 rounded text-white">/api/orders</code> (Docker container <code className="font-mono bg-zinc-800 px-1 py-0.5 rounded text-white">:8001</code>)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleScrollToRca}
              className="px-3 py-1 bg-white text-black hover:bg-zinc-100 rounded text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <span>View RCA & Gemma Fixes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Notification Banner */}
        {errorBanner && (
          <div className="bg-zinc-100 border-b border-zinc-300 px-6 py-2 flex items-center justify-between text-xs text-zinc-900">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-black" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-zinc-600 hover:text-black font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Main Content */}
        <main className="flex-1 overflow-hidden relative">
          {currentTab === 'overview' && (
            <div className="h-full overflow-y-auto p-6 space-y-8">
              {/* ================= STEP 1: REAL-TIME TELEMETRY ================= */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                      1
                    </span>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Real-Time Gateway Telemetry & Multi-API Health
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">1-second streaming Task-Manager buffer</span>
                </div>

                {/* Telemetry Chart Component */}
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
                  <MetricsChart
                    metrics={metrics}
                    selectedRoute="/api/orders|all"
                    markerText={markerText}
                    onInvestigate={handleInvestigate}
                  />
                </div>

                {/* Multi-API Percentiles & Failure Status Table */}
                <ApiMetricsTable
                  metrics={metrics}
                  onInvestigateRoute={() => handleInvestigate()}
                />
              </section>

              {/* ================= STEP 2: SECURITY & MULTI-VERSION SCANS ================= */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                      2
                    </span>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Security & Multi-Version Scans (SAST, SCA, DAST, WAF)
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {findings.length} Total Findings Across Releases
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                  <FindingsRail
                    findings={findings}
                    findingVerdicts={report?.finding_verdicts}
                    onSelectCitation={handleSelectCitation}
                  />
                </div>
              </section>

              {/* ================= STEP 3: GEMMA 4 RCA & LIVE GIT CODE DIFF ================= */}
              <section ref={rcaRef} id="rca-section" className="space-y-4 scroll-mt-6">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                      3
                    </span>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Gemma 4 Autonomous RCA & Live Git Code Diff
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {report ? `Verdict: ${report.verdict}` : isInvestigating ? 'Gemma Investigating...' : 'Ready'}
                  </span>
                </div>

                {/* End-to-End Investigation Pipeline Progression */}
                <IncidentAnalysisPipelineTimeline
                  isInvestigating={isInvestigating}
                  hasReport={report !== null}
                  onSelectCitation={handleSelectCitation}
                  scenario={activeScenario}
                />

                {/* Live Code Snippet & Unified Git Diff Card */}
                <CulpritCodeSnippetCard
                  scenario={activeScenario}
                  onSelectCitation={handleSelectCitation}
                />
              </section>

              {/* ================= STEP 4: BLAST RADIUS & VERIFIED RECOVERY ================= */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                      4
                    </span>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Blast Radius Containment & 1-Click Code-Verified Recovery
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    Deterministic LKG Safety Preconditions
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 1-Click Rollback Control Card */}
                  <RollbackControlCard
                    state={state}
                    onMitigationExecuted={handleMitigationExecuted}
                  />

                  {/* Mitigation Safe Actions View */}
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                    <MitigationView
                      mitigations={report?.mitigations || []}
                      rejectedOptions={report?.rejected_options || []}
                      state={state}
                      onSelectCitation={handleSelectCitation}
                      onMitigationExecuted={handleMitigationExecuted}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {currentTab === 'investigate' && (
            <InvestigationFeed
              events={events}
              report={report}
              verification={verification}
              isInvestigating={isInvestigating}
              onSelectCitation={handleSelectCitation}
              scenario={activeScenario}
            />
          )}

          {currentTab === 'findings' && (
            <div className="h-full p-4">
              <FindingsRail
                findings={findings}
                findingVerdicts={report?.finding_verdicts}
                onSelectCitation={handleSelectCitation}
              />
            </div>
          )}

          {currentTab === 'attack_path' && (
            <AttackPathGraph
              report={report}
              onSelectCitation={handleSelectCitation}
            />
          )}

          {currentTab === 'blast_radius' && (
            <BlastRadiusGraph
              blastRadius={report?.blast_radius || null}
              onSelectCitation={handleSelectCitation}
            />
          )}

          {currentTab === 'mitigation' && (
            <MitigationView
              mitigations={report?.mitigations || []}
              rejectedOptions={report?.rejected_options || []}
              state={state}
              onSelectCitation={handleSelectCitation}
              onMitigationExecuted={handleMitigationExecuted}
            />
          )}

          {currentTab === 'pitch_rca' && (
            <PitchRcaView
              activeScenario={activeScenario}
              onSelectCitation={handleSelectCitation}
              onTriggerScenario={handleSelectScenario}
            />
          )}
        </main>
      </div>

      {/* Slide-out Citation Code/Log Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />

      {/* Incident & Vulnerability Export Modal */}
      <ReportExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        report={report}
        findings={findings}
        verification={verification}
        state={state}
      />
    </div>
  );
}

export default App;
