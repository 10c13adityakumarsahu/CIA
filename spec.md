# CULPRIT SPEC (source of truth; read once; do not restate it in replies)

GOAL: incident investigator. Gemma 4 agent correlates gateway logs + SAST/SCA/DAST,
computes blast radius (Neo4j), proposes a mitigation verified by code; human approves.

RULES
- Never write scanners. Run Semgrep, Trivy, ZAP and parse JSON. Only touch localhost.
- Model proposes; code verifies and executes; human approves. Model never runs commands.
- Every claim carries a citation. Keep code minimal. No features beyond this spec.
- Commit per stage. Reply in <=5 lines. Show only failing output.

STACK: Python 3.11 FastAPI; Postgres 16; Neo4j 5 community (bolt 7687); Redis 7;
 registry:2 (5000); Vite+React+TS+Tailwind+shadcn/ui+@xyflow/react+Recharts+shiki.
LLM: google-genai SDK; env GEMMA_MODEL=gemma-4-26b-a4b-it (alt gemma-4-31b-it);
 key GEMINI_API_KEY; temperature 0; structured output + function calling.
PORTS: ui 5173, api 9000, gateway 8080, blue 8001, green 8002, pg 5432,
 neo4j 7474/7687, redis 6379, registry 5000.

LAYOUT: target_app/{v1.3.0,v1.4.0,v1.5.0}/ scanners/ findings/ gateway/ loadgen/
 graph/ ledger/ culprit/ (api, agent, tools, verifier, preconditions, executor)
 scenarios/ fixtures/ cache/ ui/ tests/ Makefile docker-compose.yml

APP (FastAPI+psycopg2): routes GET /health, GET /api/products,
 POST /api/orders, GET /api/payments/{id}. Postgres pool max=5, one DB role app_rw
 that can read customers, products, inventory, orders, payments.
 v1.3.0 stable: orders SQL built with f-string on `sku` (SQLi).
 v1.4.0 stable: same as 1.3.0 plus minor change.
 v1.5.0 current: SQLi + N+1 per-item inventory query, inventory.sku NOT indexed.
 Also: legacy helper module with weak hash and subprocess shell=True (decoy SAST).
 requirements.txt pins old deps (PyYAML 5.3.1, requests 2.19.1, Jinja2 2.11.2);
 at least one never imported. Images tagged localhost:5000/shop:<ver>.
 blue=1.5.0 (8001), green=1.4.0 (8002).

IDS: Finding id SAST-001|SCA-001|DAST-001 (deterministic, sorted).
 fingerprint = sha1(rule|path|normalized snippet) for cross-version matching.
 Finding {id,source,title,severity(low|medium|high|critical|info),location,
  cwe[],owasp,detail,fingerprint,present_in[versions]}.
 Log id LOG-0001.. = line number in gateway JSONL.
 Citations: LOG-n | <FindingID> | FILE:path:line | DIFF:hunk-n | GRAPH:<node_id> | REL:<ver>

GATEWAY (FastAPI+httpx, :8080): weighted proxy blue/green; JSONL log
 {ts,request_id,route,method,status,latency_ms,upstream,version,client_ip,body_excerpt};
 rolling metrics per route+version (p50,p95,err_rate,rps); admin (localhost only):
 GET /admin/state, POST /admin/weights{blue,green}, POST /admin/rules{route,field,regex},
 DELETE /admin/rules/{id}, POST /admin/disable{route}. Blocked => 403 logged `blocked`.
 loadgen: steady healthy traffic to :8080.

REDIS LEDGER: hash release:<ver> {version,image,git_sha,status(stable|degraded|current),
 deployed_at,p95_ms,err_rate,schema_version,finding_fps(json)}; zset deploys (score=ts);
 key lkg=<ver>; promoter marks stable after window (err<1%, p95<SLO).
 Seed: 1.3.0 stable, 1.4.0 stable (lkg), 1.5.0 current.

NEO4J GRAPH (ingest by graph/ingest.py)
 Nodes: Gateway, Route{path}, Function{name,file,line}, Table{name,sensitivity:pii|financial|none},
  DBRole, Pool{max}, Version{ver,status}, Finding{id,fp,severity,title}
 Edges: Gateway-ROUTES_TO->Route; Route-HANDLED_BY->Function; Function-READS|WRITES->Table;
  Function-USES->Pool; DBRole-CAN_READ->Table; Finding-LOCATED_IN->Function;
  Version-CONTAINS->Finding. Code graph from AST/regex of v1.5.0; findings from scans.
 Query templates (parameterized, read-only; no free Cypher from the model):
  data_reach(finding_id): Finding->Function->Route + Tables reachable via Function and via DBRole
  shared_resource(route): other Routes sharing Pool
  version_contains(finding_ids, version): which implicated findings exist in version
 All return {nodes:[{id,label,props}], edges:[{from,to,type}]}.

TOOLS (agent): search_logs(query,status,limit) log_stats(route) list_findings(source)
 read_file(path,start,end) git_diff() service_manifest() get_metrics(route,window)
 blast_radius(finding_id|route) get_release_ledger() find_last_stable(exclude_finding_ids)
 check_version_findings(version,finding_ids) list_mitigation_actions()

REPORT {incident_summary, hypotheses[{label exploit|regression|infra|other,
 confidence low|medium|high, supporting[], contradicting[]}], verdict, owasp,
 finding_verdicts[{finding_id,verdict related|decoy,reason,citations[]}] (cover EVERY finding),
 path[{description,citation}], blast_radius{severity low|medium|high|critical,summary,
 nodes[{node_id,impact none|possible|likely|confirmed,reason,citations[]}]},
 mitigations[{action,rank,title,rationale,expected_effect,risk,preconditions[],
 executable,params}], rejected_options[{action,why,citations[]}], remediation[]}

ACTIONS: rollback{version}, failover, canary_shift{blue,green}, block_rule{route,field,regex},
 disable_endpoint{route}, hotfix(not executed).
 PRECONDITIONS (computed by CODE, never by model): target_healthy, image_in_registry,
 schema_compatible, target_lacks_implicated_findings, is_last_stable. A rollback/failover
 whose target contains implicated findings is REJECTED by the verifier.
 EXECUTOR: preview (diff of gateway/ledger change) -> approve -> execute -> verify recovery
 30s on live metrics -> recovered|partial|not_recovered; undo supported.

VERIFIER: every citation resolves (log id, finding id, file+line in range, graph node id,
 release exists); every finding has one verdict; node ids exist in graph; action params
 valid; preconditions taken from code.

SCENARIOS: A_exploit: injector sends fixed burst to POST /api/orders via gateway with a
 time-delay payload in `sku` from one IP (canned replay on our own app). B_regression:
 shift 100% traffic to 1.5.0; N+1 + small pool slows /api/orders and /api/products.
 Expected: A => exploit, data exposure possible (customers,payments), rollback REJECTED,
 block_rule first, hotfix second. B => regression, availability only incl. products,
 rollback to 1.4.0 first, all preconditions pass. Keep scenarios/*/truth.json hidden from agent.

API (culprit-api :9000, SSE for streams): GET /api/state, /api/metrics, /api/findings,
 /api/graph?finding=|route=, /api/source?path&start&end, /api/logs/{id}, /api/ledger;
 POST /api/scenario/{a_exploit|b_regression}/start, /api/scenario/reset, /api/investigate,
 GET /api/investigate/{run}/stream (events tool_call|tool_result|report|verification|done|error);
 POST /api/mitigation/preview|execute|{id}/undo; GET /api/mitigation/{id}/verify (SSE).
 Replay mode: same API served from cache/ (LIVE|REPLAY flag in /api/state).

UI: dark command center. Left: service health + blue/green split + release timeline.
 Center: live latency/error chart with markers; tabs Investigation|Attack path|Blast radius|
 Mitigation. Right: findings by source; funnel animation (N -> related), decoys collapse.
 Citation chips open code/log drawer. Mitigation cards: preconditions checklist, Preview,
 Approve+Execute, recovery verify, Undo, 'Not recommended' section. LIVE/REPLAY badge.
 Labels: 'Hypothesis, not proven'. Inter + JetBrains Mono; >=14px; color = meaning only.

DONE: `make demo` brings full stack up; scenario A and B produce the expected verdicts;
 all citations verify; UI works in replay with no network.