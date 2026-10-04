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
      id: 'decision',
      title: '4. Decision Synthesis & Rollback Plan',
      subtitle: 'Deterministic preconditions & 1-click safe rollback target',
      icon: CheckCircle2,
      status: hasReport ? 'completed' : 'pending',
      details: [
        'Root Cause Verdict: EXPLOIT (A03:2021-SQL Injection)',
        'Precondition check: Target v1.4.0 verified clean in Redis release ledger',
        'Mitigation options ranked & ready for 1-click execution'
      ],
      citation: 'GRAPH:table:customers'
    }
  ];

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-black" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900">
            Autonomous Incident Investigation Pipeline
          </h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-semibold">
          {hasReport ? 'Pipeline Synthesized' : isInvestigating ? 'Gemma Correlating Live Evidence...' : 'Pipeline Ready'}
        </span>
      </div>

      {/* 4 Pipeline Step Cards in Monochrome */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const isCurrent = step.status === 'running';
          const isDone = step.status === 'completed';

          return (
            <div
              key={step.id}
              className={cn(
                'rounded-lg border p-3.5 flex flex-col justify-between space-y-2.5 transition',
                isCurrent
                  ? 'border-black bg-zinc-50 shadow-xs'
                  : isDone
                  ? 'border-zinc-300 bg-white'
                  : 'border-zinc-200 bg-zinc-50/50 opacity-60'
              )}
            >
              {/* Step Header */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-900 line-clamp-1">{step.title}</span>
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-black shrink-0" />
                ) : isCurrent ? (
                  <Sparkles className="w-3.5 h-3.5 text-black animate-spin shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                )}
              </div>

              {/* Subtitle */}
              <div className="text-[11px] text-zinc-500 font-sans line-clamp-1">{step.subtitle}</div>

              {/* Details */}
              <div className="text-[11px] font-mono text-zinc-700 space-y-1 bg-zinc-100/70 p-2 rounded border border-zinc-200/60">
                {step.details.map((d, dIdx) => (
                  <div key={dIdx} className="leading-tight line-clamp-1">
                    • {d}
                  </div>
                ))}
              </div>

              {/* Git Diff Block if present */}
              {step.diffSnippet && (
                <div className="bg-black text-white p-2 rounded font-mono text-[10px] overflow-x-auto leading-tight">
                  <div className="text-zinc-400 font-bold mb-1">GIT DIFF BLOCK:</div>
                  <pre className="text-zinc-200">{step.diffSnippet}</pre>
                </div>
              )}

              {/* Citation Footer */}
              {step.citation && (
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-400 text-[10px]">CITATION:</span>
                  <CitationChip citation={step.citation} onClick={onSelectCitation} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
