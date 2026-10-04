import React from 'react';
import { Report, VerificationResult, ToolCallEvent, ToolResultEvent } from '../types';
import { CitationChip } from './CitationChip';
import {
  Terminal,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Layers,
  FileSearch,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';

interface InvestigationFeedProps {
  events: Array<{ type: string; data: any }>;
  report: Report | null;
  verification: VerificationResult | null;
  isInvestigating: boolean;
  onSelectCitation: (citation: string) => void;
}

export const InvestigationFeed: React.FC<InvestigationFeedProps> = ({
  events,
  report,
  verification,
  isInvestigating,
  onSelectCitation
}) => {
  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto p-6 select-text">
      {/* Incident Summary Card if report exists */}
      {report && (
        <div className="bg-[#111827] border border-[#334155] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider',
                    report.verdict === 'exploit'
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : report.verdict === 'regression'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-blue-950 text-blue-300 border border-blue-800'
                  )}
                >
                  VERDICT: {report.verdict}
                </span>

                {report.owasp && (
                  <span className="px-2.5 py-1 rounded text-xs font-mono bg-purple-950 text-purple-300 border border-purple-800">
                    OWASP: {report.owasp}
                  </span>
                )}

                {verification?.valid && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Code-Verified ({verification.verified_citations.length} citations)
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-100 pt-1">
                Incident Root Cause Synthesis
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed font-sans bg-[#0B0F19] p-4 rounded-lg border border-[#334155]">
            {report.incident_summary}
          </p>

          {/* Competing Hypotheses Grid */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Competing Hypotheses Evaluation
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.hypotheses.map((hyp) => {
                const isWinner = hyp.label === report.verdict;
                return (
                  <div
                    key={hyp.label}
                    className={cn(
                      'p-3.5 rounded-lg border flex flex-col space-y-2',
                      isWinner
                        ? 'bg-[#1E293B] border-blue-500/80 shadow-md'
                        : 'bg-[#0B0F19] border-[#334155] opacity-75'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs uppercase text-slate-200">
                        {hyp.label}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-mono uppercase px-2 py-0.5 rounded border',
                          hyp.confidence === 'high'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : hyp.confidence === 'medium'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        )}
                      >
                        {hyp.confidence} confidence
                      </span>
                    </div>

                    {/* Supporting */}
                    {hyp.supporting.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] text-emerald-400 font-semibold">Supporting:</span>
                        <div className="flex flex-wrap gap-1">
                          {hyp.supporting.map((cite, idx) => (
                            <CitationChip key={idx} citation={cite} onClick={onSelectCitation} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contradicting */}
                    {hyp.contradicting.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] text-red-400 font-semibold">Contradicting:</span>
                        <div className="flex flex-wrap gap-1">
                          {hyp.contradicting.map((cite, idx) => (
                            <CitationChip key={idx} citation={cite} onClick={onSelectCitation} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Autonomous Agent Tool Execution Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
            <Terminal className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            Agent Tool Execution & Reasoning Stream
          </span>
          {isInvestigating && (
            <span className="text-xs font-mono text-cyan-400 flex items-center animate-pulse">
              <span className="w-2 h-2 rounded-full bg-cyan-400 mr-1.5 animate-ping" />
              Investigating tools...
            </span>
          )}
        </div>

        {events.length === 0 && !isInvestigating && (
          <div className="bg-[#111827] border border-[#334155] rounded-lg p-8 text-center text-slate-400 font-mono text-xs">
            No active investigation stream. Select a scenario above and click "Investigate Incident" to start correlating.
          </div>
        )}

        <div className="space-y-2 font-mono text-xs">
          {events.map((ev, index) => {
            if (ev.type === 'tool_call') {
              const tool = ev.data.tool || ev.data.tool_name;
              const args = ev.data.args || ev.data.arguments || {};
              return (
                <div
                  key={index}
                  className="bg-[#111827] border border-cyan-900/60 rounded-lg p-3 space-y-1 shadow-sm"
                >
                  <div className="flex items-center justify-between text-cyan-300">
                    <span className="font-bold flex items-center">
                      <FileSearch className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                      CALL: {tool}
                    </span>
                    <span className="text-[10px] text-slate-500">Step #{index + 1}</span>
                  </div>
                  <pre className="text-slate-300 text-[11px] bg-[#0B0F19] p-2 rounded border border-[#1E293B] overflow-x-auto">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              );
            }

            if (ev.type === 'tool_result') {
              const tool = ev.data.tool || 'result';
              const res = ev.data.result;
              return (
                <div
                  key={index}
                  className="bg-[#0B0F19] border border-slate-700/60 rounded-lg p-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="font-bold flex items-center">
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                      RESULT: {tool}
                    </span>
                  </div>
                  <pre className="text-slate-400 text-[11px] bg-[#111827] p-2 rounded border border-[#1E293B] overflow-x-auto max-h-40">
                    {typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res)}
                  </pre>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};
