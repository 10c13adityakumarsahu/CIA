import React from 'react';
import { Report, VerificationResult, ToolCallEvent, ToolResultEvent } from '../types';
import { CitationChip } from './CitationChip';
import { CulpritCodeSnippetCard } from './CulpritCodeSnippetCard';
import {
  Terminal,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  FileSearch,
  Check,
  Sparkles,
  Layers,
  Activity
} from 'lucide-react';
import { cn } from '../lib/utils';

interface InvestigationFeedProps {
  events: Array<{ type: string; data: any }>;
  report: Report | null;
  verification: VerificationResult | null;
  isInvestigating: boolean;
  onSelectCitation: (citation: string) => void;
  scenario?: string | null;
}

export const InvestigationFeed: React.FC<InvestigationFeedProps> = ({
  events = [],
  report,
  verification,
  isInvestigating,
  onSelectCitation,
  scenario
}) => {
  const activeScenario = scenario || (report?.verdict === 'regression' ? 'b_regression' : 'a_exploit');

  return (
    <div className="h-full flex flex-col space-y-5 overflow-y-auto p-6 select-text">
      {/* Offending Code Snippet & Gemma Suggested Fix */}
      <CulpritCodeSnippetCard
        scenario={activeScenario}
        onSelectCitation={onSelectCitation}
      />

      {/* Incident Summary Card if report exists */}
      {report && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider',
                    report.verdict === 'exploit'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : report.verdict === 'regression'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  )}
                >
                  VERDICT: {report.verdict}
                </span>

                {report.owasp && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-purple-100 text-purple-800 border border-purple-200">
                    OWASP: {report.owasp}
                  </span>
                )}

                {verification?.valid && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Code-Verified ({(verification as any)?.citations_valid ?? verification?.verified_citations?.length ?? 0} citations)
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 pt-1">
                Incident Root Cause Synthesis
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed font-sans bg-slate-50 p-4 rounded-lg border border-slate-200">
            {report.incident_summary}
          </p>

          {/* Competing Hypotheses Grid */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Competing Hypotheses Evaluation
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(report.hypotheses || []).map((hyp) => {
                const isWinner = hyp.label === report.verdict;
                const supporting = hyp.supporting || [];
                const contradicting = hyp.contradicting || [];
                return (
                  <div
                    key={hyp.label}
                    className={cn(
                      'p-4 rounded-xl border flex flex-col space-y-2.5 transition',
                      isWinner
                        ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 opacity-80'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs uppercase text-slate-900">
                        {hyp.label}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold',
                          hyp.confidence === 'high'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : hyp.confidence === 'medium'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                        )}
                      >
                        {hyp.confidence} confidence
                      </span>
                    </div>

                    {/* Supporting */}
                    {supporting.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] text-emerald-700 font-bold">Supporting Citations:</span>
                        <div className="flex flex-wrap gap-1">
                          {supporting.map((cite, idx) => (
                            <CitationChip key={idx} citation={cite} onClick={onSelectCitation} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contradicting */}
                    {contradicting.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] text-red-700 font-bold">Contradicting Citations:</span>
                        <div className="flex flex-wrap gap-1">
                          {contradicting.map((cite, idx) => (
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center">
            <Terminal className="w-4 h-4 mr-1.5 text-blue-600" />
            Gemma 4 Autonomous Tool Execution & Reasoning Stream
          </span>
          {isInvestigating && (
            <span className="text-xs font-mono font-bold text-blue-600 flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-600 mr-1.5 animate-ping" />
              Correlating evidence across tools...
            </span>
          )}
        </div>

        {events.length === 0 && !isInvestigating && (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            No active investigation stream. Select a scenario on the left sidebar and click "Investigate Incident" to begin correlation.
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
                  className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-blue-900">
                    <span className="font-bold flex items-center">
                      <FileSearch className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      TOOL CALL: {tool}
                    </span>
                    <span className="text-[10px] text-slate-500">Step #{index + 1}</span>
                  </div>
                  <pre className="text-slate-800 text-[11px] bg-white p-2.5 rounded border border-slate-200 overflow-x-auto">
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
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="font-bold flex items-center">
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      RESULT: {tool}
                    </span>
                  </div>
                  <pre className="text-slate-700 text-[11px] bg-white p-2.5 rounded border border-slate-200 overflow-x-auto max-h-40">
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
