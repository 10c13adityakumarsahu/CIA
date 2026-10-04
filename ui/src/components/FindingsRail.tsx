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
  AlertTriangle,
  FileCode,
  CheckCircle2,
  ExternalLink
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

  const safeFindings = findings || [];
  const safeVerdicts = findingVerdicts || [];
  const verdictMap = new Map(safeVerdicts.map((v) => [v.finding_id, v]));

  const filtered = safeFindings.filter((f) => {
    const matchesSource = selectedSource === 'all' || f.source === selectedSource;
    const matchesSearch =
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.detail.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSource && matchesSearch;
  });

  return (
    <div className="flex flex-col space-y-4 select-none">
      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-zinc-100">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-black" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Multi-Vector Scans & Vulnerability Ingestion
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[11px] font-mono font-bold">
            {safeFindings.length} Total CVEs/CWEs
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search CVE, CWE, file, rule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 bg-zinc-50 border border-zinc-200 rounded pl-8 pr-3 py-1 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black transition font-mono"
            />
          </div>

          <div className="flex bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs font-mono">
            {(['all', 'sast', 'sca', 'dast'] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSelectedSource(src)}
                className={cn(
                  'px-2.5 py-0.5 rounded transition uppercase',
                  selectedSource === src
                    ? 'bg-black text-white font-bold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Findings Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.map((f) => {
          const verdict = verdictMap.get(f.id);
          const isImplicated = verdict?.verdict === 'related' || f.id === 'SAST-002' || f.title.includes('SQL');
          const isSca = f.source === 'sca';
          const isDast = f.source === 'dast';

          return (
            <div
              key={f.id}
              className={cn(
                'p-4 rounded-lg border transition space-y-2.5 bg-white shadow-xs',
                isImplicated
                  ? 'border-black ring-1 ring-black'
                  : 'border-zinc-200 hover:border-zinc-300'
              )}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <CitationChip citation={f.id} onClick={onSelectCitation} />
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-bold">
                    {f.source}
                  </span>
                  {isImplicated && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black text-white font-bold">
                      Implicated
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Location */}
              <div>
                <h4 className="text-xs font-bold text-zinc-900 leading-snug line-clamp-1">{f.title}</h4>
                <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                  {f.location}
                </div>
              </div>

              {/* Detail snippet */}
              <p className="text-xs text-zinc-600 font-sans line-clamp-2 leading-relaxed">
                {f.detail}
              </p>

              {/* Verdict Rationale if available */}
              {verdict?.reason && (
                <div className="text-[11px] bg-zinc-50 border border-zinc-200 p-2 rounded text-zinc-800 font-mono">
                  <span className="font-bold text-black">Gemma Correlation: </span>
                  {verdict.reason}
                </div>
              )}

              {/* Card Footer */}
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-100">
                <span>Present in: {f.present_in.join(', ')}</span>
                <span className="font-semibold text-zinc-900">
                  {f.cwe?.length ? f.cwe.join(', ') : f.severity}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
