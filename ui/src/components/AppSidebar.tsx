import React from 'react';
import {
  Activity,
  Shield,
  FileCode,
  Database,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { GatewayState } from '../types';

export type MainViewTab = 'telemetry' | 'scans' | 'code_diff' | 'blast_radius' | 'recovery';

interface AppSidebarProps {
  currentTab: MainViewTab;
  onSelectTab: (tab: MainViewTab) => void;
  state: GatewayState | null;
  activeScenario: string | null;
  isDegraded: boolean;
  hasReport: boolean;
  isRecovered: boolean;
  onInitiateAttack: () => void;
  onReset: () => void;
  stageStatuses?: Record<number, 'idle' | 'processing' | 'completed'>;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  state,
  activeScenario,
  isDegraded,
  hasReport,
  isRecovered,
  onInitiateAttack,
  onReset,
  stageStatuses,
}) => {
  const getBadge = (stepNum: number, defaultBadge: string) => {
    if (stageStatuses?.[stepNum] === 'processing') return 'Processing...';
    if (stageStatuses?.[stepNum] === 'completed') return 'Completed';
    return defaultBadge;
  };

  const navItems = [
    {
      id: 'telemetry' as MainViewTab,
      step: '1',
      label: 'Telemetry & Multi-API',
      description: 'Live task-manager streaming buffer',
      icon: Activity,
      badge: getBadge(1, isDegraded ? 'Critical' : 'Live'),
    },
    {
      id: 'scans' as MainViewTab,
      step: '2',
      label: 'Security Scanners',
      description: 'SAST, SCA, DAST ingestion',
      icon: Shield,
      badge: getBadge(2, '20 Scans'),
    },
    {
      id: 'code_diff' as MainViewTab,
      step: '3',
      label: 'Gemma RCA & Code Diff',
      description: 'Unified Git diff & AI patch',
      icon: FileCode,
      badge: getBadge(3, hasReport ? 'Synthesized' : 'Ready'),
    },
    {
      id: 'blast_radius' as MainViewTab,
      step: '4',
      label: 'Blast Radius Impact',
      description: 'Cascading pool contention map',
      icon: Database,
      badge: getBadge(4, isDegraded ? 'Degraded' : 'Mapped'),
    },
    {
      id: 'recovery' as MainViewTab,
      step: '5',
      label: 'Verified Recovery',
      description: '1-click safe rollback to v1.4.0',
      icon: ShieldCheck,
      badge: getBadge(5, isRecovered ? '100% LKG' : 'Failover'),
    },
  ];

  const blueWeight = state?.weights?.blue ?? 100;
  const greenWeight = state?.weights?.green ?? 0;

  return (
    <aside className="w-64 h-full bg-white border-r border-zinc-200 flex flex-col justify-between select-none shrink-0 z-30">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-zinc-200 flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded bg-black text-white flex items-center justify-center font-black font-mono text-sm">
            C
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-zinc-900 text-sm tracking-tight">CULPRIT</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 font-bold">
                v1.5
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Root-Cause Decision Engine
            </div>
          </div>
        </div>

        {/* Guided Workflow Steps Navigation */}
        <div className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
            Investigation Workflow
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg transition flex items-center justify-between group cursor-pointer border',
                  isActive
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-transparent border-transparent hover:bg-zinc-100 text-zinc-700'
                )}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span
                    className={cn(
                      'w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border',
                      isActive
                        ? 'bg-zinc-800 text-white border-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200 group-hover:border-zinc-300'
                    )}
                  >
                    {item.step}
                  </span>
                  <div className="truncate">
                    <div className={cn('text-xs font-bold leading-tight truncate', isActive ? 'text-white' : 'text-zinc-900')}>
                      {item.label}
                    </div>
                    <div className={cn('text-[10px] truncate leading-tight', isActive ? 'text-zinc-300' : 'text-zinc-500 font-mono')}>
                      {item.description}
                    </div>
                  </div>
                </div>

                <span
                  className={cn(
                    'text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded shrink-0 ml-1 border',
                    isActive
                      ? 'bg-zinc-800 text-white border-zinc-700'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                  )}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Live System Indicator & Controls */}
      <div className="p-3 border-t border-zinc-200 space-y-2 bg-zinc-50/50">
        <div className="bg-white p-2.5 rounded-lg border border-zinc-200 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>TRAFFIC WEIGHTS</span>
            <span className="text-zinc-900 font-bold">{isRecovered ? 'v1.4.0 (LKG)' : 'v1.5.0 (Culprit)'}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-700">Blue (v1.5.0): {blueWeight}%</span>
            <span className="text-zinc-700">Green (v1.4.0): {greenWeight}%</span>
          </div>
        </div>

        {/* Action Buttons in Sidebar */}
        <div className="grid grid-cols-2 gap-2 font-mono">
          <button
            type="button"
            onClick={onInitiateAttack}
            className="py-1.5 px-2 bg-black hover:bg-zinc-800 text-white rounded text-xs font-bold flex items-center justify-center transition cursor-pointer shadow-xs"
            title="Inject real-time SQL injection burst"
          >
            Attack
          </button>
          <button
            type="button"
            onClick={onReset}
            className="py-1.5 px-2 bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 rounded text-xs font-bold flex items-center justify-center transition cursor-pointer"
            title="Reset environment"
          >
            Reset
          </button>
        </div>
      </div>
    </aside>
  );
};
