import React from 'react';
import { GatewayState } from '../types';
import { Server, CheckCircle2, XCircle, ArrowRight, ShieldCheck, History } from 'lucide-react';
import { CitationChip } from './CitationChip';

interface LeftSidebarProps {
  state: GatewayState | null;
  onSelectCitation: (citation: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ state, onSelectCitation }) => {
  const healthItems = [
    { name: 'Gateway', key: 'gateway', port: ':8080' },
    { name: 'App Blue (1.5.0)', key: 'blue', port: ':8001' },
    { name: 'App Green (1.4.0)', key: 'green', port: ':8002' },
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

  return (
    <div className="w-80 h-full border-r border-[#334155] bg-[#111827] flex flex-col p-4 space-y-6 overflow-y-auto select-none">
      {/* Infrastructure Health */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
            <Server className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            Infrastructure Health
          </span>
          <span className="text-[11px] font-mono text-emerald-400">7/7 UP</span>
        </div>

        <div className="space-y-1.5 bg-[#0B0F19] p-3 rounded-lg border border-[#334155]">
          {healthItems.map((item) => {
            const isHealthy = state?.health ? (state.health as any)[item.key] !== false : true;
            return (
              <div key={item.key} className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">{item.name}</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 text-[10px]">{item.port}</span>
                  {isHealthy ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Traffic Routing / Blue-Green Split */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Traffic Routing Split
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            B:{blueWeight}% / G:{greenWeight}%
          </span>
        </div>

        <div className="bg-[#0B0F19] p-3 rounded-lg border border-[#334155] space-y-2">
          {/* Split bar */}
          <div className="w-full h-3 rounded-full overflow-hidden bg-slate-800 flex">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${blueWeight}%` }}
              title={`Blue (1.5.0): ${blueWeight}%`}
            />
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${greenWeight}%` }}
              title={`Green (1.4.0): ${greenWeight}%`}
            />
          </div>

          <div className="flex justify-between text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-slate-300">Blue (v1.5.0): {blueWeight}%</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Green (v1.4.0): {greenWeight}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Release Ledger & Timeline */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
            <History className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
            Release Ledger
          </span>
        </div>

        <div className="space-y-2 bg-[#0B0F19] p-3 rounded-lg border border-[#334155] flex-1">
          {releases.map((rel) => (
            <div
              key={rel.version}
              className="p-2.5 rounded bg-[#111827] border border-[#334155] hover:border-slate-500 transition"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-xs text-slate-100">
                    v{rel.version}
                  </span>
                  {rel.is_lkg && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center">
                      <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                      LKG
                    </span>
                  )}
                  {rel.status === 'current' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                      CURRENT
                    </span>
                  )}
                </div>
                <CitationChip
                  citation={`REL:${rel.version}`}
                  onClick={onSelectCitation}
                  className="text-[10px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-400 mt-1">
                <div>p95: <span className="text-slate-200">{rel.p95_ms}ms</span></div>
                <div>Err: <span className="text-slate-200">{(rel.err_rate * 100).toFixed(1)}%</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
