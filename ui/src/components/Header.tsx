import React from 'react';
import { Play, RotateCcw, ShieldAlert, Cpu, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  mode: 'LIVE' | 'REPLAY';
  activeScenario: string | null;
  isInvestigating: boolean;
  onSelectScenario: (scenario: 'a_exploit' | 'b_regression') => void;
  onReset: () => void;
  onInvestigate: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  activeScenario,
  isInvestigating,
  onSelectScenario,
  onReset,
  onInvestigate,
}) => {
  return (
    <header className="h-16 border-b border-[#334155] bg-[#111827] px-6 flex items-center justify-between z-20 select-none shadow-md">
      {/* Brand & Mode */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg">
            C
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-white text-base">CULPRIT</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                v1.5.0
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Automated Root-Cause Correlation & Mitigation Engine
            </div>
          </div>
        </div>

        {/* Mode Badge */}
        <div className="flex items-center space-x-2 pl-4 border-l border-[#334155]">
          <div
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center space-x-1.5 border',
              mode === 'LIVE'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-amber-950/80 text-amber-300 border-amber-800'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                mode === 'LIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              )}
            />
            <span>{mode} MODE</span>
          </div>

          <div className="text-xs px-2.5 py-1 rounded bg-slate-800/80 text-slate-400 border border-slate-700/80 italic">
            "Hypothesis, not proven until verified"
          </div>
        </div>
      </div>

      {/* Scenario Controls & Actions */}
      <div className="flex items-center space-x-3">
        {/* Scenario Selectors */}
        <div className="flex items-center bg-[#0B0F19] p-1 rounded-lg border border-[#334155] space-x-1">
          <button
            type="button"
            onClick={() => onSelectScenario('a_exploit')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition',
              activeScenario === 'a_exploit'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Scenario A (Exploit)</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectScenario('b_regression')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition',
              activeScenario === 'b_regression'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            )}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Scenario B (Regression)</span>
          </button>
        </div>

        {/* Reset Button */}
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 rounded-lg border border-[#334155] bg-[#1E293B] text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-medium flex items-center space-x-1.5 transition"
          title="Reset scenario and restore weights"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        {/* Investigate Action */}
        <button
          type="button"
          onClick={onInvestigate}
          disabled={isInvestigating}
          className={cn(
            'px-4 py-1.5 rounded-lg font-semibold text-xs flex items-center space-x-2 transition shadow-lg',
            isInvestigating
              ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed animate-pulse'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          <Sparkles className={cn('w-4 h-4', isInvestigating && 'animate-spin')} />
          <span>{isInvestigating ? 'Correlating...' : 'Investigate Incident'}</span>
        </button>
      </div>
    </header>
  );
};
