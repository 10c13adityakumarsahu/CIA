import React, { useState } from 'react';
import {
  Activity,
  Terminal,
  Shield,
  GitPullRequest,
  Database,
  Sparkles,
  Server,
  History,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Cpu,
  RotateCcw,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { GatewayState } from '../types';
import { CitationChip } from './CitationChip';

export type MainViewTab = 'overview' | 'investigate' | 'findings' | 'attack_path' | 'blast_radius' | 'mitigation' | 'pitch_rca';

interface AppSidebarProps {
  currentTab: MainViewTab;
  onSelectTab: (tab: MainViewTab) => void;
  state: GatewayState | null;
  activeScenario: string | null;
  onSelectScenario: (scenario: 'a_exploit' | 'b_regression') => void;
  onReset: () => void;
  onSelectCitation: (citation: string) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  state,
  activeScenario,
  onSelectScenario,
  onReset,
  onSelectCitation
}) => {
  const [infraOpen, setInfraOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Telemetry & Metrics', icon: Activity, badge: 'Live' },
    { id: 'investigate', label: 'Gemma 4 Investigation', icon: Terminal, badge: 'RCA' },
    { id: 'findings', label: 'Vulnerabilities & Scans', icon: Shield, badge: 'SAST/SCA' },
    { id: 'attack_path', label: 'Attack Path Graph', icon: GitPullRequest },
    { id: 'blast_radius', label: 'Blast Radius Map', icon: Database },
    { id: 'mitigation', label: 'Mitigation & Safety', icon: ShieldCheck },
    { id: 'pitch_rca', label: 'Pitch & RCA Deep-Dive', icon: Sparkles, highlight: true },
  ];

  const healthItems = [
    { name: 'Gateway', key: 'gateway', port: ':8080' },
    { name: 'Blue (1.5.0)', key: 'blue', port: ':8001' },
    { name: 'Green (1.4.0)', key: 'green', port: ':8002' },
    { name: 'Postgres (db)', key: 'db', port: ':5432' },
    { name: 'Neo4j (graph)', key: 'neo4j', port: ':7687' },
    { name: 'Redis (ledger)', key: 'redis', port: ':6379' },
    { name: 'Registry', key: 'registry', port: ':5000' },
  ];

  const blueWeight = state?.weights?.blue ?? 100;
  const greenWeight = state?.weights?.green ?? 0;

  const releases = state?.ledger_releases || [
    { version: '1.3.0', status: 'stable', deployed_at: '2026-09-01T00:00:00Z', p95_ms: 110, err_rate: 0.0 },
    { version: '1.4.0', status: 'stable', deployed_at: '2026-09-15T00:00:00Z', p95_ms: 115, err_rate: 0.0, is_lkg: true },
    { version: '1.5.0', status: 'current', deployed_at: '2026-10-01T00:00:00Z', p95_ms: 420, err_rate: 0.02 }
  ];

  const mode = state?.mode || 'LIVE';

  return (
    <aside className="w-64 h-full bg-white border-r border-slate-200 flex flex-col select-none shrink-0 shadow-sm z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-sm">
            C
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-900 text-sm tracking-tight">CULPRIT</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                v1.5
              </span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Root-Cause Decision Engine
            </div>
          </div>
        </div>

        {/* Mode Pill */}
        <span
          className={cn(
            'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1',
            mode === 'LIVE'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', mode === 'LIVE' ? 'bg-emerald-500' : 'bg-amber-500')} />
          <span>{mode}</span>
        </span>
      </div>

      {/* Scenario Triggers Card */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Incident Simulation
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <button
            type="button"
            onClick={() => onSelectScenario('a_exploit')}
            className={cn(
              'px-2 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1 border transition',
              activeScenario === 'a_exploit'
                ? 'bg-red-600 text-white border-red-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            )}
          >
            <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />
            <span className="truncate">A: Exploit</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectScenario('b_regression')}
            className={cn(
              'px-2 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center space-x-1 border transition',
              activeScenario === 'b_regression'
                ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            )}
          >
            <Cpu className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">B: Regression</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="w-full py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-medium flex items-center justify-center space-x-1 transition"
        >
          <RotateCcw className="w-3 h-3 text-slate-400" />
          <span>Reset Environment</span>
        </button>
      </div>

      {/* Main Navigation Items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
          Views & Analysis
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id as MainViewTab)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              )}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  className={cn(
                    'w-4 h-4',
                    isActive ? 'text-blue-600' : item.highlight ? 'text-amber-500' : 'text-slate-400'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    'text-[10px] font-mono px-1.5 py-0.2 rounded border',
                    isActive
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Collapsible Infrastructure Health */}
        <div className="pt-3 border-t border-slate-100 mt-2">
          <button
            type="button"
            onClick={() => setInfraOpen(!infraOpen)}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
          >
            <span className="flex items-center">
              <Server className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Infrastructure (7/7)
            </span>
            {infraOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {infraOpen && (
            <div className="mt-1 space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs font-mono">
              {healthItems.map((item) => {
                const isHealthy = state?.health ? (state.health as any)[item.key] !== false : true;
                return (
                  <div key={item.key} className="flex items-center justify-between py-0.5">
                    <span className="text-slate-600 text-[11px]">{item.name}</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400 text-[10px]">{item.port}</span>
                      {isHealthy ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Collapsible Release Ledger */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setLedgerOpen(!ledgerOpen)}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
          >
            <span className="flex items-center">
              <History className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
              Release Ledger
            </span>
            {ledgerOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {ledgerOpen && (
            <div className="mt-1 space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs font-mono">
              {releases.map((rel) => (
                <div
                  key={rel.version}
                  className="p-1.5 bg-white rounded border border-slate-200 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px]">v{rel.version}</span>
                    {rel.is_lkg && (
                      <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        LKG
                      </span>
                    )}
                    {rel.status === 'current' && (
                      <span className="px-1 py-0.2 rounded text-[9px] bg-blue-100 text-blue-800 border border-blue-200">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>p95: {rel.p95_ms}ms</span>
                    <span>err: {(rel.err_rate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Footer Traffic Routing Indicator */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/80 text-xs font-mono">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Blue (1.5.0): {blueWeight}%</span>
          <span>Green (1.4.0): {greenWeight}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-200 flex">
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${blueWeight}%` }} />
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${greenWeight}%` }} />
        </div>
      </div>
    </aside>
  );
};
