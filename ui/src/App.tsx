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
import { MainViewTab } from './components/AppSidebar';
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
  Activity,
  History
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
    }, 2500);
    return () => clearInterval(interval);
  }, [loadInitialData]);

  const handleSelectScenario = async (scenario: 'a_exploit' | 'b_regression') => {
    try {
      setActiveScenario(scenario);
      setEvents([]);
      setReport(null);
      setVerification(null);
      setMarkerText(scenario === 'a_exploit' ? 'Exploit Injected into Docker Container' : '100% Shift to 1.5.0');
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
      await resetScenario();
      await loadInitialData();
    } catch (err: any) {
      setErrorBanner(`Failed to reset: ${err.message}`);
    }
  };

  const handleInvestigate = async () => {
    setIsInvestigating(true);
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
    <div className="flex flex-col h-screen w-screen bg-[#FAFAFA] text-zinc-900 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <Header
        mode={mode}
        activeScenario={activeScenario}
        isInvestigating={isInvestigating}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onInitiateAttack={() => handleSelectScenario('a_exploit')}
        onReset={handleReset}
        onInvestigate={handleInvestigate}
        onExportReport={() => setIsExportOpen(true)}
      />

      {/* Interactive Guided Incident Journey Bar */}
      <div className="bg-white border-b border-zinc-200 px-6 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs shrink-0 select-none">
        <div className="flex items-center space-x-3">
          {/* Phase Pill */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
              WORKFLOW PHASE:
            </span>
            {state?.weights?.green === 100 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-black text-white">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                4. RECOVERED (v1.4.0 LKG Active)
              </span>
            ) : report ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-black text-white">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                3. RCA SYNTHESIZED (CWE-89 SQLi)
              </span>
            ) : isDegraded ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-black text-white">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                2. ATTACK ACTIVE (Pool Starvation)
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                1. SYSTEM NOMINAL (v1.5.0 Current)
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-200 hidden sm:block" />

          {/* Context Guidance Message */}
          <div className="text-xs text-zinc-600 hidden md:block">
            {state?.weights?.green === 100 ? (
              <span>Safe failover verified. Gateway is routing 100% traffic to stable LKG. Latency &lt; 20ms.</span>
            ) : report ? (
              <span>Root cause confirmed in code diff: f-string SQLi. Safe target v1.4.0 verified.</span>
            ) : isDegraded ? (
              <span className="text-zinc-900 font-semibold">Whitebox SQLi holding worker locks in Docker container :8001. Multiple routes degraded.</span>
            ) : (
              <span>Gateway running normally. Ready to test autonomous incident investigation.</span>
            )}
          </div>
        </div>

        {/* Primary Action Button for Current Phase */}
        <div className="flex items-center space-x-2">
          {state?.weights?.green === 100 ? (
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white rounded text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Baseline</span>
            </button>
          ) : report ? (
            <button
              type="button"
              onClick={handleScrollToRca}
              className="px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white rounded text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Inspect Code Diff & Rollback</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : isDegraded ? (
            <button
              type="button"
              onClick={handleInvestigate}
              disabled={isInvestigating}
              className="px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white rounded text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            >
              <Sparkles className={cn('w-3.5 h-3.5', isInvestigating && 'animate-spin')} />
              <span>{isInvestigating ? 'Gemma Investigating...' : 'Analyze with Gemma 4'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSelectScenario('a_exploit')}
              className="px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white rounded text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Initiate Whitebox Attack</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Notification Banner */}
      {errorBanner && (
        <div className="bg-zinc-100 border-b border-zinc-300 px-6 py-2 flex items-center justify-between text-xs text-zinc-900 shrink-0">
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

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-hidden relative">
        {currentTab === 'overview' && (
          <div className="h-full overflow-y-auto px-6 py-6 space-y-8 max-w-7xl mx-auto">
            {/* ================= STEP 1: REAL-TIME TELEMETRY ================= */}
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                    1
                  </span>
                  <h2 className="text-sm font-bold text-zinc-900 tracking-tight uppercase">
                    Real-Time Gateway Telemetry & Multi-API Health
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 font-mono">1-second streaming Task-Manager buffer</span>
              </div>

              {/* Side-by-Side: Task Manager Telemetry Chart & Multi-API Health Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                {/* Telemetry Chart Component */}
                <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5 flex flex-col">
                  <MetricsChart
                    metrics={metrics}
                    selectedRoute="/api/orders|all"
                    markerText={markerText}
                    onInvestigate={handleInvestigate}
                  />
                </div>

                {/* Multi-API Percentiles & Failure Status Table */}
                <div className="flex flex-col">
                  <ApiMetricsTable
                    metrics={metrics}
                    onInvestigateRoute={() => handleInvestigate()}
                  />
                </div>
              </div>
            </section>

            {/* ================= STEP 2: SECURITY & MULTI-VERSION SCANS ================= */}
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                    2
                  </span>
                  <h2 className="text-sm font-bold text-zinc-900 tracking-tight uppercase">
                    Security Scanners (SAST, SCA, DAST, WAF)
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  {findings.length} Total Findings Across Releases
                </span>
              </div>

              <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5">
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
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                    3
                  </span>
                  <h2 className="text-sm font-bold text-zinc-900 tracking-tight uppercase">
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
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 bg-black text-white text-xs font-bold rounded flex items-center justify-center font-mono">
                    4
                  </span>
                  <h2 className="text-sm font-bold text-zinc-900 tracking-tight uppercase">
                    Blast Radius Containment & 1-Click Code-Verified Recovery
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  Deterministic LKG Preconditions
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1-Click Rollback Control Card */}
                <RollbackControlCard
                  state={state}
                  onMitigationExecuted={handleMitigationExecuted}
                />

                {/* Mitigation Safe Actions View */}
                <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-5">
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
          <div className="h-full max-w-7xl mx-auto p-6 overflow-hidden">
            <InvestigationFeed
              events={events}
              report={report}
              verification={verification}
              isInvestigating={isInvestigating}
              onSelectCitation={handleSelectCitation}
              scenario={activeScenario}
            />
          </div>
        )}

        {currentTab === 'findings' && (
          <div className="h-full max-w-7xl mx-auto p-6 overflow-y-auto">
            <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs">
              <FindingsRail
                findings={findings}
                findingVerdicts={report?.finding_verdicts}
                onSelectCitation={handleSelectCitation}
              />
            </div>
          </div>
        )}

        {currentTab === 'attack_path' && (
          <div className="h-full max-w-7xl mx-auto p-6 overflow-hidden">
            <AttackPathGraph
              report={report}
              onSelectCitation={handleSelectCitation}
            />
          </div>
        )}

        {currentTab === 'blast_radius' && (
          <div className="h-full max-w-7xl mx-auto p-6 overflow-hidden">
            <BlastRadiusGraph
              blastRadius={report?.blast_radius || null}
              onSelectCitation={handleSelectCitation}
            />
          </div>
        )}

        {currentTab === 'mitigation' && (
          <div className="h-full max-w-7xl mx-auto p-6 overflow-y-auto">
            <MitigationView
              mitigations={report?.mitigations || []}
              rejectedOptions={report?.rejected_options || []}
              state={state}
              onSelectCitation={handleSelectCitation}
              onMitigationExecuted={handleMitigationExecuted}
            />
          </div>
        )}

        {currentTab === 'pitch_rca' && (
          <div className="h-full max-w-7xl mx-auto p-6 overflow-y-auto">
            <PitchRcaView
              activeScenario={activeScenario}
              onSelectCitation={handleSelectCitation}
              onTriggerScenario={handleSelectScenario}
            />
          </div>
        )}
      </main>

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
