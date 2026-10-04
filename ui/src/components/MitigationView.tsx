import React, { useState } from 'react';
import { Mitigation, RejectedOption, PreconditionCheck } from '../types';
import { CitationChip } from './CitationChip';
import {
  ShieldCheck,
  AlertOctagon,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  Sparkles,
  Ban,
  Activity,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { previewMitigation, executeMitigation, undoMitigation, subscribeMitigationVerify } from '../lib/api';

interface MitigationViewProps {
  mitigations: Mitigation[];
  rejectedOptions: RejectedOption[];
  onSelectCitation: (citation: string) => void;
  onMitigationExecuted?: (action: string) => void;
}

export const MitigationView: React.FC<MitigationViewProps> = ({
  mitigations = [],
  rejectedOptions = [],
  onSelectCitation,
  onMitigationExecuted
}) => {
  const safeMitigations = mitigations || [];
  const safeRejected = rejectedOptions || [];
  const [previewData, setPreviewData] = useState<{ action: string; diff: string; preconditions: PreconditionCheck[] } | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [activeMitigationId, setActiveMitigationId] = useState<string | null>(null);
  const [appliedAction, setAppliedAction] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<{
    running: boolean;
    samples: Array<{ step: number; p95_ms: number; err_rate: number }>;
    verdict: { status: string; p95_ms: number; err_rate: number; message: string } | null;
  }>({
    running: false,
    samples: [],
    verdict: null
  });

  const handlePreview = async (mit: Mitigation) => {
    try {
      const res = await previewMitigation(mit.action, mit.params || {});
      setPreviewData(res);
    } catch (err) {
      console.error('Preview error', err);
    }
  };

  const handleExecute = async (mit: Mitigation) => {
    setExecutingAction(mit.action);
    try {
      const res = await executeMitigation(mit.action, mit.params || {});
      setActiveMitigationId(res.id);
      setAppliedAction(mit.action);
      setPreviewData(null);
      onMitigationExecuted?.(mit.action);

      // Trigger automatic recovery verification stream
      setVerifyStatus({ running: true, samples: [], verdict: null });
      subscribeMitigationVerify(res.id, {
        onSample: (sample) => {
          setVerifyStatus((prev) => ({
            ...prev,
            samples: [...prev.samples, sample]
          }));
        },
        onVerdict: (verdict) => {
          setVerifyStatus((prev) => ({
            ...prev,
            running: false,
            verdict
          }));
        },
        onError: (err) => {
          setVerifyStatus((prev) => ({
            ...prev,
            running: false,
            verdict: { status: 'not_recovered', p95_ms: 8000, err_rate: 0.1, message: 'Verification timed out' }
          }));
        }
      });
    } catch (err) {
      console.error('Execute error', err);
    } finally {
      setExecutingAction(null);
    }
  };

  const handleUndo = async () => {
    if (!activeMitigationId) return;
    try {
      await undoMitigation(activeMitigationId);
      setAppliedAction(null);
      setActiveMitigationId(null);
      setVerifyStatus({ running: false, samples: [], verdict: null });
    } catch (err) {
      console.error('Undo error', err);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto p-6 select-text">
      {/* Recovery Verification Live Status Banner */}
      {(verifyStatus.running || verifyStatus.verdict) && (
        <div className="bg-[#111827] border border-blue-500/80 rounded-xl p-5 shadow-2xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Live Mitigation Recovery Verification (30s Window)
              </span>
            </div>
            {verifyStatus.verdict && (
              <span
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-mono font-bold uppercase',
                  verifyStatus.verdict.status === 'recovered'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-red-950 text-red-300 border border-red-800'
                )}
              >
                VERDICT: {verifyStatus.verdict.status}
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {verifyStatus.samples.map((s) => (
              <div
                key={s.step}
                className="bg-[#0B0F19] p-2 rounded border border-[#334155] text-xs font-mono"
              >
                <div className="text-slate-400 text-[10px]">T+{s.step * 5}s</div>
                <div className="text-cyan-400 font-bold">{Math.round(s.p95_ms)}ms</div>
                <div className="text-slate-300">{(s.err_rate * 100).toFixed(1)}% err</div>
              </div>
            ))}
          </div>

          {verifyStatus.verdict && (
            <div className="flex items-center justify-between pt-2 border-t border-[#334155]">
              <span className="text-xs text-slate-300">{verifyStatus.verdict.message}</span>
              <button
                type="button"
                onClick={handleUndo}
                className="px-3 py-1 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded text-xs font-mono font-semibold flex items-center space-x-1 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo Mitigation</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ranked Mitigations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
            Proposed Mitigation Actions (Ranked by Safety & Precision)
          </span>
          <span className="text-xs font-mono text-slate-400">
            Model proposes; Code verifies; Human approves
          </span>
        </div>

        {safeMitigations.length === 0 ? (
          <div className="bg-[#111827] border border-[#334155] rounded-xl p-8 text-center text-xs font-mono text-slate-400">
            No mitigations proposed yet. Start an investigation to generate code-verified actions.
          </div>
        ) : (
          <div className="space-y-4">
            {safeMitigations.map((mit) => {
              const isApplied = appliedAction === mit.action;
              const allPreconditionsSatisfied = mit.preconditions?.every(p => p.satisfied) ?? true;

              return (
                <div
                  key={mit.action}
                  className={cn(
                    'bg-[#111827] border rounded-xl p-5 shadow-lg space-y-4 transition',
                    isApplied
                      ? 'border-emerald-500/80 bg-[#111827]'
                      : 'border-[#334155] hover:border-slate-500'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                          #{mit.rank}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100">{mit.title}</h3>
                        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {mit.action}
                        </span>
                        {isApplied && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                            APPLIED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">{mit.rationale}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handlePreview(mit)}
                        className="px-3 py-1.5 rounded-lg border border-[#334155] bg-[#0B0F19] text-slate-300 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        disabled={!allPreconditionsSatisfied || executingAction === mit.action || isApplied}
                        onClick={() => handleExecute(mit)}
                        className={cn(
                          'px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-md',
                          !allPreconditionsSatisfied
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            : isApplied
                            ? 'bg-emerald-700 text-white cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        )}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{isApplied ? 'Executed' : 'Approve & Execute'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expected Effect & Risk */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#0B0F19] p-3 rounded-lg border border-[#334155]">
                    <div>
                      <span className="text-slate-400 font-semibold">Expected Effect: </span>
                      <span className="text-emerald-400">{mit.expected_effect}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold">Risk: </span>
                      <span className="text-amber-400">{mit.risk}</span>
                    </div>
                  </div>

                  {/* Preconditions Checklist (Code Computed) */}
                  {mit.preconditions && mit.preconditions.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Code-Enforced Preconditions Checklist
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 font-mono text-xs">
                        {mit.preconditions.map((p) => (
                          <div
                            key={p.name}
                            className={cn(
                              'p-2 rounded border flex items-center justify-between',
                              p.satisfied
                                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                                : 'bg-red-950/30 border-red-800/60 text-red-300'
                            )}
                          >
                            <span className="truncate">{p.name}: {p.detail}</span>
                            {p.satisfied ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 ml-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Diff Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#111827] border border-[#334155] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Execution Preview Diff ({previewData.action})</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <pre className="p-4 rounded-lg bg-[#0B0F19] border border-[#334155] font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap max-h-80">
              {previewData.diff}
            </pre>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejected Options / Not Recommended Section */}
      {safeRejected.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-[#334155]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center">
              <Ban className="w-4 h-4 mr-1.5 text-red-400" />
              Rejected Options / Not Recommended
            </span>
          </div>

          <div className="space-y-2">
            {safeRejected.map((opt) => (
              <div
                key={opt.action}
                className="p-3.5 rounded-lg bg-[#0B0F19] border border-red-900/60 flex flex-col space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs uppercase text-red-300">
                    {opt.action}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                    REJECTED BY VERIFIER
                  </span>
                </div>
                <p className="text-xs text-slate-300">{opt.why}</p>
                {opt.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {opt.citations.map((cite, idx) => (
                      <CitationChip key={idx} citation={cite} onClick={onSelectCitation} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
