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
  mitigations?: Mitigation[];
  rejectedOptions?: RejectedOption[];
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
    <div className="h-full flex flex-col space-y-5 overflow-y-auto p-6 select-text">
      {/* Recovery Verification Live Status Banner */}
      {(verifyStatus.running || verifyStatus.verdict) && (
        <div className="bg-white border border-blue-300 rounded-xl p-5 shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Live Mitigation Recovery Verification (30s Telemetry Window)
              </span>
            </div>
            {verifyStatus.verdict && (
              <span
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-mono font-bold uppercase',
                  verifyStatus.verdict.status === 'recovered'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
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
                className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-mono"
              >
                <div className="text-slate-500 text-[10px]">T+{s.step * 5}s</div>
                <div className="text-blue-600 font-bold">{Math.round(s.p95_ms)}ms</div>
                <div className="text-slate-600">{(s.err_rate * 100).toFixed(1)}% err</div>
              </div>
            ))}
          </div>

          {verifyStatus.verdict && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-700 font-medium">{verifyStatus.verdict.message}</span>
              <button
                type="button"
                onClick={handleUndo}
                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md text-xs font-mono font-semibold flex items-center space-x-1 transition cursor-pointer"
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
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
            Proposed Mitigation Actions (Ranked by Safety & Precision)
          </span>
          <span className="text-xs font-mono text-slate-500">
            Model proposes; Code verifies; Human approves
          </span>
        </div>

        {safeMitigations.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs font-mono text-slate-500 shadow-xs">
            No mitigations proposed yet. Start an investigation to generate code-verified actions.
          </div>
        ) : (
          <div className="space-y-3.5">
            {safeMitigations.map((mit) => {
              const isApplied = appliedAction === mit.action;
              const allPreconditionsSatisfied = mit.preconditions?.every(p => p.satisfied) ?? true;

              return (
                <div
                  key={mit.action}
                  className={cn(
                    'bg-white border rounded-xl p-5 shadow-xs space-y-4 transition',
                    isApplied
                      ? 'border-emerald-500 ring-2 ring-emerald-100'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                          #{mit.rank}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">{mit.title}</h3>
                        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {mit.action}
                        </span>
                        {isApplied && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                            APPLIED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{mit.rationale}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handlePreview(mit)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-medium flex items-center space-x-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        disabled={!allPreconditionsSatisfied || executingAction === mit.action || isApplied}
                        onClick={() => handleExecute(mit)}
                        className={cn(
                          'px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-xs',
                          !allPreconditionsSatisfied
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : isApplied
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                        )}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{isApplied ? 'Executed' : 'Approve & Execute'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expected Effect & Risk */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 font-semibold">Expected Effect: </span>
                      <span className="text-emerald-700 font-medium">{mit.expected_effect}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold">Risk Assessment: </span>
                      <span className="text-amber-700 font-medium">{mit.risk}</span>
                    </div>
                  </div>

                  {/* Preconditions Checklist */}
                  {mit.preconditions && mit.preconditions.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Code-Enforced Preconditions Checklist
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 font-mono text-xs">
                        {mit.preconditions.map((p) => (
                          <div
                            key={p.name}
                            className={cn(
                              'p-2 rounded-lg border flex items-center justify-between',
                              p.satisfied
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                                : 'bg-red-50/80 border-red-200 text-red-800'
                            )}
                          >
                            <span className="truncate">{p.name}: {p.detail}</span>
                            {p.satisfied ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-2" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 ml-2" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>Execution Preview Diff ({previewData.action})</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <pre className="p-4 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap max-h-80">
              {previewData.diff}
            </pre>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejected Options */}
      {safeRejected.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center">
              <Ban className="w-4 h-4 mr-1.5 text-red-600" />
              Rejected Options (Guardrail Enforcement)
            </span>
          </div>

          <div className="space-y-2">
            {safeRejected.map((opt) => (
              <div
                key={opt.action}
                className="p-3.5 rounded-lg bg-red-50/60 border border-red-200 flex flex-col space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs uppercase text-red-800">
                    {opt.action}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 font-bold">
                    REJECTED BY VERIFIER
                  </span>
                </div>
                <p className="text-xs text-slate-700">{opt.why}</p>
                {opt.citations && opt.citations.length > 0 && (
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
