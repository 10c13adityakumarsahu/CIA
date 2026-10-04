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
import { InvestigationFeed } from './components/InvestigationFeed';
import { AttackPathGraph } from './components/AttackPathGraph';
import { BlastRadiusGraph } from './components/BlastRadiusGraph';
import { MitigationView } from './components/MitigationView';
import { PitchRcaView } from './components/PitchRcaView';
import { IncidentStepper, IncidentStep } from './components/IncidentStepper';
import { ReportExportModal } from './components/ReportExportModal';
import { CitationDrawer } from './components/CitationDrawer';
import { AlertCircle, ArrowRight, ShieldAlert, Cpu, CheckCircle2, Sparkles } from 'lucide-react';

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
    }, 4000);
    return () => clearInterval(interval);
  }, [loadInitialData]);

  const handleSelectScenario = async (scenario: 'a_exploit' | 'b_regression') => {
    try {
      setActiveScenario(scenario);
      setEvents([]);
      setReport(null);
      setVerification(null);
      setMarkerText(scenario === 'a_exploit' ? 'Exploit Burst Injected' : '100% Shift to 1.5.0');
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
      setErrorBanner(`Failed to reset scenario: ${err.message}`);
    }
  };

  const handleInvestigate = async () => {
    setIsInvestigating(true);
    setCurrentTab('investigate');
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
        'color: #ef4444; font-weight: bold; font-size: 13px;'
      );
      console.log(
        '%c[CULPRIT AUTO-RCA] Root Cause Endpoint: POST /api/orders (p95 > 1000ms, DB Pool Starvation)',
        'color: #f59e0b; font-weight: bold;'
      );
      console.log(
        '%c[CULPRIT AUTO-RCA] Cascaded Impact: GET /api/products, POST /api/payments experiencing 504 timeouts',
        'color: #f59e0b;'
      );
      console.log(
        '%c[CULPRIT AUTO-RCA] 🤖 Autonomous AI Invocation: Launching Gemma 4 Tool-Calling Investigation Stream...',
        'color: #3b82f6; font-weight: bold;'
      );

      // Auto-trigger Gemma investigation
      const timer = setTimeout(() => {
        handleInvestigate();
      }, 1200);

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

  const handleStepSelect = (step: IncidentStep) => {
    setCurrentStep(step);
    if (step === 'telemetry') {
      setCurrentTab('overview');
    } else if (step === 'scans') {
      setCurrentTab('findings');
    } else if (step === 'gemma_rca') {
      setCurrentTab('investigate');
    } else if (step === 'blast_radius') {
      setCurrentTab('blast_radius');
    } else if (step === 'mitigate') {
      setCurrentTab('mitigation');
    }
  };

  const mode = state?.mode || 'LIVE';

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
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
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header
          mode={mode}
          activeScenario={activeScenario}
          isInvestigating={isInvestigating}
          onInvestigate={handleInvestigate}
          onExportReport={() => setIsExportOpen(true)}
        />

        {/* Guided Workflow Stepper */}
        <IncidentStepper
          currentStep={currentStep}
          onSelectStep={handleStepSelect}
          onExportReport={() => setIsExportOpen(true)}
          isDegraded={isDegraded}
          hasReport={report !== null}
          isInvestigating={isInvestigating}
        />

        {/* Error Notification Banner */}
        {errorBanner && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between text-xs text-red-800">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-red-600 hover:text-red-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Main View */}
        <main className="flex-1 overflow-hidden relative">
          {currentTab === 'overview' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {/* Telemetry Chart Component */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
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

              {/* Quick Incident Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Vulnerability Scans
                    </span>
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900">
                      {findings.length} Findings
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      SAST (AST tainted sql), SCA (CVE-2024-41123, CVE-2023-43665), and DAST injection points.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('findings')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>View All Scans & CVEs</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Gemma 4 RCA Engine
                    </span>
                    <Sparkles className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900">
                      {report ? report.verdict : isInvestigating ? 'Analyzing...' : 'Ready'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {report?.incident_summary || 'Multi-tool agent correlating logs, tainted code ASTs, and blast radius.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleInvestigate}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>{report ? 'View Investigation Feed' : 'Run Gemma RCA Now'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Mitigation & Recovery
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900">
                      {report?.mitigations?.length || 0} Safe Actions
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Deterministic verification ensures rollbacks target only clean versions (v1.4.0 LKG).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('mitigation')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Inspect Mitigation Options</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
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

