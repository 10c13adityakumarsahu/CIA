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
import { LeftSidebar } from './components/LeftSidebar';
import { MetricsChart } from './components/MetricsChart';
import { FindingsRail } from './components/FindingsRail';
import { InvestigationFeed } from './components/InvestigationFeed';
import { AttackPathGraph } from './components/AttackPathGraph';
import { BlastRadiusGraph } from './components/BlastRadiusGraph';
import { MitigationView } from './components/MitigationView';
import { CitationDrawer } from './components/CitationDrawer';
import { Terminal, Shield, GitPullRequest, Activity, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';

export function App() {
  const [activeTab, setActiveTab] = useState<'investigate' | 'attack_path' | 'blast_radius' | 'mitigation'>('investigate');
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

  // Initial load and polling
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
      setErrorBanner(`Failed to reset scenario: ${err.message}`);
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
    <div className="flex flex-col h-screen w-screen bg-[#0B0F19] text-[#E2E8F0] overflow-hidden">
      {/* Top Header */}
      <Header
        mode={mode}
        activeScenario={activeScenario}
        isInvestigating={isInvestigating}
        onSelectScenario={handleSelectScenario}
        onReset={handleReset}
        onInvestigate={handleInvestigate}
      />

      {/* Optional Error Banner */}
      {errorBanner && (
        <div className="bg-red-950 border-b border-red-800 px-6 py-2 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-red-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main 3-Column Command Center */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Health, Weights, Ledger */}
        <LeftSidebar state={state} onSelectCitation={handleSelectCitation} />

        {/* Center Column: Telemetry + Tabs */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0B0F19]">
          {/* Top Live Latency & Error Chart */}
          <MetricsChart
            metrics={metrics}
            selectedRoute="/api/orders|all"
            markerText={markerText}
          />

          {/* Navigation Tab Bar */}
          <div className="flex items-center justify-between px-6 border-b border-[#334155] bg-[#111827] h-12 shrink-0">
            <div className="flex items-center space-x-1 h-full">
              <button
                type="button"
                onClick={() => setActiveTab('investigate')}
                className={cn(
                  'h-full px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition select-none',
                  activeTab === 'investigate'
                    ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                )}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Investigation Feed</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('attack_path')}
                className={cn(
                  'h-full px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition select-none',
                  activeTab === 'attack_path'
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                )}
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                <span>Attack Path</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('blast_radius')}
                className={cn(
                  'h-full px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition select-none',
                  activeTab === 'blast_radius'
                    ? 'border-purple-500 text-purple-400 bg-purple-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Blast Radius</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mitigation')}
                className={cn(
                  'h-full px-4 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition select-none',
                  activeTab === 'mitigation'
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Mitigation & Preconditions</span>
                {report?.mitigations && report.mitigations.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Views */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'investigate' && (
              <InvestigationFeed
                events={events}
                report={report}
                verification={verification}
                isInvestigating={isInvestigating}
                onSelectCitation={handleSelectCitation}
              />
            )}

            {activeTab === 'attack_path' && (
              <AttackPathGraph
                report={report}
                onSelectCitation={handleSelectCitation}
              />
            )}

            {activeTab === 'blast_radius' && (
              <BlastRadiusGraph
                blastRadius={report?.blast_radius || null}
                onSelectCitation={handleSelectCitation}
              />
            )}

            {activeTab === 'mitigation' && (
              <MitigationView
                mitigations={report?.mitigations || []}
                rejectedOptions={report?.rejected_options || []}
                onSelectCitation={handleSelectCitation}
                onMitigationExecuted={handleMitigationExecuted}
              />
            )}
          </div>
        </div>

        {/* Right Column: Security Findings Rail */}
        <FindingsRail
          findings={findings}
          findingVerdicts={report?.finding_verdicts}
          onSelectCitation={handleSelectCitation}
        />
      </div>

      {/* Slide-out Citation Code/Log Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}

export default App;
