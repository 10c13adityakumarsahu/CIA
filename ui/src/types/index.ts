export type Severity = 'low' | 'medium' | 'high' | 'critical' | 'info';
export type FindingSource = 'sast' | 'sca' | 'dast';
export type VerdictType = 'exploit' | 'regression' | 'infra' | 'other';
export type Confidence = 'low' | 'medium' | 'high';
export type NodeImpact = 'none' | 'possible' | 'likely' | 'confirmed';

export interface Finding {
  id: string;
  source: FindingSource;
  title: string;
  severity: Severity;
  location: string;
  cwe: string[];
  owasp: string;
  detail: string;
  fingerprint: string;
  present_in: string[];
}

export interface FindingVerdict {
  finding_id: string;
  verdict: 'related' | 'decoy';
  reason: string;
  citations: string[];
}

export interface Hypothesis {
  label: VerdictType;
  confidence: Confidence;
  supporting: string[];
  contradicting: string[];
}

export interface PathStep {
  description: string;
  citation: string;
}

export interface BlastRadiusNode {
  node_id: string;
  impact: NodeImpact;
  reason: string;
  citations: string[];
}

export interface BlastRadius {
  severity: Severity;
  summary: string;
  nodes: BlastRadiusNode[];
}

export interface PreconditionCheck {
  name: string;
  satisfied: boolean;
  detail: string;
}

export interface Mitigation {
  action: string;
  rank: number;
  title: string;
  rationale: string;
  expected_effect: string;
  risk: string;
  preconditions: PreconditionCheck[];
  executable: boolean;
  params: Record<string, any>;
}

export interface RejectedOption {
  action: string;
  why: string;
  citations: string[];
}

export interface Report {
  incident_summary: string;
  hypotheses: Hypothesis[];
  verdict: VerdictType;
  owasp: string;
  finding_verdicts: FindingVerdict[];
  path: PathStep[];
  blast_radius: BlastRadius;
  mitigations: Mitigation[];
  rejected_options: RejectedOption[];
  remediation: string[];
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  verified_citations: string[];
  unverified_citations: string[];
}

export interface ToolCallEvent {
  tool: string;
  args: Record<string, any>;
  step?: number;
}

export interface ToolResultEvent {
  tool: string;
  result: any;
  step?: number;
}

export interface InvestigationEvent {
  event: 'tool_call' | 'tool_result' | 'report' | 'verification' | 'done' | 'error' | 'status';
  data: any;
  timestamp?: string;
}

export interface GatewayState {
  mode: 'LIVE' | 'REPLAY';
  active_scenario: string | null;
  weights: { blue: number; green: number };
  active_rules: Array<{ id: string; route: string; field: string; regex: string }>;
  disabled_routes: string[];
  ledger_releases: Array<{
    version: string;
    status: string;
    deployed_at: string;
    p95_ms: number;
    err_rate: number;
    is_lkg?: boolean;
  }>;
  health: {
    gateway: boolean;
    blue: boolean;
    green: boolean;
    db: boolean;
    neo4j: boolean;
    redis: boolean;
    registry: boolean;
  };
}

export interface RouteMetrics {
  route?: string;
  version?: string;
  count?: number;
  errors?: number;
  p50_ms: number;
  p90_ms?: number;
  p95_ms: number;
  p99_ms?: number;
  err_rate: number;
  rps: number;
  history?: Array<{
    ts: number;
    p50: number;
    p90?: number;
    p95: number;
    p99?: number;
    err_rate: number;
    rps: number;
    marker?: string;
  }>;
}

export interface GraphNode {
  id: string;
  label: string;
  props: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CitationDetail {
  id: string;
  type: 'log' | 'finding' | 'file' | 'diff' | 'graph' | 'release';
  title: string;
  content: string;
  language?: string;
  metadata?: Record<string, any>;
}
