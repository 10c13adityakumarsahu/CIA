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

  let icon = <FileText className="w-3 h-3 mr-1 text-slate-400" />;
  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700';

  if (cit.startsWith('LOG-')) {
    icon = <Activity className="w-3 h-3 mr-1 text-cyan-400" />;
    badgeColor = 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80 hover:bg-cyan-900/80';
  } else if (cit.startsWith('SAST-') || cit.startsWith('SCA-') || cit.startsWith('DAST-')) {
    icon = <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" />;
    badgeColor = 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/80';
  } else if (cit.startsWith('FILE:')) {
    icon = <FileCode className="w-3 h-3 mr-1 text-emerald-400" />;
    badgeColor = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/80';
  } else if (cit.startsWith('GRAPH:')) {
    icon = <Database className="w-3 h-3 mr-1 text-purple-400" />;
    badgeColor = 'bg-purple-950/60 text-purple-300 border-purple-800/80 hover:bg-purple-900/80';
  } else if (cit.startsWith('DIFF:') || cit.startsWith('REL:')) {
    icon = <GitCommit className="w-3 h-3 mr-1 text-blue-400" />;
    badgeColor = 'bg-blue-950/60 text-blue-300 border-blue-800/80 hover:bg-blue-900/80';
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(cit)}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border transition-all cursor-pointer select-none shadow-sm',
        badgeColor,
        className
      )}
      title={`Inspect citation ${cit}`}
    >
      {icon}
      <span>{cit}</span>
    </button>
  );
};
