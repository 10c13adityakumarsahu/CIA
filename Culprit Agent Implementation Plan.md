# Culprit: Agent Implementation Plan

Build instructions for an AI coding agent · Companion to "Culprit: Final Approach Proposal" · October 4, 2026

> You are implementing a hackathon POC called **Culprit**: an incident investigator that correlates logs with SAST, SCA and DAST findings using Gemma 4. Work through the phases **in order**. Each phase has deliverables and an acceptance check. Do not start a phase until the previous acceptance check passes. Prefer the simplest thing that works. Total budget is about 4 hours.

*Note: "SCM" in the request is read as **SCA** (software composition analysis).*

## 0. Ground Rules

- **Never build your own SAST, SCA or DAST scanner.** Run existing open-source tools and parse their JSON output.
- **Only scan the local target app** in this repo, on localhost. No exploit tooling. Incident traffic is pre-written, deterministic log data.
- **Commit scanner outputs** to `findings/` so the demo works offline and without waiting on slow scans. Provide a script that regenerates them.
- **Everything runs with one command** (`make demo`) on a clean machine with Docker and Python 3.11+.
- **Pin versions** of tools and Python dependencies.
- **Every tool output the AI sees must be normalized** to the schema in Phase 4.
- **Be honest in the UI**: anything replayed or precomputed is labeled.
- If a command or flag differs from this document, check the tool's current `--help` or docs and adapt. Do not stall.

## 1. Repository Layout

```
culprit/
  Makefile
  docker-compose.yml
  README.md
  target_app/              # intentionally vulnerable FastAPI service
    main.py
    orders.py
    db.py
    requirements.txt       # deliberately includes old vulnerable deps
    schema.sql
  scanners/
    run_sast.sh
    run_sca.sh
    run_dast.sh
    rules/                 # local Semgrep rules (offline-safe)
  findings/                # committed raw scanner output
    sast.json
    sca.json
    dast.json
  scenarios/
    generate_logs.py
    A_exploit/{logs.jsonl, recent_diff.patch, truth.json}
    B_regression/{logs.jsonl, recent_diff.patch, truth.json}
  culprit/
    schema.py              # Pydantic models
    normalize.py           # raw -> normalized findings
    tools.py               # agent tools
    agent.py               # Gemma tool-calling loop
    verifier.py            # grounding checks
    baseline.py            # rules-only correlator
    config.py
  ui/app.py                # Streamlit
  eval/run_eval.py
  tests/
```

## 2. Phase 0: Target App (needed first so there is something to scan)

Build a small FastAPI + PostgreSQL service. Keep it under \~150 lines.

**Endpoints**

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health check |
| `GET /api/products` | List products (safe, parameterized) |
| `POST /api/orders` | Create order. **Contains the intentional vulnerabilities below** |
| `GET /api/payments/{id}` | Payment lookup (safe; exists for blast-radius context) |

**Intentional weaknesses in `orders.py`** (keep them obvious to scanners and realistic):

1. **SQL built with an f-string** from a request field (for example `sku` or `customer_ref`) and executed with `psycopg2`. This is the SAST finding on a known line, and the real injection point.
2. **An N+1 query pattern**: inside the order handler, a loop queries `inventory` once per line item, and the `inventory.sku` column has **no index**. This is the cause of Incident B.
3. **A decoy SAST finding elsewhere** (for example a weak hash or `subprocess` use in a non-request path such as a helper in `main.py`). Used to demonstrate decoy rejection.

**`requirements.txt`: deliberately old pins.** Suggested starting points (verify the scanner flags them and swap if not): `PyYAML==5.3.1`, `requests==2.19.1`, `Jinja2==2.11.2`. Make sure at least one vulnerable package is **never imported** by the code (reachability decoy) and at least one is actually used.

**Database**: `schema.sql` creates `customers`, `products`, `inventory` (no index on `sku`), `orders`, `payments`. Use **one DB role** for the app that can read all of them, so the "data reachable from this code path" story is real.

**docker-compose.yml**: services `db` (postgres) and `app` (uvicorn). Healthchecks on both.

**Acceptance:** `docker compose up -d` then `curl localhost:8000/health` returns 200, and `POST /api/orders` with a valid body creates an order.

## 3. Phase 1: SAST with Semgrep

**Goal:** produce `findings/sast.json` from the target app source.

**Tool:** Semgrep (run via its Docker image or `pip install semgrep`, pinned).

**Steps**

1. Write `scanners/rules/` with a small local rule set so results are deterministic and work offline:
   - SQL built via string formatting passed to `cursor.execute` (CWE-89)
   - Use of `subprocess` with `shell=True` or a weak hash (for the decoy)
   - Optionally also run a registry pack such as `p/python` if network is available, but do not depend on it.
2. `scanners/run_sast.sh`:

   ```
   semgrep --config scanners/rules/ --json --output findings/sast.json target_app/
   ```

   (Add `--metrics=off`. Pin the version in the script.)
3. Confirm the output contains the injection finding with the correct file and line.

**Fields to read from Semgrep JSON** (`results[]`): `check_id`, `path`, `start.line`, `end.line`, `extra.message`, `extra.severity`, `extra.lines`, `extra.metadata` (cwe, owasp where present).

**Acceptance:** `findings/sast.json` exists, contains ≥2 results (the SQLi finding and the decoy), and the SQLi finding's `path` and `start.line` match the actual vulnerable line.

## 4. Phase 2: SCA with Trivy (or osv-scanner)

**Goal:** produce `findings/sca.json` from `requirements.txt`.

**Tool:** Trivy (preferred). osv-scanner is an acceptable substitute.

**Steps**

1. `scanners/run_sca.sh`:

   ```
   trivy fs --scanners vuln --format json --output findings/sca.json target_app/
   ```

   Pre-download the vulnerability DB once and note this in the README, since Trivy needs its DB. If using osv-scanner, check the installed version's CLI syntax (it has changed between versions) and output JSON.
2. Confirm the output lists vulnerabilities for your pinned old packages.

**Fields to read from Trivy JSON**: `Results[].Target`, `Results[].Vulnerabilities[]` with `VulnerabilityID`, `PkgName`, `InstalledVersion`, `FixedVersion`, `Severity`, `Title`, `Description`.

**Acceptance:** `findings/sca.json` exists with ≥5 vulnerabilities across ≥2 packages, including one package that the code never imports.

## 5. Phase 3: DAST with OWASP ZAP

**Goal:** produce `findings/dast.json` from scanning the **running local app**.

**Tool:** ZAP via its Docker image. Because the app is FastAPI, use its OpenAPI spec so ZAP finds `POST /api/orders` instead of only crawling.

**Steps**

1. Start the app (`docker compose up -d`).
2. `scanners/run_dast.sh`: run the ZAP API scan against `http://<host>:8000/openapi.json`:

   ```
   docker run --rm -v "$PWD/findings:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable \
     zap-api-scan.py -t http://<host>:8000/openapi.json -f openapi -J dast.json
   ```

   `<host>` is `host.docker.internal` on Mac and Windows; on Linux use `--network host` with `localhost`. Check the image tag and flags against current ZAP docs.
3. This scan can be slow. **Run it once, commit the result, and make `make demo` use the committed file** unless `make rescan` is called.
4. If ZAP does not flag the injection, do **not** fabricate it. Either tune the scan scope, or accept an honest result in which DAST is weaker evidence (the agent should reason about that). Passive-only findings (missing headers, etc.) are fine as additional noise.

**Fields to read from ZAP traditional JSON**: `site[].alerts[]` with `pluginid`, `alert`, `riskcode`, `riskdesc`, `cweid`, and `instances[]` with `uri`, `method`, `param`, `attack`, `evidence`.

**Acceptance:** `findings/dast.json` exists and contains alerts referencing `/api/orders`.

## 6. Phase 4: Normalization

**Goal:** convert the three raw formats into one schema.

`culprit/schema.py` (Pydantic):

```python
class Finding(BaseModel):
    id: str                 # e.g. SAST-001, SCA-003, DAST-002 (stable, deterministic)
    source: Literal["sast", "sca", "dast"]
    title: str
    severity: Literal["low", "medium", "high", "critical", "info"]
    location: str           # file:line  |  package@version  |  METHOD /path
    cwe: list[str] = []
    owasp: str | None = None
    detail: str             # short raw excerpt
```

`culprit/normalize.py`: `load_all_findings() -> list[Finding]`. IDs must be deterministic (sorted, numbered) so citations are stable across runs. Map severities consistently (Semgrep ERROR/WARNING/INFO, ZAP riskcode 0–3, Trivy severities).

**Acceptance:** a unit test asserts total counts match the raw files, IDs are stable across two runs, and each source maps at least one finding.

## 7. Phase 5: Scenarios and Logs

**Goal:** two deterministic incidents on `POST /api/orders` with **identical scanner findings**.

`scenarios/generate_logs.py` writes JSONL logs (seeded random, no real time dependency). Each line: `ts, level, service, endpoint, status, latency_ms, message, query (optional), request_id`.

- **A\_exploit**: mostly healthy traffic, then a burst where `POST /api/orders` returns 5xx with latency near 8000 ms. The error entries include the **logged query text containing an injected time-delay payload** (for example a `pg_sleep` call appended to the `sku`/`customer_ref` value). Include \~200 normal events and \~20 failures from a single source IP.
- **B\_regression**: similar error and latency profile, but **no suspicious payloads**. Logs show slow `SELECT ... FROM inventory WHERE sku = ...` queries repeated per line item (N+1), with timings growing with order size.

Also write for each scenario:

- `recent_diff.patch`: a plausible recent change. A: an unrelated logging tweak. B: the commit that added the per-item inventory loop.
- `truth.json`: ground truth, used only by eval: `{"class": "exploit|regression", "related_finding_ids": [...], "decoy_finding_ids": [...]}`. **The agent must never see this file.**

**Acceptance:** both scenarios exist, finding IDs referenced in `truth.json` exist in the normalized set, and a grep of A's logs shows the payload while B's logs contain none.

## 8. Phase 6: Agent Tools

`culprit/tools.py` implements the functions the model can call. All return small, JSON-serializable results (truncate large outputs).

| Tool | Behavior |
| --- | --- |
| `search_logs(query, status=None, limit=20)` | Filter the scenario's logs; return matching lines with line IDs (e.g. `LOG-0143`) |
| `log_stats(endpoint)` | Counts, error rate, p50/p95/p99 latency over time buckets |
| `list_findings(source=None)` | Normalized findings, optionally filtered |
| `read_file(path, start=1, end=200)` | Return numbered source lines from `target_app/`; refuse paths outside it |
| `git_diff()` | Return the scenario's `recent_diff.patch` (disclosed as a fixture) |
| `service_manifest()` | Return a small hand-written YAML/JSON: services, the DB role, tables it can read |

**Acceptance:** unit tests for each tool, including path-traversal rejection in `read_file`.

## 9. Phase 7: The Gemma Agent

`culprit/agent.py`:

- Use the Google Gen AI SDK against the Gemini API with model IDs from config (default `gemma-4-26b-a4b-it`; also support `gemma-4-31b-it`). Read the API key from `GEMINI_API_KEY`. Check current SDK docs for the function-calling syntax.
- Declare the Phase 6 tools as function declarations. Run a loop: send messages, execute any returned function calls, append results, repeat until the model returns a final answer. **Cap at \~12 tool calls.**
- **Stream each tool call and a one-line summary to the UI** (it is the demo's "it's working" moment).
- Final answer must follow the report schema below, using the model's structured-output support. If it fails to validate, retry once with the validation error appended.
- Temperature 0.
- Make the model client swappable (`LLM_BACKEND=gemini|ollama`) so a self-hosted model can be tried without changing agent logic. Ollama support can be best effort.

**Report schema**

```python
class Hypothesis(BaseModel):
    label: Literal["exploit", "regression", "infra", "other"]
    confidence: Literal["low", "medium", "high"]
    supporting: list[str]      # citation refs
    contradicting: list[str]

class FindingVerdict(BaseModel):
    finding_id: str
    verdict: Literal["related", "decoy"]
    reason: str                # one line
    citations: list[str]

class PathHop(BaseModel):
    description: str
    citation: str

class Report(BaseModel):
    incident_summary: str
    hypotheses: list[Hypothesis]
    verdict: str               # chosen label + rationale
    owasp: str | None
    finding_verdicts: list[FindingVerdict]   # must cover EVERY finding
    path: list[PathHop]
    exposure: str              # hypothesis, with stated uncertainty
    remediation: list[str]     # prioritized
```

Citation reference formats: `LOG-0143`, `SAST-002`, `FILE:target_app/orders.py:42`, `DIFF:hunk-1`.

**System prompt guidance** (keep it short and strict):

- You are investigating an incident; competing explanations must be considered (exploit, regression, infra).
- Treat scanner findings as unverified. Read the code before calling a finding related.
- A finding is "related" only if you can cite evidence that it lies on the failing path **and** explains the symptoms.
- Cite every claim. Never invent line numbers or log IDs. Say "unknown" when evidence is missing.
- State contradicting evidence for the chosen hypothesis.
- All conclusions are hypotheses for a human to confirm.

**Acceptance:** running the agent on A returns a valid `Report` that covers every finding and uses at least 3 distinct tools.

## 10. Phase 8: Grounding Verifier

`culprit/verifier.py`: `verify(report) -> VerificationResult` with per-citation pass or fail.

- `LOG-xxxx`: exists in the scenario logs.
- `SAST-/SCA-/DAST-xxx`: exists in normalized findings.
- `FILE:path:line`: file exists in `target_app/` and the line number is in range.
- `DIFF:hunk-n`: hunk exists.
- Every finding in the normalized set has exactly one verdict.
- Optional: if the model quoted a code snippet, check that it appears in the cited lines (whitespace-normalized).

The UI shows "N/N citations verified" and flags any failures in red. Failed citations are displayed, not silently dropped.

**Acceptance:** tests with a hand-corrupted report show failures detected for a bad log ID, a bad line number and a missing finding verdict.

## 11. Phase 9: Rules-Only Baseline

`culprit/baseline.py`: a deliberately reasonable non-AI correlator. Marks a finding "related" if its endpoint or file matches the failing endpoint's handler or appears in error log lines, and classifies the incident as "exploit" if any high-severity injection-class finding is related. Do not sandbag it; the point is an honest comparison. It is expected to treat A and B the same way.

**Acceptance:** returns the same output shape as the agent's verdicts, so eval can score both.

## 12. Phase 10: Streamlit UI

`ui/app.py`, one page:

1. **Header and status** with a scenario selector (A or B) and a clear "Replay data" badge.
2. **Raw signals panel**: counts of SAST, SCA, DAST findings and log events, plus a small latency and error chart for the endpoint.
3. **Investigate button**, which streams tool calls live.
4. **Report view**: noise funnel (for example "71 findings → 4 related"), root cause with confidence, supporting and contradicting evidence, finding verdict table (related or decoy with reasons), path diagram (Mermaid, one node per `PathHop`, hover shows the citation), exposure, remediation, and the verifier badge.
5. **Scoreboard tab**: rules-only vs. Gemma results from the last eval run.
6. **Replay mode toggle**: loads a cached agent run from `cache/` so the demo works with no network or API.

**Acceptance:** both scenarios run end to end in the browser, and replay mode works with the network disabled.

## 13. Phase 11: Evaluation

`eval/run_eval.py`: run baseline, Gemma 26B-A4B and Gemma 31B on scenarios A and B (add C and D if time allows: one more exploit and one more non-security incident with a different decoy). Report in a table: root-cause class correct, decoy rejection rate, related-finding recall and precision, citations verified, latency. Save to `eval/results.json` for the UI.

Be honest about sample size in the output ("2 to 4 scenarios, a sanity check, not a benchmark").

## 14. Phase 12: Packaging

- `make demo`: start compose, load committed findings, launch Streamlit.
- `make rescan`: regenerate findings with the three scanner scripts.
- `make eval`: run evaluation.
- `make record`: run the agent on both scenarios and save to `cache/` for replay mode.
- README: setup, env vars, what is real vs. replayed, scanner versions, known limitations, license.

## 15. Mocked vs. Real (state this in the README and UI)

| Real | Replayed or fixture |
| --- | --- |
| Target app, DB, code | Scenario logs |
| Semgrep, Trivy, ZAP outputs (committed from real runs) | `recent_diff.patch` |
| Gemma tool-calling agent | `service_manifest` |
| Verifier, baseline, eval | Cached replay runs (labeled) |

## 16. Priority Order If Time Runs Short

1. Phases 0 to 4 (app, three scanners, normalization)
2. Phase 5, 6, 7, 8 (scenarios, tools, agent, verifier)
3. Phase 10 (UI), with minimal styling
4. Phase 9 and 11 (baseline and eval)
5. Phase 12 (replay cache) **before** any UI polish, since it is the demo's safety net
6. Cut first: Ollama backend, scenarios C and D, image input, the 31B comparison

## 17. Definition of Done

- `make demo` works on a clean machine
- Scenario A verdict: exploit (injection), with the vulnerable line and payload cited
- Scenario B verdict: regression, with the SAST injection finding labeled as a real but non-causal weakness
- All citations verify; any failures are visible
- Scoreboard shows the baseline giving the same answer for A and B, and Gemma giving different, correct ones
- README is honest about what is replayed

## 18. Open Decisions for the Human

- Use a bespoke minimal app (this plan) or adapt VAmPI/crAPI? Bespoke is faster and fully controlled; an existing app gives more convincing real-world scanner noise.
- Is a self-hosted local-model demo worth time, or is a slide enough? Decide after Phase 7 works.
- Which Gemma size is the default for the live demo (latency vs. accuracy)? Decide after the first eval run.
