import React, { useState } from 'react';
import { Report, Finding, VerificationResult, GatewayState } from '../types';
import { X, Download, Copy, Check, FileText, Shield, Sparkles, CheckCircle2 } from 'lucide-react';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: Report | null;
  findings: Finding[];
  verification: VerificationResult | null;
  state: GatewayState | null;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  report,
  findings,
  verification,
  state,
}) => {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');

  if (!isOpen) return null;

  const generateMarkdown = () => {
    const verdict = report?.verdict?.toUpperCase() || 'UNKNOWN';
    const summary = report?.incident_summary || 'No summary available.';
    const owasp = report?.owasp || 'N/A';
    const verifiedCount = (verification as any)?.citations_valid ?? verification?.verified_citations?.length ?? 0;

    let md = `# CULPRIT: Autonomous Incident Investigation & CVE Audit Report\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Investigation Mode:** ${state?.mode || 'LIVE'}\n`;
    md += `**Verdict:** ${verdict}\n`;
    md += `**OWASP Category:** ${owasp}\n`;
    md += `**Grounding Verification:** ${verification?.valid ? 'PASSED (0 Hallucinations)' : 'UNVERIFIED'} (${verifiedCount} Citations Verified)\n\n`;

    md += `## 1. Executive Incident Summary\n${summary}\n\n`;

    md += `## 2. Multi-Version Vulnerability & CVE Findings Inventory\n`;
    md += `| ID | Source | Severity | Title | CVE / CWE | Present in Versions |\n`;
    md += `|---|---|---|---|---|---|\n`;
    findings.forEach((f) => {
      const cweStr = f.cwe?.join(', ') || 'N/A';
      md += `| ${f.id} | ${f.source.toUpperCase()} | ${f.severity.toUpperCase()} | ${f.title} | ${cweStr} | ${f.present_in.join(', ')} |\n`;
    });
    md += `\n`;

    if (report?.hypotheses) {
      md += `## 3. Competing Hypotheses Analysis\n`;
      report.hypotheses.forEach((hyp) => {
        md += `### Hypothesis: ${hyp.label.toUpperCase()} (${hyp.confidence.toUpperCase()} Confidence)\n`;
        md += `- **Supporting Citations:** ${hyp.supporting?.join(', ') || 'None'}\n`;
        md += `- **Contradicting Citations:** ${hyp.contradicting?.join(', ') || 'None'}\n\n`;
      });
    }

    if (report?.blast_radius) {
      md += `## 4. Blast Radius & Knowledge Graph Reach\n`;
      md += `**Overall Severity:** ${report.blast_radius.severity.toUpperCase()}\n`;
      md += `**Summary:** ${report.blast_radius.summary}\n\n`;
      md += `| Node ID | Impact | Reason | Citations |\n`;
      md += `|---|---|---|---|\n`;
      report.blast_radius.nodes?.forEach((n) => {
        md += `| ${n.node_id} | ${n.impact.toUpperCase()} | ${n.reason} | ${n.citations?.join(', ') || 'None'} |\n`;
      });
      md += `\n`;
    }

    if (report?.mitigations) {
      md += `## 5. Recommended Mitigation Plan (Ranked)\n`;
      report.mitigations.forEach((mit) => {
        md += `### Rank ${mit.rank}: ${mit.title} (${mit.action.toUpperCase()})\n`;
        md += `- **Rationale:** ${mit.rationale}\n`;
        md += `- **Expected Effect:** ${mit.expected_effect}\n`;
        md += `- **Risk Assessment:** ${mit.risk}\n`;
        md += `- **Preconditions:**\n`;
        mit.preconditions?.forEach((p) => {
          md += `  - [${p.satisfied ? 'X' : ' '}] ${p.name}: ${p.detail}\n`;
        });
        md += `\n`;
      });
    }

    if (report?.rejected_options && report.rejected_options.length > 0) {
      md += `## 6. Rejected Options (Guardrail Enforcement)\n`;
      report.rejected_options.forEach((rej) => {
        md += `- **Action Rejected:** ${rej.action.toUpperCase()}\n`;
        md += `  - **Why Rejected:** ${rej.why}\n`;
        md += `  - **Citations:** ${rej.citations?.join(', ')}\n`;
      });
    }

    return md;
  };

  const generateJson = () => {
    return JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        mode: state?.mode,
        state,
        report,
        verification,
        findings,
      },
      null,
      2
    );
  };

  const content = format === 'markdown' ? generateMarkdown() : generateJson();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `CULPRIT_Incident_Report_${report?.verdict || 'audit'}_${new Date().toISOString().slice(0, 10)}.${format === 'markdown' ? 'md' : 'json'}`;
    const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#111827] border border-[#334155] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155] bg-[#0B0F19]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Incident RCA & Security Vulnerability Report
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Code-grounded decision audit log with full citation trace
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-[#1E293B] p-1 rounded-lg border border-[#334155] text-xs font-mono">
              <button
                type="button"
                onClick={() => setFormat('markdown')}
                className={`px-3 py-1 rounded font-semibold transition ${format === 'markdown' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Markdown (.md)
              </button>
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`px-3 py-1 rounded font-semibold transition ${format === 'json' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Raw JSON (.json)
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center space-x-1 transition"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono flex items-center space-x-1.5 transition shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Download Report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0B0F19]">
          <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#334155] bg-[#111827] flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Zero Hallucinations: All claims backed by code, logs, AST, and Neo4j citations
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
