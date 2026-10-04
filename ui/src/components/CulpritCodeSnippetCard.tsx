import React, { useState, useEffect } from 'react';
import {
  Code,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  FileCode,
  CheckCircle2,
  ArrowRight,
  GitCompare,
  Wrench,
  GitPullRequest
} from 'lucide-react';
import { CitationChip } from './CitationChip';
import { fetchDiff, fetchSource } from '../lib/api';
import { cn } from '../lib/utils';

interface CulpritCodeSnippetCardProps {
  scenario?: string | null;
  onSelectCitation?: (citation: string) => void;
}

export const CulpritCodeSnippetCard: React.FC<CulpritCodeSnippetCardProps> = ({
  scenario,
  onSelectCitation
}) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'vulnerable' | 'fixed' | 'git_diff'>('git_diff');
  const [copied, setCopied] = useState(false);
  const [liveDiff, setLiveDiff] = useState<string>('');

  useEffect(() => {
    fetchDiff('v1.4.0', 'v1.5.0', 'main.py')
      .then((res) => {
        if (res?.diff) setLiveDiff(res.diff);
      })
      .catch((err) => {
        console.warn('Could not fetch live diff', err);
      });
  }, [scenario]);

  // Scenario A: SQL Injection in orders()
  // Scenario B: N+1 DB loop in products()
  const isScenarioB = scenario === 'b_regression';

  const snippetData = isScenarioB
    ? {
        title: 'N+1 Query Loop & DB Pool Exhaustion',
        file: 'target_app/v1.5.0/app.py',
        lineRange: 'Lines 72-84',
        cwe: 'CWE-400 (Uncontrolled Resource Consumption)',
        owasp: 'A04:2021 - Insecure Design',
        citation: 'FILE:target_app/v1.5.0/app.py:75',
        vulnerableLines: [
          { num: 72, text: '@app.route("/api/products", methods=["GET"])' },
          { num: 73, text: 'def get_products():' },
          { num: 74, text: '    with db_pool.getconn() as conn:' },
          { num: 75, text: '        c = conn.cursor()' },
          { num: 76, text: '        c.execute("SELECT id, name, category FROM products")' },
          { num: 77, text: '        products = c.fetchall()' },
          { num: 78, text: '        # ⚠️ REGRESSION: N+1 nested query per product row inside loop', isTaint: true },
          { num: 79, text: '        for p in products:', isTaint: true },
          { num: 80, text: '            c.execute(f"SELECT stock, warehouse FROM inventory WHERE product_id = {p[0]}")', isTaint: true },
          { num: 81, text: '            p["inventory"] = c.fetchone()', isTaint: true },
          { num: 82, text: '        return jsonify(products)' },
        ],
        fixedCode: `@app.route("/api/products", methods=["GET"])
def get_products():
    with db_pool.getconn() as conn:
        c = conn.cursor()
        # ✅ FIX: Single JOIN query prevents pool connection exhaustion
        query = """
            SELECT p.id, p.name, p.category, i.stock, i.warehouse 
            FROM products p 
            LEFT JOIN inventory i ON p.id = i.product_id
        """
        c.execute(query)
        products = c.fetchall()
        return jsonify(products)`,
        explanation: 'The v1.5.0 code performs a nested database query for each product in the result set inside a loop. Under 50 RPS traffic, this quickly exhausts the 5-connection Postgres pool, driving p95 latency above 5,000ms. Refactoring to a single JOIN query eliminates the bottleneck with constant O(1) connection overhead.'
      }
    : {
        title: 'Raw SQL Injection via Unsanitized Request Parameter',
        file: 'target_app/v1.5.0/app.py',
        lineRange: 'Lines 48-61',
        cwe: 'CWE-89 (Improper Neutralization of Special Elements used in an SQL Command)',
        owasp: 'A03:2021 - Injection',
        citation: 'FILE:target_app/v1.5.0/app.py:53',
        vulnerableLines: [
          { num: 48, text: '@app.route("/api/orders", methods=["POST"])' },
          { num: 49, text: 'def orders():' },
          { num: 50, text: '    sku = request.json.get("sku", "")' },
          { num: 51, text: '    with db_pool.getconn() as conn:' },
          { num: 52, text: '        c = conn.cursor()' },
          { num: 53, text: '        # ⚠️ VULNERABLE: Direct f-string interpolation into raw SQL', isTaint: true },
          { num: 54, text: '        query = f"SELECT * FROM orders WHERE sku = \'{sku}\'"', isTaint: true },
          { num: 55, text: '        c.execute(query)', isTaint: true },
          { num: 56, text: '        rows = c.fetchall()' },
          { num: 57, text: '        return jsonify(rows)' },
        ],
        fixedCode: `@app.route("/api/orders", methods=["POST"])
def orders():
    sku = request.json.get("sku", "")
    with db_pool.getconn() as conn:
        c = conn.cursor()
        # ✅ FIX: Parameterized SQL Query (prevents SQL injection)
        query = "SELECT * FROM orders WHERE sku = %s"
        c.execute(query, (sku,))
        rows = c.fetchall()
        return jsonify(rows)`,
        explanation: 'The v1.5.0 orders endpoint directly formats untrusted user input into the SQL query string. Attackers exploit this with sleep-based time-delay payloads (pg_sleep(5)) to tie up backend worker threads. Replacing string interpolation with parameterized query placeholders (%s) forces the PostgreSQL engine to treat user input strictly as literal values.'
      };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippetData.fixedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/70">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs border border-red-200">
              <FileCode className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-sm">{snippetData.title}</h3>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200">
                  {snippetData.cwe}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                <span className="font-mono text-[11px] font-semibold text-slate-700">{snippetData.file}</span>
                <span>•</span>
                <span>{snippetData.lineRange}</span>
                <span>•</span>
                <span>{snippetData.owasp}</span>
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs & Citation */}
        <div className="flex items-center space-x-2">
          {snippetData.citation && onSelectCitation && (
            <CitationChip citation={snippetData.citation} onClick={onSelectCitation} />
          )}

          <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('git_diff')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition flex items-center space-x-1',
                activeTab === 'git_diff'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <GitPullRequest className="w-3 h-3" />
              <span>Git Code Diff</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition flex items-center space-x-1',
                activeTab === 'diff'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <GitCompare className="w-3 h-3" />
              <span>Side-by-Side</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vulnerable')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition',
                activeTab === 'vulnerable'
                  ? 'bg-red-50 text-red-800 font-semibold shadow-xs border border-red-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Vulnerable Snippet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fixed')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition flex items-center space-x-1',
                activeTab === 'fixed'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Gemma Fix</span>
            </button>
          </div>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Git Code Diff View */}
        {activeTab === 'git_diff' && (
          <div className="md:col-span-2">
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-t-lg text-xs font-semibold text-blue-900">
              <span className="flex items-center space-x-1.5">
                <GitPullRequest className="w-3.5 h-3.5 text-blue-600" />
                <span>Git Code Diff: v1.4.0 (Stable LKG) ➔ v1.5.0 (Culprit Release)</span>
              </span>
              <span className="text-[10px] font-mono bg-blue-100 px-1.5 py-0.2 rounded text-blue-800 font-bold">
                target_app/v1.5.0/main.py
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-b-lg border-x border-b border-slate-800 font-mono text-xs overflow-x-auto text-slate-200 leading-relaxed shadow-inner max-h-64">
              <pre className="whitespace-pre">
                {liveDiff || `--- a/target_app/v1.4.0/main.py\n+++ b/target_app/v1.5.0/main.py\n@@ -71,8 +80,18 @@\n-    query = f"SELECT id, price FROM products WHERE sku = '{order.sku}'"\n+    # VULNERABILITY 2 + 3: N+1 unindexed query loop\n+    for item in all_items:\n+        cur.execute("SELECT qty FROM inventory WHERE sku = %s AND warehouse = 'main'", (item.sku,))`}
              </pre>
            </div>
          </div>
        )}

        {/* Left / Vulnerable Code Block */}
        {(activeTab === 'diff' || activeTab === 'vulnerable') && (
          <div className={cn(activeTab === 'vulnerable' && 'md:col-span-2')}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-red-50 border border-red-200 rounded-t-lg text-xs font-semibold text-red-800">
              <span className="flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>Culprit Code Snippet (Current v1.5.0)</span>
              </span>
              <span className="text-[10px] font-mono bg-red-100 px-1.5 py-0.2 rounded text-red-700">
                Tainted AST Node
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-b-lg border-x border-b border-slate-800 font-mono text-xs overflow-x-auto text-slate-200 leading-relaxed shadow-inner">
              {snippetData.vulnerableLines.map((line) => (
                <div
                  key={line.num}
                  className={cn(
                    'flex items-start px-1.5 py-0.5 rounded',
                    line.isTaint ? 'bg-red-950/80 text-red-200 border-l-2 border-red-500 pl-2' : ''
                  )}
                >
                  <span className="w-7 shrink-0 text-slate-500 select-none text-[11px]">{line.num}</span>
                  <span className="whitespace-pre">{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right / Gemma AI Suggested Fix */}
        {(activeTab === 'diff' || activeTab === 'fixed') && (
          <div className={cn(activeTab === 'fixed' && 'md:col-span-2')}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-t-lg text-xs font-semibold text-emerald-800">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gemma 4 AI Recommended Remediation</span>
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-semibold flex items-center space-x-1 transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3 text-emerald-700" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <div className="bg-slate-950 p-3 rounded-b-lg border-x border-b border-slate-800 font-mono text-xs overflow-x-auto text-emerald-300 leading-relaxed shadow-inner">
              <pre className="whitespace-pre">{snippetData.fixedCode}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Gemma AI Explanation Footer */}
      <div className="mx-4 mb-4 p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start space-x-3 text-xs text-slate-700">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-blue-900 flex items-center space-x-1.5">
            <span>Gemma RCA & Verification Rationale</span>
            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-mono">
              AST AST-Check Verified
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed font-sans">
            {snippetData.explanation}
          </p>
        </div>
      </div>
    </div>
  );
};
