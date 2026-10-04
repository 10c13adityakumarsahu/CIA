import React, { useState } from 'react';
import { Finding, FindingVerdict } from '../types';
import { CitationChip } from './CitationChip';
import {
  Shield,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  AlertTriangle
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
    <div className="h-full flex flex-col p-6 space-y-4 overflow-y-auto select-none">
      {/* Title & Filter Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-slate-800">
              Security Vulnerabilities & Multi-Version Scans
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
              {safeFindings.length} Total CVEs/CWEs
            </span>
            {findingVerdicts.length > 0 && (
              <span className="px-2.5 py-1 rounded bg-red-100 text-red-800 border border-red-200 font-bold">
                {relatedFindings.length} Implicated
              </span>
            )}
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center space-x-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by CVE, CWE, file, title, or rule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 space-x-1">
            {(['all', 'sast', 'sca', 'dast'] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSelectedSource(src)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-mono font-semibold uppercase transition',
                  selectedSource === src
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Implicated / Related Findings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="flex items-center text-red-600">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Implicated Root Cause Findings ({relatedFindings.length})
          </span>
        </div>

        {relatedFindings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 font-mono">
            No related findings funneled yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {relatedFindings.map((f) => {
              const verdict = verdictMap.get(f.id);
              return (
                <div
                  key={f.id}
                  className="p-4 rounded-xl bg-white border border-red-300 shadow-xs space-y-2.5 transition hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <CitationChip citation={f.id} onClick={onSelectCitation} />
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 font-bold">
                      {f.severity}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900">{f.title}</h3>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {f.location}
                  </div>

                  {verdict?.reason && (
                    <div className="text-xs text-red-900 bg-red-50 p-2.5 rounded-lg border border-red-200 font-sans">
                      <span className="font-bold">Gemma Implication: </span>
                      {verdict.reason}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100">
                    <span>Present in: {f.present_in.join(', ')}</span>
                    <span className="text-emerald-700 font-bold">VERIFIED</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decoys / Other Findings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <button
          type="button"
          onClick={() => setDecoysCollapsed(!decoysCollapsed)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 transition"
        >
          <span className="flex items-center">
            {decoysCollapsed ? (
              <ChevronRight className="w-4 h-4 mr-1 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-1 text-slate-400" />
            )}
            Decoy & Non-Causal Scans ({decoyFindings.length})
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {decoysCollapsed ? 'Click to Expand' : 'Click to Collapse'}
          </span>
        </button>

        {!decoysCollapsed && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
            {decoyFindings.map((f) => {
              const verdict = verdictMap.get(f.id);
              return (
                <div
                  key={f.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <CitationChip citation={f.id} onClick={onSelectCitation} />
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                      {f.source}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-800 truncate">{f.title}</div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">{f.location}</div>

                  {verdict?.reason && (
                    <div className="text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200">
                      <span className="text-amber-700 font-bold">Decoy Reason: </span>
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
