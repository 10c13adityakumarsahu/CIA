import React from 'react';
import {
  Activity,
  ShieldAlert,
  Sparkles,
  Database,
  ShieldCheck,
  Download,
  Play,
  CheckCircle2,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

export type IncidentStep = 'telemetry' | 'scans' | 'gemma_rca' | 'blast_radius' | 'mitigate';

interface IncidentStepperProps {
  currentStep: IncidentStep;
  onSelectStep: (step: IncidentStep) => void;
  onExportReport: () => void;
  isDegraded: boolean;
  hasReport: boolean;
  isInvestigating: boolean;
}

export const IncidentStepper: React.FC<IncidentStepperProps> = ({
  currentStep,
  onSelectStep,
  onExportReport,
  isDegraded,
  hasReport,
  isInvestigating,
}) => {
  const steps: Array<{ id: IncidentStep; number: string; title: string; subtitle: string; icon: any }> = [
    {
      id: 'telemetry',
      number: '01',
      title: 'Telemetry Alert',
      subtitle: isDegraded ? 'Latency Surge (p95 > 5s)' : 'Healthy Gateway Traffic',
      icon: Activity,
    },
    {
      id: 'scans',
      number: '02',
      title: 'Scans & CVEs',
      subtitle: 'SAST / SCA / DAST across versions',
      icon: ShieldAlert,
    },
    {
      id: 'gemma_rca',
      number: '03',
      title: 'Gemma 4 RCA',
      subtitle: isInvestigating ? 'Correlating evidence...' : hasReport ? 'Synthesized & Verified' : 'Ready to Correlate',
      icon: Sparkles,
    },
    {
      id: 'blast_radius',
      number: '04',
      title: 'Blast Radius',
      subtitle: 'Neo4j Graph & Data Reach',
      icon: Database,
    },
    {
      id: 'mitigate',
      number: '05',
      title: 'Mitigate & Recover',
      subtitle: 'Code-Verified Safety Actions',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="bg-[#0B0F19] border-b border-[#334155] px-6 py-2.5 flex items-center justify-between select-none">
      {/* Stepper Chain */}
      <div className="flex items-center space-x-2 overflow-x-auto">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center">
          Incident Lifecycle:
        </span>

        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = (step.id === 'telemetry' && isDegraded) || (step.id === 'gemma_rca' && hasReport);

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onSelectStep(step.id)}
                className={cn(
                  'flex items-center space-x-2.5 px-3 py-1.5 rounded-lg border transition-all duration-200 text-left cursor-pointer shadow-sm',
                  isActive
                    ? 'bg-[#1E293B] border-blue-500 text-white shadow-blue-900/20'
                    : isDone
                    ? 'bg-[#111827] border-emerald-900/70 text-slate-200 hover:border-emerald-700'
                    : 'bg-[#111827] border-[#334155] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-bold shrink-0',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isDone
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-slate-800 text-slate-400'
                  )}
                >
                  {isDone && !isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Icon className="w-3.5 h-3.5" />}
                </div>

                <div className="leading-tight">
                  <div className="text-xs font-bold flex items-center space-x-1.5">
                    <span>{step.title}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                    {step.subtitle}
                  </div>
                </div>
              </button>

              {idx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Export Report Action */}
      <div className="flex items-center space-x-2 pl-4 border-l border-[#334155]">
        <button
          type="button"
          onClick={onExportReport}
          className="px-3 py-1.5 rounded-lg border border-purple-800 bg-purple-950/80 hover:bg-purple-900 text-purple-200 text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg"
          title="Download complete Incident RCA & CVE Audit Report"
        >
          <Download className="w-3.5 h-3.5 text-purple-400" />
          <span>Export RCA & CVE Report</span>
        </button>
      </div>
    </div>
  );
};
