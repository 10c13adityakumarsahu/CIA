import React from 'react';
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
      {/* Title & Environment Status (Clean Monochrome, No Dots) */}
      <div className="flex items-center space-x-3">
        <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-900">
          Reverse Proxy Gateway :8080 [{mode}]
        </span>

        {activeScenario && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0176D3] text-white border border-[#0176D3] uppercase tracking-tight shadow-2xs">
            Attack Active: {activeScenario === 'a_exploit' ? 'Whitebox SQLi' : 'N+1 Loop Spike'}
          </span>
        )}
      </div>

      {/* Action Controls - Clean Salesforce Blue & Neutrals */}
      <div className="flex items-center space-x-2 font-mono text-xs">
        <button
          type="button"
          onClick={onInitiateAttack}
          className="px-3.5 py-1.5 rounded-lg font-bold text-xs transition border cursor-pointer bg-[#0176D3] text-white border-[#0176D3] hover:bg-[#014486] active:scale-98 shadow-xs"
          title="Inject real-time SQL injection burst directly into Docker target container :8001"
        >
          Initiate Whitebox Attack
        </button>

        <button
          type="button"
          onClick={onReset}
          className="px-3.5 py-1.5 rounded border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-semibold transition active:scale-98 cursor-pointer"
          title="Reset traffic generation and reset weights"
        >
          Reset
        </button>

        <div className="h-4 w-px bg-zinc-200 mx-1" />

        <button
          type="button"
          onClick={onInvestigate}
          disabled={isInvestigating}
          className={cn(
            'px-3.5 py-1.5 rounded font-semibold text-xs transition border cursor-pointer',
            isInvestigating
              ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
              : 'bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50'
          )}
        >
          {isInvestigating ? 'Analyzing Incident...' : 'Run Gemma RCA'}
        </button>

        <button
          type="button"
          onClick={onExportReport}
          className="px-3 py-1.5 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition cursor-pointer"
        >
          Export Report
        </button>
      </div>
    </header>
  );
};
