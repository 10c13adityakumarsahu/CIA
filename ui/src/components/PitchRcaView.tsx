import React, { useState } from 'react';
import {
  ShieldAlert,
  Cpu,
  Package,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Server,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Database,
  Terminal,
  Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CitationChip } from './CitationChip';

interface PitchRcaViewProps {
  activeScenario: string | null;
  onSelectCitation: (citation: string) => void;
  onTriggerScenario: (scenario: 'a_exploit' | 'b_regression') => void;
}

export const PitchRcaView: React.FC<PitchRcaViewProps> = ({
  activeScenario,
  onSelectCitation,
  onTriggerScenario
}) => {
  const [selectedTopic, setSelectedTopic] = useState<'exploit' | 'regression' | 'sca' | 'dast' | 'waf'>(
    activeScenario === 'b_regression' ? 'regression' : 'exploit'
  );

  const topics = [
    { id: 'exploit', label: 'Scenario A: SQLi Attack (OWASP A03)', icon: ShieldAlert, color: 'text-red-400 border-red-800' },
    { id: 'regression', label: 'Scenario B: N+1 Regression (Perf Starvation)', icon: Cpu, color: 'text-amber-400 border-amber-800' },
    { id: 'sca', label: 'SCA: Dependency CVEs & Decoys (Trivy)', icon: Package, color: 'text-purple-400 border-purple-800' },
    { id: 'dast', label: 'DAST: Data Reach & Blast Radius (ZAP)', icon: Eye, color: 'text-cyan-400 border-cyan-800' },
    { id: 'waf', label: 'WAF: Edge Defense vs Container Rollback', icon: ShieldCheck, color: 'text-emerald-400 border-emerald-800' },
  ];

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto p-6 select-text">
      {/* Presentation Banner */}
      <div className="bg-gradient-to-r from-blue-950/70 via-indigo-950/60 to-purple-950/70 border border-blue-700/60 rounded-xl p-5 shadow-2xl flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-blue-500 text-white flex items-center">
              <Sparkles className="w-3 h-3 mr-1" />
              Hackathon Pitch & RCA Deep-Dive
            </span>
            <span className="text-xs text-blue-300 font-mono">
              Root-Cause Correlation Engine & Zero-Hallucination Guardrails
            </span>
          </div>
          <h2 className="text-base font-bold text-white pt-1">
            How CULPRIT Solves Production Incidents with Gemma + Code Grounding
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Unlike generic AI chat tools that guess root causes or recommend dangerous rollbacks, CULPRIT connects real-time gateway telemetry, multi-version SAST/SCA/DAST findings, and a Neo4j blast radius graph with code-verified safety preconditions.
          </p>
        </div>
      </div>

      {/* Topic Selection Pills */}
      <div className="flex items-center space-x-2 border-b border-[#334155] pb-3">
        {topics.map((t) => {
          const Icon = t.icon;
          const isSelected = selectedTopic === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTopic(t.id as any)}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition border',
                isSelected
                  ? 'bg-[#1E293B] text-white border-blue-500 shadow-md font-bold'
                  : 'bg-[#0B0F19] text-slate-400 border-[#334155] hover:text-white hover:border-slate-500'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content for Scenario A (Exploit) */}
      {selectedTopic === 'exploit' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Why Gateway Fails */}
          <div className="bg-[#111827] border border-red-900/80 rounded-xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-400 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 text-red-400" />
                Why the Gateway & API are Failing (Failure Mechanism)
              </h3>
              <button
                type="button"
                onClick={() => onTriggerScenario('a_exploit')}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
              >
                <Zap className="w-3 h-3" />
                <span>Simulate Attack</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono pt-1">
              <div className="bg-[#0B0F19] p-3 rounded border border-red-950 space-y-1">
                <span className="text-slate-400 font-bold">1. Ingress Request</span>
                <p className="text-slate-300">POST /api/orders with 'sku': <code>WIDGET-001'; SELECT pg_sleep(8); --</code></p>
                <CitationChip citation="LOG-0001" onClick={onSelectCitation} />
              </div>
              <div className="bg-[#0B0F19] p-3 rounded border border-red-950 space-y-1">
                <span className="text-slate-400 font-bold">2. Vulnerable App</span>
                <p className="text-slate-300">F-string SQL executes sleep(8), locking database thread for 8.0 seconds.</p>
                <CitationChip citation="SAST-002" onClick={onSelectCitation} />
              </div>
              <div className="bg-[#0B0F19] p-3 rounded border border-red-950 space-y-1">
                <span className="text-slate-400 font-bold">3. Pool Starvation</span>
                <p className="text-slate-300">Max DB Pool size = 5. All 5 pool connections become blocked simultaneously.</p>
                <CitationChip citation="GRAPH:pool:postgres" onClick={onSelectCitation} />
              </div>
              <div className="bg-[#0B0F19] p-3 rounded border border-red-950 space-y-1">
                <span className="text-slate-400 font-bold">4. Gateway Outage</span>
                <p className="text-red-300">Legitimate requests timeout (5s), p95 latency spikes to ~8,200ms, HTTP 504/500 errors.</p>
              </div>
            </div>
          </div>

          {/* Guardrail Decision: Why Rollback was REJECTED */}
          <div className="bg-[#111827] border border-amber-900/80 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center">
              <XCircle className="w-4 h-4 mr-2 text-red-400" />
              Zero-Hallucination Guardrail: Why Rollback is REJECTED
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              A standard DevOps engineer or naive LLM agent would say: <em className="text-slate-400">"The service is degraded, let's rollback to stable release 1.4.0!"</em>
            </p>
            <div className="bg-[#0B0F19] p-3.5 rounded-lg border border-red-900/60 text-xs font-mono space-y-2 text-red-200">
              <div className="font-bold text-red-400">DANGEROUS MISTAKE PREVENTED:</div>
              <p>
                SAST cross-version fingerprinting proves the identical SQL injection vulnerability (<code>SAST-002</code>) was present in v1.3.0 and v1.4.0. Rolling back would NOT fix the incident and leaves the exploit active.
              </p>
              <div className="flex items-center space-x-2 pt-1 text-slate-300">
                <span>Code Precondition:</span>
                <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                  target_lacks_implicated_findings: FAILED
                </span>
              </div>
            </div>
            <div className="text-xs text-emerald-400 flex items-center space-x-1 pt-1 font-semibold">
              <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" />
              <span>Correct Action: Deploy Gateway WAF Rule on 'sku' parameter (Rank 1) + Application Code Hotfix (Rank 2).</span>
            </div>
          </div>
        </div>
      )}

      {/* Content for Scenario B (Regression) */}
      {selectedTopic === 'regression' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-[#111827] border border-amber-900/80 rounded-xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-400 flex items-center">
                <Cpu className="w-4 h-4 mr-2 text-amber-400" />
                Why the Gateway & API are Failing (N+1 Query Bottleneck)
              </h3>
              <button
                type="button"
                onClick={() => onTriggerScenario('b_regression')}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
              >
                <Zap className="w-3 h-3" />
                <span>Simulate Regression</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono pt-1">
              <div className="bg-[#0B0F19] p-3 rounded border border-amber-950 space-y-1">
                <span className="text-slate-400 font-bold">1. Release v1.5.0</span>
                <p className="text-slate-300">Commit replaced batch lookup with loop query on unindexed inventory.sku.</p>
                <CitationChip citation="DIFF:hunk-1" onClick={onSelectCitation} />
              </div>
              <div className="bg-[#0B0F19] p-3 rounded border border-amber-950 space-y-1">
                <span className="text-slate-400 font-bold">2. Normal Traffic</span>
                <p className="text-slate-300">Requests contain 100% benign shopping cart payloads (no SQLi strings).</p>
                <CitationChip citation="LOG-0001" onClick={onSelectCitation} />
              </div>
              <div className="bg-[#0B0F19] p-3 rounded border border-amber-950 space-y-1">
                <span className="text-slate-400 font-bold">3. Blast Radius</span>
                <p className="text-slate-300">High query volume starves /api/orders and shared /api/products route.</p>
                <CitationChip citation="GRAPH:route:/api/products" onClick={onSelectCitation} />
              </div>
              <div className="bg-[#0B0F19] p-3 rounded border border-amber-950 space-y-1">
                <span className="text-slate-400 font-bold">4. SAST Decoy</span>
                <p className="text-slate-300">SQLi finding is marked DECOY / NON-CAUSAL because inputs are clean.</p>
                <CitationChip citation="SAST-002" onClick={onSelectCitation} />
              </div>
            </div>
          </div>

          <div className="bg-[#111827] border border-emerald-900/80 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
              Why Rollback to 1.4.0 (LKG) is APPROVED
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#0B0F19] p-2.5 rounded border border-emerald-950 text-emerald-300 flex items-center justify-between">
                <span>[✓] target_healthy: Container responds 200</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="bg-[#0B0F19] p-2.5 rounded border border-emerald-950 text-emerald-300 flex items-center justify-between">
                <span>[✓] image_in_registry: localhost:5000/shop:1.4.0 verified</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="bg-[#0B0F19] p-2.5 rounded border border-emerald-950 text-emerald-300 flex items-center justify-between">
                <span>[✓] schema_compatible: Same schema_version</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="bg-[#0B0F19] p-2.5 rounded border border-emerald-950 text-emerald-300 flex items-center justify-between">
                <span>[✓] is_last_stable: Release ledger marks 1.4.0 as LKG</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content for SCA */}
      {selectedTopic === 'sca' && (
        <div className="space-y-4 animate-in fade-in bg-[#111827] border border-purple-900/80 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-purple-400 flex items-center">
            <Package className="w-4 h-4 mr-2 text-purple-400" />
            Software Composition Analysis (SCA) & Decoy Finding Triage
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Trivy scans pinned dependencies in <code>requirements.txt</code> (PyYAML 5.3.1, Jinja2 2.11.2, requests 2.19.1).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-[#0B0F19] p-3 rounded border border-purple-950 space-y-1">
              <span className="text-purple-300 font-bold">PyYAML 5.3.1 (CVE-2020-14343)</span>
              <p className="text-slate-400">Arbitrary Code Execution in yaml.load().</p>
              <div className="text-[11px] text-amber-400 pt-1">Gemma: Unused in active order path (DECOY).</div>
              <CitationChip citation="SCA-001" onClick={onSelectCitation} />
            </div>
            <div className="bg-[#0B0F19] p-3 rounded border border-purple-950 space-y-1">
              <span className="text-purple-300 font-bold">Jinja2 2.11.2 (CVE-2020-28493)</span>
              <p className="text-slate-400">Server-Side Template Injection.</p>
              <div className="text-[11px] text-amber-400 pt-1">Gemma: Template engine not used in API routes.</div>
              <CitationChip citation="SCA-002" onClick={onSelectCitation} />
            </div>
            <div className="bg-[#0B0F19] p-3 rounded border border-purple-950 space-y-1">
              <span className="text-purple-300 font-bold">requests 2.19.1 (CVE-2018-18074)</span>
              <p className="text-slate-400">Credential Leak on HTTP Redirects.</p>
              <div className="text-[11px] text-amber-400 pt-1">Gemma: Internal service calls use httpx.</div>
              <CitationChip citation="SCA-003" onClick={onSelectCitation} />
            </div>
          </div>
        </div>
      )}

      {/* Content for DAST */}
      {selectedTopic === 'dast' && (
        <div className="space-y-4 animate-in fade-in bg-[#111827] border border-cyan-900/80 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-cyan-400 flex items-center">
            <Eye className="w-4 h-4 mr-2 text-cyan-400" />
            Dynamic Application Security Testing (DAST) & Graph Data Reach
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            OWASP ZAP automatically crawls the OpenAPI schema at <code>/openapi.json</code> and flags parameter vulnerabilities.
          </p>
          <div className="bg-[#0B0F19] p-4 rounded-lg border border-cyan-950 text-xs font-mono space-y-2">
            <div className="text-cyan-300 font-bold">Neo4j Blast Radius Path:</div>
            <div className="text-slate-300">
              Gateway (:8080) ➔ Route (/api/orders) ➔ Function (orders()) ➔ DBRole (app_rw) ➔ Tables (customers, payments)
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <CitationChip citation="GRAPH:table:customers" onClick={onSelectCitation} />
              <CitationChip citation="GRAPH:table:payments" onClick={onSelectCitation} />
              <span className="text-amber-400 text-xs">PII & Financial Exposure Verified</span>
            </div>
          </div>
        </div>
      )}

      {/* Content for WAF */}
      {selectedTopic === 'waf' && (
        <div className="space-y-4 animate-in fade-in bg-[#111827] border border-emerald-900/80 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-2 text-emerald-400" />
            Gateway WAF Edge Enforcement vs Downtime Rollback
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            CULPRIT's Gateway contains a high-performance regex inspection engine. When an exploit is active, rather than taking down the entire checkout service, CULPRIT injects a surgical rule.
          </p>
          <div className="bg-[#0B0F19] p-4 rounded-lg border border-emerald-950 text-xs font-mono space-y-2 text-emerald-300">
            <div>WAF Rule: <code>POST /admin/rules &#123;"route": "/api/orders", "field": "sku", "regex": "sleep"&#125;</code></div>
            <div>Result: Malicious requests return <code>HTTP 403 Forbidden (Blocked by CULPRIT WAF)</code> in &lt;1ms.</div>
            <div>Legitimate users continue checking out with zero downtime!</div>
          </div>
        </div>
      )}
    </div>
  );
};
