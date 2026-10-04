import React from 'react';
import { Sparkles, Download, ShieldAlert, RotateCcw, Zap, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  mode: 'LIVE' | 'REPLAY';
  activeScenario: string | null;
  isInvestigating: boolean;
  onInitiateAttack: () => void;
  onReset: () => void;
  onInvestigate: () => void;
  onExportReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  activeScenario,
  isInvestigating,
  onInitiateAttack,
  onReset,
  onInvestigate,
  onExportReport,
}) => {
  return (
    <header className="h-14 bg-white border-b border-zinc-200 px-6 flex items-center justify-between z-20 select-none shrink-0">
      {/* Brand & Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-black text-white rounded flex items-center justify-center font-mono font-black text-xs">
            C
          </div>
          <span className="font-bold text-zinc-900 tracking-tight text-sm">CULPRIT</span>
          <span className="text-zinc-400 text-xs font-mono">v1.5</span>
        </div>

        <div className="h-4 w-px bg-zinc-200" />

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            {mode} GATEWAY
          </span>
          {activeScenario && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-black text-white border border-zinc-900">
              <ShieldAlert className="w-3 h-3 text-red-400 mr-1 animate-pulse" />
              ATTACK ACTIVE: {activeScenario === 'a_exploit' ? 'SQLi Whitebox Exploit' : 'N+1 Loop Spike'}
            </span>
          )}
        </div>
      </div>

      {/* Main Workflow Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Initiate Whitebox Attack Button */}
        <button
          type="button"
          onClick={onInitiateAttack}
          disabled={activeScenario !== null}
          className={cn(
            'px-3.5 py-1.5 rounded-md font-semibold text-xs flex items-center space-x-1.5 transition border cursor-pointer',
            activeScenario !== null
              ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
              : 'bg-black text-white border-black hover:bg-zinc-800 active:scale-98 shadow-sm'
          )}
          title="Inject real-time SQL injection burst directly into Docker target container"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Initiate Whitebox Attack</span>
        </button>

        {/* Reset Button */}
        <button
          type="button"
          onClick={onReset}
          className="px-3.5 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-98 cursor-pointer"
          title="Reset traffic generation and reset weights"
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-600" />
          <span>Reset</span>
        </button>

        <div className="h-4 w-px bg-zinc-200 mx-1" />

        {/* Investigate with Gemma */}
        <button
          type="button"
          onClick={onInvestigate}
          disabled={isInvestigating}
          className={cn(
            'px-3.5 py-1.5 rounded-md font-semibold text-xs flex items-center space-x-1.5 transition border cursor-pointer',
            isInvestigating
              ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
              : 'bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50'
          )}
        >
          <Sparkles className={cn('w-3.5 h-3.5 text-zinc-700', isInvestigating && 'animate-spin')} />
          <span>{isInvestigating ? 'Gemma Analyzing...' : 'Run Gemma RCA'}</span>
        </button>

        {/* Export Report */}
        <button
          type="button"
          onClick={onExportReport}
          className="px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 text-xs font-medium flex items-center space-x-1.5 transition"
        >
          <Download className="w-3.5 h-3.5 text-zinc-500" />
          <span>Audit Report</span>
        </button>
      </div>
    </header>
  );
};
