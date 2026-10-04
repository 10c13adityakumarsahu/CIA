import React from 'react';
import {
  Activity,
  Shield,
  FileCode,
  Database,
  ShieldCheck,
  ArrowRight,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { MainViewTab } from './AppSidebar';

export type StageStatus = 'idle' | 'processing' | 'completed';

interface HumanInTheLoopBarProps {
  currentTab: MainViewTab;
  onSelectTab: (tab: MainViewTab) => void;
  selectedRoute: string;
  onSelectRoute: (route: string) => void;
  stageStatuses: Record<number, StageStatus>;
  stageMessages: Record<number, string>;
  onExecuteStageAction: (stageNumber: number) => void;
  onAdvanceToNextStage: () => void;
  isDegraded: boolean;
  isRecovered: boolean;
}

export const HumanInTheLoopBar: React.FC<HumanInTheLoopBarProps> = ({
  currentTab,
  onSelectTab,
  selectedRoute,
  onSelectRoute,
  stageStatuses,
  stageMessages,
  onExecuteStageAction,
  onAdvanceToNextStage,
  isDegraded,
  isRecovered,
}) => {
  const stageMap: Record<MainViewTab, number> = {
    telemetry: 1,
    scans: 2,
    code_diff: 3,
    blast_radius: 4,
    recovery: 5,
  };

  const tabFromStage: Record<number, MainViewTab> = {
    1: 'telemetry',
    2: 'scans',
    3: 'code_diff',
    4: 'blast_radius',
    5: 'recovery',
  };

  const currentStageNumber = stageMap[currentTab] || 1;
  const currentStatus = stageStatuses[currentStageNumber] || 'idle';
  const currentMessage = stageMessages[currentStageNumber] || '';

  const stages = [
    { num: 1, tab: 'telemetry' as MainViewTab, title: '1. Telemetry', icon: Activity, actionLabel: 'Verify Telemetry Anomaly' },
    { num: 2, tab: 'scans' as MainViewTab, title: '2. Security Scans', icon: Shield, actionLabel: 'Correlate SAST/SCA Scans' },
    { num: 3, tab: 'code_diff' as MainViewTab, title: '3. Gemma RCA', icon: FileCode, actionLabel: 'Synthesize Gemma RCA' },
    { num: 4, tab: 'blast_radius' as MainViewTab, title: '4. Blast Radius', icon: Database, actionLabel: 'Verify Blast Radius Map' },
    { num: 5, tab: 'recovery' as MainViewTab, title: '5. Recovery', icon: ShieldCheck, actionLabel: 'Approve & Execute Rollback' },
  ];

  const endpoints = ['/api/orders', '/api/products', '/api/payments'];

  return (
    <div className="bg-white border-b border-zinc-200 px-6 py-2 shadow-xs shrink-0 select-none">
      {/* Top Row: Stepper and Endpoint Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        {/* Visual Guided Stepper Pipeline (Prominent User Flow) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
          <div className="flex items-center space-x-1 mr-2 shrink-0">
            <span className="text-[11px] uppercase font-mono font-bold text-zinc-900 tracking-wider">
              Flow:
            </span>
          </div>

          {stages.map((st, idx) => {
            const isActive = currentStageNumber === st.num;
            const status = stageStatuses[st.num] || 'idle';
            const Icon = st.icon;

            return (
              <React.Fragment key={st.num}>
                <button
                  type="button"
                  onClick={() => onSelectTab(st.tab)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono flex items-center space-x-2 transition cursor-pointer border shrink-0 shadow-2xs',
                    isActive
                      ? 'bg-[#0176D3] text-white border-[#0176D3] font-bold ring-2 ring-[#0176D3]/20 shadow-sm'
                      : status === 'completed'
                        ? 'bg-blue-50 text-[#0176D3] border-blue-200 hover:bg-blue-100 font-semibold'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                  )}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                      isActive
                        ? 'bg-white text-[#0176D3]'
                        : status === 'completed'
                          ? 'bg-[#0176D3] text-white'
                          : 'bg-zinc-100 text-zinc-600'
                    )}
                  >
                    {status === 'completed' ? (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    ) : (
                      st.num
                    )}
                  </span>
                  <span>{st.title.split('. ')[1]}</span>
                </button>
                {idx < stages.length - 1 && (
                  <span className="text-zinc-300 font-mono text-xs px-0.5 select-none font-bold">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Focused Endpoint Selector */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[11px] font-mono text-zinc-500 uppercase font-semibold">
            Focused API:
          </span>
          <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs font-mono">
            {endpoints.map((ep) => (
              <button
                key={ep}
                type="button"
                onClick={() => onSelectRoute(ep)}
                className={cn(
                  'px-2.5 py-0.5 rounded-md transition text-[11px] cursor-pointer font-medium',
                  selectedRoute === ep
                    ? 'bg-[#0176D3] text-white font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                {ep}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Stage Action, Processing, and Next Stage Status */}
      <div className="mt-2 pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-mono">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-50 text-[#0176D3] border border-blue-200 shrink-0">
            Step {currentStageNumber} of 5
          </span>

          {currentStatus === 'processing' ? (
            <div className="flex items-center space-x-2 text-zinc-900 font-semibold truncate animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0176D3] shrink-0" />
              <span className="truncate text-[#0176D3] font-bold">
                [PROCESSING]: {currentMessage || 'Executing verification step...'}
              </span>
            </div>
          ) : currentStatus === 'completed' ? (
            <div className="flex items-center space-x-2 text-zinc-900 truncate">
              <span className="w-2 h-2 rounded-full bg-[#0176D3] shrink-0" />
              <span className="font-bold text-[#0176D3] shrink-0">[COMPLETED]:</span>
              <span className="text-zinc-800 font-medium truncate">{currentMessage}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-zinc-600 truncate">
              <span className="text-zinc-400">Action Required:</span>
              <span className="text-zinc-800 font-semibold truncate">
                {currentMessage || `Review ${stages[currentStageNumber - 1].title} data for ${selectedRoute}.`}
              </span>
            </div>
          )}
        </div>

        {/* Stage Interactive Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {currentStatus === 'processing' ? (
            <span className="px-3.5 py-1 rounded-lg bg-blue-50 text-[#0176D3] border border-blue-200 font-bold text-xs flex items-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>In Progress...</span>
            </span>
          ) : currentStatus === 'completed' ? (
            currentStageNumber < 5 ? (
              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="px-3.5 py-1.5 rounded-lg bg-[#0176D3] hover:bg-[#014486] text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs active:scale-98"
              >
                <span>Advance to Step {currentStageNumber + 1}: {stages[currentStageNumber].title.split('. ')[1]}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : isRecovered ? (
              <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>System Restored to Health (100% LKG)</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-blue-50 text-[#0176D3] border border-blue-200 font-bold text-xs">
                Recovery Verified
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={() => onExecuteStageAction(currentStageNumber)}
              className="px-3.5 py-1.5 rounded-lg bg-[#0176D3] hover:bg-[#014486] text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs active:scale-98"
            >
              <span>{stages[currentStageNumber - 1].actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
