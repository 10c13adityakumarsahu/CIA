import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  GitCompare,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileCode,
  Search,
  Check,
  Zap,
  Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CitationChip } from './CitationChip';

interface PipelineStep {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  status: 'pending' | 'running' | 'completed';
  details: string[];
  citation?: string;
  diffSnippet?: string;
}

interface IncidentAnalysisPipelineTimelineProps {
  isInvestigating: boolean;
  hasReport: boolean;
  onSelectCitation?: (citation: string) => void;
  scenario?: string | null;
}

export const IncidentAnalysisPipelineTimeline: React.FC<IncidentAnalysisPipelineTimelineProps> = ({
  isInvestigating,
  hasReport,
  onSelectCitation,
  scenario
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  useEffect(() => {
    if (isInvestigating) {
      setActiveStepIndex(1);
      const t1 = setTimeout(() => setActiveStepIndex(2), 1500);
      const t2 = setTimeout(() => setActiveStepIndex(3), 3200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (hasReport) {
      setActiveStepIndex(4);
    } else {
      setActiveStepIndex(0);
    }
  }, [isInvestigating, hasReport]);

  const steps: PipelineStep[] = [
    {
      id: 'scans',
      title: '1. Multi-Vector Security Scanners',
      subtitle: 'SAST, SCA & DAST Ingestion across releases',
      icon: Search,
      status: activeStepIndex > 1 || hasReport ? 'completed' : activeStepIndex === 1 ? 'running' : 'pending',
      details: [
        'SAST (Semgrep AST): Found CWE-89 raw string interpolation in orders()',
        'SCA (pip-audit): Analyzed urllib3 (CVE-2024-41123 decoy check)',
        'DAST (Nikto/ZAP): Detected time-based SQL injection on POST /api/orders'
      ],
      citation: 'SAST-002'
    },
    {
      id: 'git_diff',
      title: '2. Git Code Block Difference & AST Taint',
      subtitle: 'Isolating release diff between v1.4.0 (LKG) and v1.5.0',
      icon: GitCompare,
      status: activeStepIndex > 2 || hasReport ? 'completed' : activeStepIndex === 2 ? 'running' : 'pending',
      details: [
        'Diff isolated in target_app/v1.5.0/app.py:53',
        '- v1.4.0: Parameterized cursor.execute("SELECT * FROM orders WHERE sku = %s", (sku,))',
        '+ v1.5.0: Vulnerable regression cursor.execute(f"SELECT * FROM orders WHERE sku = \'{sku}\'")'
      ],
      citation: 'FILE:target_app/v1.5.0/app.py:53',
      diffSnippet: `- query = "SELECT * FROM orders WHERE sku = %s"\n- c.execute(query, (sku,))\n+ query = f"SELECT * FROM orders WHERE sku = '{sku}'"\n+ c.execute(query)`
    },
    {
      id: 'gemma_rca',
      title: '3. Gemma 4 Tool-Calling Agent Loop',
      subtitle: 'Autonomous reasoning, log correlation & blast radius querying',
      icon: Sparkles,
      status: activeStepIndex > 3 || hasReport ? 'completed' : activeStepIndex === 3 ? 'running' : 'pending',
      details: [
        'Executed tool: search_logs(query="pg_sleep") ➔ Matched LOG-0001 attacker payload',
        'Executed tool: blast_radius(finding_id="SAST-002") ➔ Postgres connection pool exhausted',
        'Evaluated hypotheses: Exploit (High 98%), Regression (Low 12%), Infra (Low 5%)'
      ],
      citation: 'LOG-0001'
    },
    {
      id: 'synthesis',
      title: '4. Decision Synthesis & Code-Verified Mitigations',
      subtitle: 'Deterministic preconditions & 1-click safe rollback target',
      icon: CheckCircle2,
      status: hasReport ? 'completed' : 'pending',
      details: [
        'Root Cause Verdict: EXPLOIT (A03:2021-Injection)',
        'Precondition check: Target v1.4.0 verified free of implicated CVEs (LKG confirmed)',
        'Mitigation options ranked & ready for execution'
      ],
      citation: 'GRAPH:table:customers'
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Autonomous Incident Investigation Pipeline
            </h3>
            <p className="text-xs text-slate-500">
              Live progression: Security Scanners ➔ Git Code Diff ➔ Gemma 4 Agent ➔ Recovery
            </p>
          </div>
        </div>

        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-mono font-bold border flex items-center space-x-1.5',
            isInvestigating
              ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
              : hasReport
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          )}
        >
          {isInvestigating ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>Analyzing Pipeline Active</span>
            </>
          ) : hasReport ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pipeline Synthesized</span>
            </>
          ) : (
            <span>Ready for Analysis</span>
          )}
        </span>
      </div>

      {/* Timeline Steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = step.status === 'completed';
          const isRunning = step.status === 'running';

          return (
            <div
              key={step.id}
              className={cn(
                'p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between space-y-2.5',
                isDone
                  ? 'bg-emerald-50/60 border-emerald-200 shadow-xs'
                  : isRunning
                  ? 'bg-blue-50/70 border-blue-300 shadow-sm ring-1 ring-blue-400/30'
                  : 'bg-slate-50/50 border-slate-200 opacity-60'
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold font-mono',
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isRunning
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                    </div>
                    <span className="font-bold text-slate-900 text-xs truncate max-w-[150px]">
                      {step.title}
                    </span>
                  </div>
                  {isRunning && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
                </div>

                <p className="text-[11px] text-slate-500 font-sans leading-relaxed mb-2">
                  {step.subtitle}
                </p>

                {/* Details List */}
                <div className="space-y-1 text-[10px] text-slate-600 font-mono bg-white p-2 rounded-lg border border-slate-200/80">
                  {step.details.map((d, dIdx) => (
                    <div key={dIdx} className="flex items-start space-x-1 leading-tight">
                      <span className="text-blue-500 shrink-0">•</span>
                      <span className="truncate">{d}</span>
                    </div>
                  ))}
                </div>

                {/* Optional Diff Box */}
                {step.diffSnippet && (
                  <div className="mt-2 bg-slate-950 p-2 rounded border border-slate-800 text-[10px] font-mono text-slate-200 overflow-x-auto leading-snug">
                    <div className="text-[9px] text-slate-400 uppercase mb-1">Git Diff Block:</div>
                    <pre className="text-red-400 whitespace-pre">{step.diffSnippet.split('\n').slice(0, 2).join('\n')}</pre>
                    <pre className="text-emerald-400 whitespace-pre">{step.diffSnippet.split('\n').slice(2).join('\n')}</pre>
                  </div>
                )}
              </div>

              {step.citation && onSelectCitation && (
                <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-slate-400">Citation:</span>
                  <CitationChip citation={step.citation} onClick={onSelectCitation} className="text-[10px]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
