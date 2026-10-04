import React, { useState } from 'react';
import { Finding, FindingVerdict } from '../types';
import { CitationChip } from './CitationChip';
import {
  Shield,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  Bug,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FindingsRailProps {
  findings: Finding[];
  findingVerdicts?: FindingVerdict[];
  onSelectCitation: (citation: string) => void;
}

export const FindingsRail: React.FC<FindingsRailProps> = ({
  findings = [],
  findingVerdicts = [],
  onSelectCitation
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<'all' | 'sast' | 'sca' | 'dast'>('all');
  const [decoysCollapsed, setDecoysCollapsed] = useState(true);

  const safeFindings = findings || [];
  const safeVerdicts = findingVerdicts || [];
  const verdictMap = new Map(safeVerdicts.map(v => [v.finding_id, v]));

  const filtered = safeFindings.filter(f => {
    const matchesSource = selectedSource === 'all' || f.source === selectedSource;
    const matchesSearch =
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.detail.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSource && matchesSearch;
  });

  const relatedFindings = filtered.filter(f => {
    const v = verdictMap.get(f.id);
    return v?.verdict === 'related' || (findingVerdicts.length === 0 && f.id === 'SAST-002');
  });

  const decoyFindings = filtered.filter(f => {
    const v = verdictMap.get(f.id);
    return v?.verdict === 'decoy' || (findingVerdicts.length > 0 && v?.verdict !== 'related');
  });

  return (
    <div className="w-96 h-full border-l border-[#334155] bg-[#111827] flex flex-col p-4 space-y-4 overflow-y-auto select-none">
      {/* Title & Funnel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Security Findings Rail
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
          <span className="px-2 py-0.5 rounded bg-[#0B0F19] text-amber-300 border border-[#334155]">
            {findings.length} total
          </span>
          {findingVerdicts.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 animate-pulse">
              {relatedFindings.length} implicated
            </span>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter findings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0B0F19] border border-[#334155] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-1">
          {(['all', 'sast', 'sca', 'dast'] as const).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelectedSource(src)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-mono uppercase transition flex-1 text-center',
                selectedSource === src
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-[#0B0F19] text-slate-400 border border-[#334155] hover:text-white'
              )}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      {/* Implicated / Related Findings (Funneled) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span className="flex items-center text-red-400">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Implicated Root Cause Findings
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ({relatedFindings.length})
          </span>
        </div>

        {relatedFindings.length === 0 ? (
          <div className="bg-[#0B0F19] border border-[#334155] rounded-lg p-3 text-center text-xs text-slate-400 font-mono">
            No related findings funneled yet
          </div>
        ) : (
          <div className="space-y-2">
            {relatedFindings.map((f) => {
              const verdict = verdictMap.get(f.id);
              return (
                <div
                  key={f.id}
                  className="p-3 rounded-lg bg-[#1E293B] border border-red-500/80 shadow-lg space-y-2 transition-all animate-funnel"
                >
                  <div className="flex items-center justify-between">
                    <CitationChip citation={f.id} onClick={onSelectCitation} />
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                      {f.severity}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-100">{f.title}</h3>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    {f.location}
                  </div>

                  {verdict?.reason && (
                    <div className="text-xs text-red-300 bg-red-950/40 p-2 rounded border border-red-900/60 font-sans">
                      <span className="font-semibold">Implication: </span>
                      {verdict.reason}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-700">
                    <span>Present in: {f.present_in.join(', ')}</span>
                    <span className="text-emerald-400">VERIFIED</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decoys / Other Findings (Collapsible Funnel) */}
      <div className="space-y-2 pt-2 border-t border-[#334155]">
        <button
          type="button"
          onClick={() => setDecoysCollapsed(!decoysCollapsed)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
        >
          <span className="flex items-center">
            {decoysCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 mr-1 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 mr-1 text-slate-500" />
            )}
            Decoy & Unrelated Findings ({decoyFindings.length})
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {decoysCollapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>

        {!decoysCollapsed && (
          <div className="space-y-2">
            {decoyFindings.map((f) => {
              const verdict = verdictMap.get(f.id);
              return (
                <div
                  key={f.id}
                  className="p-2.5 rounded-lg bg-[#0B0F19] border border-[#334155] opacity-80 hover:opacity-100 transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <CitationChip citation={f.id} onClick={onSelectCitation} />
                    <span className="text-[10px] font-mono text-slate-400">
                      {f.source.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-300 truncate">{f.title}</div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">{f.location}</div>

                  {verdict?.reason && (
                    <div className="text-[11px] text-slate-400 bg-slate-900 p-1.5 rounded border border-slate-800">
                      <span className="text-amber-400">Decoy reason: </span>
                      {verdict.reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
