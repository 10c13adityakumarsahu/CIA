# CULPRIT: Autonomous Incident Root-Cause Correlation & Decision Support

CULPRIT is an autonomous incident investigation and decision support system. When latency surges or error rates spike, the Gemma 4 agent correlates live gateway logs, multi-version SAST/SCA/DAST findings, and a Neo4j blast radius graph to investigate competing hypotheses (`exploit`, `regression`, `infra`), output an evidence-grounded report, and propose safety-verified mitigations.

---

## 🚀 One-Command Quickstart

To build and launch the complete stack:

```bash
make demo
```

This brings up:
- **UI Command Center**: http://localhost:5173
- **Culprit API**: http://localhost:9000
- **Gateway Proxy**: http://localhost:8080
- **Shop App Blue (v1.5.0)**: http://localhost:8001
- **Shop App Green (v1.4.0)**: http://localhost:8002
- **PostgreSQL Database**: `localhost:5432`
- **Neo4j Graph**: `localhost:7474` (Bolt: `localhost:7687`)
- **Redis Release Ledger**: `localhost:6379`
- **Docker Registry**: `http://localhost:5000`

---

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# LLM Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it  # or gemma-4-31b-it

# Execution Mode: LIVE (interacts with local LLM & services) or REPLAY (offline cached runs)
CULPRIT_MODE=LIVE

# Infrastructure
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=culprit
NEO4J_AUTH=none
```

---

## 🔍 Live vs. Seeded vs. Replayed Components

| Component | Nature | Description |
|---|---|---|
| **Gateway & Traffic** | **LIVE** | FastAPI + httpx reverse proxy (:8080) logging every request to `logs/gateway.jsonl` with live rolling p50/p95/err_rate metrics and dynamic routing weights. |
| **Target Applications** | **LIVE** | Real containerized Python FastAPI services (v1.5.0 on Blue :8001, v1.4.0 on Green :8002) connected to PostgreSQL. |
| **Neo4j Code Graph** | **LIVE** | Ingested via AST/regex from `target_app/v1.5.0` code, mapping Gateway -> Routes -> Functions -> DB Tables -> Pools -> Roles. |
| **Security Findings** | **LIVE Scans** | Real Semgrep, Trivy, and ZAP output normalized into deterministic IDs (`SAST-001..`, `SCA-001..`, `DAST-001..`) with cross-version fingerprints. |
| **Incident Traffic** | **Injected** | Scenario A injects a canned burst with SQL time-delay payload to `:8080`; Scenario B shifts 100% traffic to v1.5.0 (triggering N+1 inventory loop exhaustion). |
| **Release Ledger** | **Seeded** | Redis ledger tracking `1.3.0` (stable), `1.4.0` (stable / LKG), and `1.5.0` (current / degraded). |
| **Service Manifest** | **Config** | Hand-written topology manifest detailing DB role permissions, max pool size, and route mappings. |
| **REPLAY Mode** | **Offline Cache** | Serves recorded investigation streams and reports directly from `cache/` with zero external network access. |

---

## 🛡️ Security Scanners & Rules

- **SAST**: Semgrep scanning local rules in `scanners/rules/` (`sql-fstring-exec.yaml`, `weak-hash.yaml`, `subprocess-shell.yaml`) across versions 1.3.0, 1.4.0, 1.5.0.
- **SCA**: Trivy filesystem scanner (`trivy fs --scanners vuln --format json`) analyzing pinned dependencies in `requirements.txt`.
- **DAST**: OWASP ZAP API scanner (`zap-api-scan.py`) against Blue's `/openapi.json`.

---

## 🔒 Safety Guarantees & Constraints

1. **Model Proposes, Code Verifies, Human Approves**: The model never executes commands directly. All mitigation actions require code verification and operator approval.
2. **Deterministic Preconditions**: Computed exclusively by code (target health, registry image existence, schema compatibility, absence of implicated findings in target).
3. **Rollback Rejection**: If an implicated vulnerability exists in older versions (e.g. SQLi present in 1.4.0 during Scenario A), rollback is strictly **REJECTED** by code verifiers.
4. **Strict Citation Resolution**: Every claim in the report must resolve to an exact log ID (`LOG-n`), finding ID (`SAST-n`), file line (`FILE:path:line`), git diff (`DIFF:hunk`), or graph node (`GRAPH:id`).

---

## 🧪 Acceptance Testing

Run stage-by-stage acceptance tests:

```bash
make check-s0  # Infra health
make check-s1  # Target app registry & performance
make check-s2  # SAST/SCA/DAST normalization
make check-s3  # Gateway routing & scenario injection
make check-s4  # Neo4j graph queries
make check-s5  # Preconditions, verifier & executor
make check-s6  # GenAI agent & report verification
make check-s7  # UI build & mock server
make check-s8  # Full integration check
```