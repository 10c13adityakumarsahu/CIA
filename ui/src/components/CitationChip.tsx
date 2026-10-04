import React from 'react';
import { cn } from '../lib/utils';
import { FileCode, Database, GitCommit, AlertTriangle, FileText, Activity } from 'lucide-react';

interface CitationChipProps {
  citation: string;
  onClick?: (citation: string) => void;
  className?: string;
}

export const CitationChip: React.FC<CitationChipProps> = ({ citation, onClick, className }) => {
  const cit = citation.trim();

  let icon = <FileText className="w-3 h-3 mr-1 text-slate-500" />;
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';

  if (cit.startsWith('LOG-')) {
    icon = <Activity className="w-3 h-3 mr-1 text-cyan-600" />;
    badgeColor = 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100';
  } else if (cit.startsWith('SAST-') || cit.startsWith('SCA-') || cit.startsWith('DAST-')) {
    icon = <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />;
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
  } else if (cit.startsWith('FILE:')) {
    icon = <FileCode className="w-3 h-3 mr-1 text-emerald-600" />;
    badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
  } else if (cit.startsWith('GRAPH:')) {
    icon = <Database className="w-3 h-3 mr-1 text-purple-600" />;
    badgeColor = 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100';
  } else if (cit.startsWith('DIFF:') || cit.startsWith('REL:')) {
    icon = <GitCommit className="w-3 h-3 mr-1 text-blue-600" />;
    badgeColor = 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100';
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(cit)}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border transition-all cursor-pointer select-none shadow-2xs max-w-full overflow-hidden shrink-0',
        badgeColor,
        className
      )}
      title={`Inspect citation ${cit}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate max-w-[120px]">{cit}</span>
    </button>
  );
};
