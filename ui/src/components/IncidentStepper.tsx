import React from 'react';
import {
  Activity,
  ShieldAlert,
  Sparkles,
  Database,
  ShieldCheck,
  Download,
  CheckCircle2,
  ChevronRight
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
      subtitle: isDegraded ? 'Latency Surge (p95 > 5s)' : 'Healthy Gateway',
      icon: Activity,
    },
    {
      id: 'scans',
      number: '02',
      title: 'Scans & CVEs',
      subtitle: 'SAST / SCA / DAST catalog',
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
      subtitle: 'Neo4j Graph & Reach',
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
    <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between select-none shadow-xs">
      {/* Stepper Chain */}
      <div className="flex items-center space-x-2 overflow-x-auto">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center">
          Workflow:
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
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all duration-150 text-left cursor-pointer',
                  isActive
                    ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-xs'
                    : isDone
                    ? 'bg-emerald-50 border-emerald-200 text-slate-800 hover:bg-emerald-100/60'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center font-mono text-[11px] font-bold shrink-0',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {isDone && !isActive ? <CheckCircle2 className="w-3 h-3 text-white" /> : <Icon className="w-3 h-3" />}
                </div>

                <div className="leading-tight">
                  <div className="text-xs font-bold flex items-center space-x-1.5">
                    <span>{step.title}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                    {step.subtitle}
                  </div>
                </div>
              </button>

              {idx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Export Report Action */}
      <div className="flex items-center space-x-2 pl-4 border-l border-slate-200">
        <button
          type="button"
          onClick={onExportReport}
          className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
          title="Download complete Incident RCA & CVE Audit Report"
        >
          <Download className="w-3.5 h-3.5 text-purple-600" />
          <span>Export Audit Report</span>
        </button>
      </div>
    </div>
  );
};
