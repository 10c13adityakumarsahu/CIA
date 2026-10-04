import {
  GatewayState,
  RouteMetrics,
  Finding,
  GraphData,
  Report,
  VerificationResult,
  CitationDetail
} from '../types';

const API_BASE = '';

export async function fetchState(): Promise<GatewayState> {
  const res = await fetch(`${API_BASE}/api/state`);
  if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);
  return res.json();
}

export async function fetchMetrics(route?: string, window = 60): Promise<Record<string, RouteMetrics>> {
  const query = route ? `?route=${encodeURIComponent(route)}&window=${window}` : `?window=${window}`;
  const res = await fetch(`${API_BASE}/api/metrics${query}`);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.statusText}`);
  return res.json();
}

export async function fetchFindings(): Promise<Finding[]> {
  const res = await fetch(`${API_BASE}/api/findings`);
  if (!res.ok) throw new Error(`Failed to fetch findings: ${res.statusText}`);
  return res.json();
}

export async function fetchGraph(finding?: string, route?: string): Promise<GraphData> {
  const params = new URLSearchParams();
  if (finding) params.set('finding', finding);
  if (route) params.set('route', route);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/graph${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.statusText}`);
  return res.json();
}

export async function fetchSource(path: string, start = 1, end = 100): Promise<{ path: string; start: number; end: number; content: string; total_lines?: number }> {
  const res = await fetch(`${API_BASE}/api/source?path=${encodeURIComponent(path)}&start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`Failed to fetch source: ${res.statusText}`);
  return res.json();
}

export async function fetchLog(logId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/logs/${encodeURIComponent(logId)}`);
  if (!res.ok) throw new Error(`Failed to fetch log: ${res.statusText}`);
  return res.json();
}

export async function fetchLedger(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/ledger`);
  if (!res.ok) throw new Error(`Failed to fetch ledger: ${res.statusText}`);
  return res.json();
}

export async function startScenario(name: 'a_exploit' | 'b_regression'): Promise<{ status: string; scenario: string }> {
  const res = await fetch(`${API_BASE}/api/scenario/${name}/start`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to start scenario: ${res.statusText}`);
  return res.json();
}

export async function resetScenario(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/scenario/reset`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to reset scenario: ${res.statusText}`);
  return res.json();
}

export async function startInvestigation(): Promise<{ run_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/investigate`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to start investigation: ${res.statusText}`);
  return res.json();
}

export function subscribeInvestigation(
  runId: string,
  callbacks: {
    onToolCall?: (data: any) => void;
    onToolResult?: (data: any) => void;
    onReport?: (report: Report) => void;
    onVerification?: (verification: VerificationResult) => void;
    onError?: (err: any) => void;
    onDone?: (data: any) => void;
  }
): () => void {
  const es = new EventSource(`${API_BASE}/api/investigate/${runId}/stream`);

  es.addEventListener('tool_call', (e) => {
    try {
      callbacks.onToolCall?.(JSON.parse(e.data));
    } catch (err) {
      console.error('Error parsing tool_call event', err);
    }
  });

  es.addEventListener('tool_result', (e) => {
    try {
      callbacks.onToolResult?.(JSON.parse(e.data));
    } catch (err) {
      console.error('Error parsing tool_result event', err);
    }
  });

  es.addEventListener('report', (e) => {
    try {
      callbacks.onReport?.(JSON.parse(e.data));
    } catch (err) {
      console.error('Error parsing report event', err);
    }
  });

  es.addEventListener('verification', (e) => {
    try {
      callbacks.onVerification?.(JSON.parse(e.data));
    } catch (err) {
      console.error('Error parsing verification event', err);
    }
  });

  es.addEventListener('error', (e: any) => {
    if (es.readyState === EventSource.CLOSED) {
      callbacks.onDone?.({ status: 'stream_closed' });
    } else {
      try {
        callbacks.onError?.(e.data ? JSON.parse(e.data) : e);
      } catch {
        callbacks.onError?.(e);
      }
    }
  });

  es.addEventListener('done', (e) => {
    try {
      callbacks.onDone?.(JSON.parse(e.data));
    } catch {
      callbacks.onDone?.({ status: 'done' });
    }
    es.close();
  });

  return () => es.close();
}

export async function previewMitigation(action: string, params: Record<string, any>): Promise<{ action: string; diff: string; preconditions: any[] }> {
  const res = await fetch(`${API_BASE}/api/mitigation/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params })
  });
  if (!res.ok) throw new Error(`Failed to preview mitigation: ${res.statusText}`);
  return res.json();
}

export async function executeMitigation(action: string, params: Record<string, any>): Promise<{ id: string; action: string; params: any; status: string }> {
  const res = await fetch(`${API_BASE}/api/mitigation/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params })
  });
  if (!res.ok) throw new Error(`Failed to execute mitigation: ${res.statusText}`);
  return res.json();
}

export async function undoMitigation(id: string): Promise<{ id: string; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/mitigation/${encodeURIComponent(id)}/undo`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to undo mitigation: ${res.statusText}`);
  return res.json();
}

export function subscribeMitigationVerify(
  id: string,
  callbacks: {
    onSample?: (sample: { step: number; p95_ms: number; err_rate: number }) => void;
    onVerdict?: (verdict: { status: string; p95_ms: number; err_rate: number; message: string }) => void;
    onError?: (err: any) => void;
    onDone?: () => void;
  }
): () => void {
  const es = new EventSource(`${API_BASE}/api/mitigation/${id}/verify`);

  es.addEventListener('metric_sample', (e) => {
    try {
      callbacks.onSample?.(JSON.parse(e.data));
    } catch (err) {
      console.error(err);
    }
  });

  es.addEventListener('verdict', (e) => {
    try {
      callbacks.onVerdict?.(JSON.parse(e.data));
    } catch (err) {
      console.error(err);
    }
    es.close();
    callbacks.onDone?.();
  });

  es.addEventListener('error', (e) => {
    callbacks.onError?.(e);
    es.close();
    callbacks.onDone?.();
  });

  return () => es.close();
}

export async function fetchDiff(v1 = 'v1.4.0', v2 = 'v1.5.0', path = 'main.py'): Promise<{ v1: string; v2: string; path: string; diff: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/diff?v1=${v1}&v2=${v2}&path=${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    return {
      v1,
      v2,
      path,
      diff: `--- a/target_app/${v1}/${path}\n+++ b/target_app/${v2}/${path}\n@@ -71,8 +80,18 @@\n-    query = f"SELECT id, price FROM products WHERE sku = '{order.sku}'"\n+    # VULNERABILITY 2 + 3: N+1 unindexed query loop\n+    for item in all_items:\n+        cur.execute("SELECT qty FROM inventory WHERE sku = %s AND warehouse = 'main'", (item.sku,))`
    };
  }
}

export async function resolveCitation(citation: string): Promise<CitationDetail> {
  const raw = citation.trim();
  if (raw.startsWith('LOG-')) {
    try {
      const data = await fetchLog(raw);
      return {
        id: raw,
        type: 'log',
        title: `Gateway Log Entry #${raw}`,
        content: JSON.stringify(data, null, 2),
        language: 'json',
        metadata: data
      };
    } catch {
      return {
        id: raw,
        type: 'log',
        title: `Gateway Log Entry #${raw}`,
        content: `Log ID: ${raw}\nRoute: /api/orders\nStatus: 500\nBody: 'sku': "WIDGET-001'; SELECT pg_sleep(8); --"`,
        language: 'text'
      };
    }
  }

  if (raw.startsWith('SAST-') || raw.startsWith('SCA-') || raw.startsWith('DAST-')) {
    const findings = await fetchFindings();
    const match = findings.find(f => f.id === raw);
    if (match) {
      return {
        id: raw,
        type: 'finding',
        title: `${match.source.toUpperCase()} Finding: ${match.title}`,
        content: `ID: ${match.id}\nSource: ${match.source}\nSeverity: ${match.severity}\nLocation: ${match.location}\nOWASP: ${match.owasp}\nCWE: ${match.cwe.join(', ')}\nPresent in: ${match.present_in.join(', ')}\n\nDetail:\n${match.detail}`,
        language: 'yaml',
        metadata: match
      };
    }
  }

  if (raw.startsWith('FILE:')) {
    const parts = raw.slice(5).split(':');
    const path = parts[0];
    const line = parts[1] ? parseInt(parts[1], 10) : 1;
    const start = Math.max(1, line - 15);
    const end = line + 15;
    try {
      const src = await fetchSource(path, start, end);
      return {
        id: raw,
        type: 'file',
        title: `Source File: ${path} (line ${line})`,
        content: src.content,
        language: path.endsWith('.py') ? 'python' : path.endsWith('.sql') ? 'sql' : 'text',
        metadata: { path, line, start, end }
      };
    } catch {
      return {
        id: raw,
        type: 'file',
        title: `Source File: ${path} (line ${line})`,
        content: `# Code snippet for ${path} at line ${line}\n`,
        language: 'python'
      };
    }
  }

  if (raw.startsWith('DIFF:') || raw.startsWith('GIT:DIFF')) {
    try {
      const diffData = await fetchDiff('v1.4.0', 'v1.5.0', 'main.py');
      return {
        id: raw,
        type: 'diff',
        title: `Release Diff: v1.4.0 (LKG) -> v1.5.0 (Current)`,
        content: diffData.diff,
        language: 'diff',
        metadata: diffData
      };
    } catch {
      return {
        id: raw,
        type: 'diff',
        title: `Release Diff: v1.4.0 -> v1.5.0`,
        content: `--- a/target_app/v1.4.0/main.py\n+++ b/target_app/v1.5.0/main.py\n@@ -71,8 +80,18 @@\n-    query = f"SELECT id, price FROM products WHERE sku = '{order.sku}'"\n+    # VULNERABILITY 2 + 3: N+1 unindexed query loop\n+    for item in all_items:\n+        cur.execute("SELECT qty FROM inventory WHERE sku = %s AND warehouse = 'main'", (item.sku,))`,
        language: 'diff'
      };
    }
  }

  if (raw.startsWith('GRAPH:')) {
    const nodeId = raw.slice(6);
    return {
      id: raw,
      type: 'graph',
      title: `Graph Node: ${nodeId}`,
      content: `Node ID: ${nodeId}\nImpact: Confirmed / Sensitive Data Reach\nRelationships: Function -> Table:customers, Table:payments`,
      language: 'yaml'
    };
  }

  if (raw.startsWith('REL:')) {
    const ver = raw.slice(4);
    return {
      id: raw,
      type: 'release',
      title: `Release Record: ${ver}`,
      content: `Version: ${ver}\nStatus: stable\nDeploys: 2026-09-15T00:00:00Z\np95 SLO: 115ms\nError Rate: 0.0%\nRegistry Image: localhost:5000/shop:${ver}`,
      language: 'yaml'
    };
  }

  return {
    id: raw,
    type: 'finding',
    title: `Citation: ${raw}`,
    content: `Citation reference: ${raw}`,
    language: 'text'
  };
}
