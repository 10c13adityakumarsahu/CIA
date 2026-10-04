import React, { useState, useEffect, useCallback } from 'react';
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
import { FindingsRail } from './components/FindingsRail';
import { CulpritCodeSnippetCard } from './components/CulpritCodeSnippetCard';
import { RollbackControlCard } from './components/RollbackControlCard';
import { BlastRadiusGraph } from './components/BlastRadiusGraph';
import { MitigationView } from './components/MitigationView';
import { ReportExportModal } from './components/ReportExportModal';
import { CitationDrawer } from './components/CitationDrawer';
import {
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Zap,
  RotateCcw,
  Shield,
  FileCode,
  Database,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { cn } from './lib/utils';

export function App() {
  const [currentTab, setCurrentTab] = useState<MainViewTab>('telemetry');
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

      // Optimistically elevate orders latency immediately
      setMetrics((prev) => ({
        ...prev,
        '/api/orders|all': {
          p50_ms: 120,
          p95_ms: 5008,
          err_rate: 0.12,
          rps: 1.57,
          count: 100
        }
      }));

      // Fire async scenario
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

      // Optimistically restore nominal metrics immediately
      setMetrics((prev) => ({
        ...prev,
        '/api/orders|all': {
          p50_ms: 22,
          p95_ms: 38,
          err_rate: 0.0,
          rps: 16.2,
          count: 100
        }
      }));

      await resetScenario();
      await loadInitialData();
      setCurrentTab('telemetry');
    } catch (err: any) {
      setErrorBanner(`Failed to reset: ${err.message}`);
    }
  };

  const handleInvestigate = async () => {
    setIsInvestigating(true);
    setCurrentTab('code_diff');
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

  const isRecovered = state?.weights?.green === 100;
  const isDegraded =
    !isRecovered &&
    ((metrics?.['/api/orders|all']?.p95_ms || 0) > 800 ||
      (metrics?.['/api/orders|all']?.err_rate || 0) > 0.02 ||
      activeScenario !== null);

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

  const mode = state?.mode || 'LIVE';

  return (
    <div className="flex h-screen w-screen bg-[#FAFAFA] text-zinc-900 overflow-hidden font-sans select-none">
      {/* Sleek Left Navigation Sidebar - Fixed No Scroll */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        state={state}
        activeScenario={activeScenario}
        isDegraded={isDegraded}
        hasReport={report !== null}
        isRecovered={isRecovered}
        onInitiateAttack={() => handleSelectScenario('a_exploit')}
        onReset={handleReset}
      />

      {/* Main Right Content Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <Header
          mode={mode}
          activeScenario={activeScenario}
          isInvestigating={isInvestigating}
          onInitiateAttack={() => handleSelectScenario('a_exploit')}
          onReset={handleReset}
          onInvestigate={handleInvestigate}
          onExportReport={() => setIsExportOpen(true)}
        />

        {/* Guided Workflow Phase Bar */}
        <div className="bg-white border-b border-zinc-200 px-6 py-2.5 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                INCIDENT STATUS:
              </span>
              {isRecovered ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-black text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                  RECOVERED (100% v1.4.0 LKG)
                </span>
              ) : report ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-black text-white">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                  RCA SYNTHESIZED (CWE-89 SQLi)
                </span>
              ) : isDegraded ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-black text-white">
                  <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                  ATTACK INJECTED (DB Contention)
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                  SYSTEM NOMINAL (Baseline)
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-zinc-200 hidden sm:block" />

            {/* Context Guidance Message */}
            <div className="text-xs text-zinc-600 hidden md:block">
              {isRecovered ? (
                <span>Gateway routed 100% traffic to stable LKG. Latency &lt; 20ms and 0% errors.</span>
              ) : report ? (
                <span>Root cause confirmed in code diff. Target v1.4.0 verified clean for 1-click rollback.</span>
              ) : isDegraded ? (
                <span className="text-zinc-900 font-semibold">
                  Whitebox SQLi holding locks in Docker container :8001. Multiple endpoints experiencing 500s.
                </span>
              ) : (
                <span>All routes healthy. Click 'Initiate Whitebox Attack' to simulate live exploit.</span>
              )}
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center space-x-2">
            {isRecovered ? (
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
                onClick={() => setCurrentTab('recovery')}
                className="px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white rounded text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
              >
                <span>Execute Rollback →</span>
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

        {/* Active Viewport Content - Exactly Fits Screen (ZERO VERTICAL SCROLL) */}
        <main className="flex-1 p-5 overflow-hidden relative bg-[#FAFAFA]">
          {/* ================= VIEW 1: TELEMETRY & MULTI-API ================= */}
          {currentTab === 'telemetry' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              {/* Left: Task Manager Live Stream Chart */}
              <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 flex flex-col h-full justify-between">
                <MetricsChart
                  metrics={metrics}
                  selectedRoute="/api/orders|all"
                  markerText={markerText}
                  onInvestigate={handleInvestigate}
                />
              </div>

              {/* Right: Actionable Multi-API Endpoint Health Table */}
              <div className="h-full flex flex-col">
                <ApiMetricsTable
                  metrics={metrics}
                  onInvestigateRoute={() => handleInvestigate()}
                  onViewBlastRadius={() => setCurrentTab('blast_radius')}
                  onViewDiff={() => setCurrentTab('code_diff')}
                  onTriggerAttack={() => handleSelectScenario('a_exploit')}
                />
              </div>
            </div>
          )}

          {/* ================= VIEW 2: SECURITY SCANS ================= */}
          {currentTab === 'scans' && (
            <div className="h-full bg-white rounded-xl border border-zinc-200 shadow-xs p-5 overflow-y-auto">
              <FindingsRail
                findings={findings}
                findingVerdicts={report?.finding_verdicts}
                onSelectCitation={handleSelectCitation}
              />
            </div>
          )}

          {/* ================= VIEW 3: GEMMA RCA & CODE DIFF ================= */}
          {currentTab === 'code_diff' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch overflow-hidden">
              {/* Left: Gemma Verdict Summary Card (4 cols) */}
              <div className="lg:col-span-4 bg-white rounded-xl border border-zinc-200 shadow-xs p-5 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-black" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900 font-mono">
                        Gemma 4 Root Cause Verdict
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-black text-white text-[11px] font-mono font-bold">
                      {report?.verdict ? report.verdict.toUpperCase() : 'EXPLOIT'}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Confidence:</span>
                      <span className="font-bold text-zinc-900">98% (High)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Culprit Release:</span>
                      <span className="font-bold text-zinc-900">v1.5.0 (Blue)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Safe Target:</span>
                      <span className="font-bold text-zinc-900">v1.4.0 (LKG)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                      Correlated Incident Evidence
                    </div>
                    <p className="text-xs text-zinc-700 leading-relaxed font-sans">
                      {report?.incident_summary ||
                        'Correlated raw f-string tainted AST in orders() with pg_sleep() SQL injection payload from attacker IP 198.51.100.42. Database worker lock contention starved the 5-connection pool, cascading 504 timeouts to /api/products and /api/payments.'}
                    </p>
                  </div>
                </div>

                {/* Direct Action to Rollback */}
                <div className="pt-4 border-t border-zinc-100 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentTab('recovery')}
                    className="w-full py-2 bg-black hover:bg-zinc-800 text-white rounded text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span>Proceed to Rollback & Recovery</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right: Live Unified Git Code Diff & Remediation (8 cols) */}
              <div className="lg:col-span-8 h-full flex flex-col overflow-hidden">
                <CulpritCodeSnippetCard
                  scenario={activeScenario}
                  onSelectCitation={handleSelectCitation}
                />
              </div>
            </div>
          )}

          {/* ================= VIEW 4: BLAST RADIUS IMPACT ================= */}
          {currentTab === 'blast_radius' && (
            <div className="h-full bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-black" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900 font-mono">
                    Blast Radius Dependency & Pool Contention Graph
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentTab('recovery')}
                  className="px-3 py-1 bg-black text-white hover:bg-zinc-800 rounded text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                >
                  <span>Go to Recovery</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex-1 relative">
                <BlastRadiusGraph
                  blastRadius={report?.blast_radius || null}
                  onSelectCitation={handleSelectCitation}
                />
              </div>
            </div>
          )}

          {/* ================= VIEW 5: VERIFIED ROLLBACK & RECOVERY ================= */}
          {currentTab === 'recovery' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch overflow-hidden">
              {/* Left: 1-Click Code-Verified Rollback Card */}
              <div className="h-full flex flex-col">
                <RollbackControlCard
                  state={state}
                  onMitigationExecuted={handleMitigationExecuted}
                />
              </div>

              {/* Right: Mitigations & Guardrail Verification */}
              <div className="h-full bg-white rounded-xl border border-zinc-200 shadow-xs p-5 overflow-y-auto">
                <MitigationView
                  mitigations={report?.mitigations || []}
                  rejectedOptions={report?.rejected_options || []}
                  state={state}
                  onSelectCitation={handleSelectCitation}
                  onMitigationExecuted={handleMitigationExecuted}
                />
              </div>
            </div>
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
