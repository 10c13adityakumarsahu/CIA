import React from 'react';
import { Sparkles, FileText, Download, ShieldAlert, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  mode: 'LIVE' | 'REPLAY';
  activeScenario: string | null;
  isInvestigating: boolean;
  onInvestigate: () => void;
  onExportReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  activeScenario,
  isInvestigating,
  onInvestigate,
  onExportReport,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 select-none shrink-0 shadow-xs">
      {/* Title & Active Context */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-800 text-sm">Incident Investigation & Decision Support</span>
          {activeScenario && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-mono font-semibold border flex items-center space-x-1',
                activeScenario === 'a_exploit'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              )}
            >
              {activeScenario === 'a_exploit' ? (
                <>
                  <ShieldAlert className="w-3 h-3 text-red-500" />
                  <span>Active: Scenario A (SQLi Exploit)</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3 h-3 text-amber-500" />
                  <span>Active: Scenario B (N+1 Regression)</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Primary Actions */}
      <div className="flex items-center space-x-2.5">
        <button
          type="button"
          onClick={onExportReport}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center space-x-1.5 transition shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Audit Report</span>
        </button>

        <button
          type="button"
          onClick={onInvestigate}
          disabled={isInvestigating}
          className={cn(
            'px-4 py-1.5 rounded-lg font-semibold text-xs flex items-center space-x-2 transition shadow-sm',
            isInvestigating
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98'
          )}
        >
          <Sparkles className={cn('w-3.5 h-3.5', isInvestigating && 'animate-spin')} />
          <span>{isInvestigating ? 'Correlating Evidence...' : 'Investigate Incident'}</span>
        </button>
      </div>
    </header>
  );
};
