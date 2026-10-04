# CULPRIT
## Autonomous Incident Root-Cause Correlation & Decision Support

CULPRIT is an autonomous incident investigation and decision-support system designed to determine **why a production system is degrading**, correlate operational and security evidence across multiple sources, evaluate competing root-cause hypotheses, and recommend **safety-verified remediation actions**.

CULPRIT combines:

- **Gemma 4** for autonomous investigation and hypothesis reasoning
- **Live gateway telemetry** for latency, errors, routing, and request-level evidence
- **Multi-version SAST/SCA/DAST findings** for security context
- **Neo4j** for code, service, database, and blast-radius relationships
- **Git/version differences** for regression analysis
- **Redis** as a release and rollback ledger
- **Deterministic policy/verifier code** for mitigation safety
- **Human approval** as the final authorization layer

The system investigates three competing hypotheses:

1. **EXPLOIT** — malicious traffic or exploitation of a security weakness
2. **REGRESSION** — a newly introduced software or database performance defect
3. **INFRA** — infrastructure, capacity, dependency, or runtime degradation

The key principle is:

> **The model investigates and proposes. Deterministic code verifies. A human approves.**

CULPRIT is therefore designed as a **decision-support system rather than an autonomous production operator**.

---

# 1. Problem

Modern incidents rarely have a single source of truth.

A sudden increase in latency could be caused by:

- A malicious SQL injection attempt
- A newly introduced N+1 query
- Database connection pool exhaustion
- A vulnerable endpoint being actively exploited
- A bad deployment
- Infrastructure saturation
- A dependency failure
- A combination of several factors

Traditional incident response often requires engineers to manually correlate:

```text
Gateway logs
      +
Application metrics
      +
Git history
      +
Security scans
      +
Dependency vulnerabilities
      +
Database topology
      +
Deployment history
      +
Service dependencies
```

This creates several problems:

- Evidence is distributed across different systems.
- Security and reliability investigations are often performed separately.
- Engineers may prematurely commit to one hypothesis.
- Rollbacks can reintroduce known vulnerabilities.
- Large dependency graphs make blast-radius analysis difficult.
- AI-generated recommendations can be unsafe if they are allowed to execute directly.

CULPRIT addresses this by creating a unified investigation workflow where operational, security, code, release, and topology evidence can be correlated.

---

# 2. Core Idea

CULPRIT treats an incident as a **hypothesis-ranking problem**.

Instead of asking:

> "What happened?"

the agent asks:

> "Which explanation best accounts for the available evidence, and what evidence would disprove it?"

The investigation considers:

```text
                    INCIDENT
                       |
          +------------+------------+
          |            |            |
       EXPLOIT      REGRESSION     INFRA
          |            |            |
          +------------+------------+
                       |
                Evidence Graph
                       |
              Hypothesis Ranking
                       |
             Root-Cause Assessment
                       |
             Mitigation Proposal
                       |
             Deterministic Verifier
                       |
                Human Approval
```

Every important conclusion must be backed by machine-resolvable evidence.

---

# 3. Key Features

## 3.1 Autonomous Incident Investigation

CULPRIT automatically gathers and correlates:

- Gateway request logs
- Rolling latency metrics
- Error rates
- Traffic routing weights
- Application behavior
- Release history
- Git diffs
- SAST findings
- SCA findings
- DAST findings
- Neo4j dependency relationships
- Database topology
- Runtime health

The Gemma 4 agent uses this evidence to investigate competing hypotheses.

---

## 3.2 Competing Root-Cause Hypotheses

CULPRIT does not immediately assume that an incident is a deployment regression.

It explicitly evaluates:

### EXPLOIT

Possible evidence:

- Suspicious request patterns
- SQL injection payloads
- Security findings affecting the requested route
- Vulnerable functions reachable from the gateway
- DAST confirmation
- Database timing anomalies
- Abnormal request latency

### REGRESSION

Possible evidence:

- Recent deployment
- Git diff introducing expensive code
- Increased query count
- N+1 database access
- Increased latency only on the latest release
- Traffic shift toward the latest version
- Stable behavior on the previous release

### INFRA

Possible evidence:

- Resource exhaustion
- Connection pool saturation
- Dependency failures
- System-wide latency
- Errors affecting multiple application versions
- Infrastructure degradation without corresponding code changes

The final investigation can rank these hypotheses rather than producing a simplistic binary answer.

---

# 4. Architecture

```text
                         +----------------------+
                         |      User / SRE       |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |   UI Command Center   |
                         |       :5173           |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |     CULPRIT API       |
                         |       :9000           |
                         +----------+-----------+
                                    |
                 +------------------+------------------+
                 |                  |                  |
                 v                  v                  v
        +----------------+  +---------------+  +---------------+
        | Gemma 4 Agent  |  | Evidence      |  | Investigation |
        | Reasoning      |  | Correlator    |  | Orchestrator  |
        +----------------+  +---------------+  +---------------+
                 |                  |                  |
                 +------------------+------------------+
                                    |
             +----------------------+----------------------+
             |             |             |                |
             v             v             v                v
       +-----------+ +-----------+ +-----------+ +---------------+
       | Gateway   | | Security  | | Neo4j    | | Release       |
       | Logs      | | Findings  | | Graph    | | Ledger        |
       +-----------+ +-----------+ +-----------+ +---------------+
             |             |             |                |
             v             v             v                v
       LOG-n IDs      SAST/SCA/DAST   GRAPH:id       Redis versions
                                   
                                    |
                                    v
                         +----------------------+
                         | Deterministic        |
                         | Safety Verifier      |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         | Proposed Mitigation  |
                         | + Preconditions      |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         | Human Approval       |
                         +----------------------+
```

---

# 5. Technology Stack

| Layer | Technology |
|---|---|
| AI Agent | Gemma 4 |
| LLM Interface | Gemini API / configured Gemma endpoint |
| Backend API | FastAPI |
| HTTP Proxy | FastAPI + httpx |
| Frontend | Web-based UI |
| Database | PostgreSQL |
| Graph Database | Neo4j |
| Release Ledger | Redis |
| SAST | Semgrep |
| SCA | Trivy |
| DAST | OWASP ZAP |
| Application Runtime | Python / FastAPI |
| Containerization | Docker |
| Service Orchestration | Docker Compose |
| Version Control | Git |
| Testing | Make-based acceptance suite |

---

# 6. Repository Structure

A representative project structure is:

```text
CULPRIT/
├── agent/
│   ├── prompts/
│   ├── tools/
│   ├── investigator/
│   └── report/
│
├── api/
│   ├── routes/
│   ├── models/
│   ├── services/
│   └── main.py
│
├── gateway/
│   ├── main.py
│   ├── routing.py
│   ├── metrics.py
│   └── logs/
│
├── target_app/
│   ├── v1.3.0/
│   ├── v1.4.0/
│   └── v1.5.0/
│
├── scanners/
│   ├── rules/
│   │   ├── sql-fstring-exec.yaml
│   │   ├── weak-hash.yaml
│   │   └── subprocess-shell.yaml
│   ├── sast/
│   ├── sca/
│   └── dast/
│
├── graph/
│   ├── ingestion/
│   ├── queries/
│   └── seed/
│
├── verifier/
│   ├── preconditions/
│   ├── policies/
│   └── executor/
│
├── ui/
│
├── cache/
│
├── logs/
│
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

The exact directory structure may vary depending on the implementation.

---

# 7. One-Command Quickstart

## Prerequisites

Install:

- Docker
- Docker Compose
- Make
- Git
- A Gemma 4 / Gemini API key for LIVE mode

Verify:

```bash
docker --version
docker compose version
make --version
```

---

# 8. Environment Configuration

Create the environment file:

```bash
cp .env.example .env
```

Configure:

```env
# LLM Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Gemma 4 model
GEMMA_MODEL=gemma-4-26b-a4b-it

# Alternative
# GEMMA_MODEL=gemma-4-31b-it

# Execution mode
# LIVE    -> Uses live services and configured LLM
# REPLAY  -> Uses cached investigation runs
CULPRIT_MODE=LIVE

# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=culprit

# Neo4j
NEO4J_AUTH=none
```

Never commit `.env` or API keys to version control.

---

# 9. Start the Complete System

Run:

```bash
make demo
```

The command launches the complete demonstration environment.

After startup:

| Component | Address |
|---|---|
| UI Command Center | http://localhost:5173 |
| CULPRIT API | http://localhost:9000 |
| Gateway Proxy | http://localhost:8080 |
| Shop App Blue | http://localhost:8001 |
| Shop App Green | http://localhost:8002 |
| PostgreSQL | localhost:5432 |
| Neo4j Browser | http://localhost:7474 |
| Neo4j Bolt | localhost:7687 |
| Redis | localhost:6379 |
| Docker Registry | http://localhost:5000 |

---

# 10. System Components

## 10.1 UI Command Center

The UI provides an incident-response interface for:

- Viewing live metrics
- Starting investigations
- Selecting scenarios
- Viewing hypotheses
- Inspecting evidence
- Viewing blast radius
- Reviewing security findings
- Inspecting proposed mitigations
- Reviewing verification status
- Approving or rejecting actions
- Viewing the generated incident report

The UI is designed around the workflow:

```text
Observe
   ↓
Investigate
   ↓
Correlate
   ↓
Verify
   ↓
Decide
   ↓
Approve
```

---

# 11. Gateway Proxy

The gateway runs on:

```text
http://localhost:8080
```

It acts as a reverse proxy between incoming traffic and application versions.

Current application versions:

```text
Blue  → v1.5.0 → :8001
Green → v1.4.0 → :8002
```

The gateway records request-level information including:

- Timestamp
- HTTP method
- Path
- Response status
- Latency
- Target version
- Request metadata
- Scenario-specific indicators

Logs are stored in:

```text
logs/gateway.jsonl
```

---

# 12. Rolling Metrics

The gateway continuously calculates rolling operational metrics.

Important metrics include:

```text
p50 latency
p95 latency
error rate
request volume
version distribution
```

These metrics allow CULPRIT to detect changes such as:

```text
Normal:

p95 = 120 ms
error rate = 0.4%

        ↓

Incident:

p95 = 4.8 s
error rate = 18.7%
```

The agent does not rely exclusively on these numbers. They become evidence that is correlated with code, security, and topology information.

---

# 13. Target Applications

The demonstration contains two live application versions.

```text
Blue
v1.5.0
localhost:8001

Green
v1.4.0
localhost:8002
```

Both are real containerized Python FastAPI services.

They interact with PostgreSQL and expose application routes through the gateway.

The versions deliberately contain different behavior so that CULPRIT can distinguish between:

```text
security exploitation
        vs.
application regression
        vs.
infrastructure degradation
```

---

# 14. Release Ledger

Redis acts as the release ledger.

Example state:

```text
1.3.0 → Stable
1.4.0 → Stable / LKG
1.5.0 → Current / Degraded
```

Where:

```text
LKG = Last Known Good
```

This information is important when considering rollback.

A naive incident-response system might conclude:

> "Version 1.5.0 is degraded. Roll back to 1.4.0."

CULPRIT does not automatically accept this recommendation.

It checks whether the older version is actually safe.

---

# 15. Neo4j Code and Blast-Radius Graph

CULPRIT uses Neo4j to represent relationships between system components.

The graph captures relationships such as:

```text
Gateway
   |
   v
Route
   |
   v
Function
   |
   v
Database Table
   |
   v
Connection Pool
   |
   v
Database Role
```

This allows CULPRIT to answer questions such as:

- Which route can reach a vulnerable function?
- Which database table can be affected?
- Which service depends on the implicated component?
- What is the potential blast radius?
- Does a vulnerability affect the proposed rollback target?
- Which components would be affected by a mitigation?

---

# 16. Graph Example

Conceptually:

```text
Gateway
   |
   +--> /products
           |
           v
      list_products()
           |
           +--> inventory table
           |
           +--> DB connection pool
                         |
                         v
                     PostgreSQL
```

If a vulnerability exists inside:

```text
list_products()
```

the graph can establish whether:

```text
Gateway
   ↓
/products
   ↓
list_products()
   ↓
inventory
```

is a reachable attack path.

This provides contextual evidence instead of treating scanner findings as isolated alerts.

---

# 17. Security Scanning

CULPRIT integrates three classes of security analysis.

## 17.1 SAST

Static Application Security Testing is performed with Semgrep.

Local rules include:

```text
scanners/rules/sql-fstring-exec.yaml
scanners/rules/weak-hash.yaml
scanners/rules/subprocess-shell.yaml
```

The scanner analyzes:

```text
v1.3.0
v1.4.0
v1.5.0
```

Findings are normalized into deterministic identifiers:

```text
SAST-001
SAST-002
SAST-003
...
```

---

# 18. SCA

Software Composition Analysis is performed with Trivy.

Example command:

```bash
trivy fs \
  --scanners vuln \
  --format json \
  .
```

The goal is to identify vulnerable dependencies and determine whether they exist in:

- Current release
- Previous release
- Proposed rollback target

This is important because a rollback can potentially reintroduce a previously known dependency vulnerability.

---

# 19. DAST

Dynamic Application Security Testing uses OWASP ZAP.

The API specification is exposed through:

```text
/openapi.json
```

ZAP scans the running application.

The resulting findings are normalized into deterministic IDs:

```text
DAST-001
DAST-002
...
```

---

# 20. Cross-Version Finding Fingerprints

Security findings are not treated as isolated scanner outputs.

CULPRIT maintains fingerprints so that it can determine:

```text
Is this vulnerability new?

Was it fixed?

Was it reintroduced?

Does it exist in the rollback target?

Does the vulnerable code path still exist?
```

For example:

```text
v1.3.0 → SQLi finding
v1.4.0 → SQLi finding
v1.5.0 → SQLi finding
```

means that rolling back to v1.4.0 does not necessarily remove the security risk.

---

# 21. Incident Scenarios

CULPRIT currently demonstrates two primary scenarios.

---

## Scenario A — Exploitation

Scenario A injects malicious traffic containing a SQL time-delay payload into:

```text
:8080
```

The resulting behavior may resemble:

```text
Suspicious request
       ↓
SQL-related vulnerable route
       ↓
Database delay
       ↓
Latency spike
       ↓
Gateway p95 increases
       ↓
Error/timeout rate increases
```

The agent must distinguish this from a normal performance regression.

Evidence can include:

```text
LOG-n
SAST-n
DAST-n
FILE:path:line
GRAPH:id
```

A critical aspect of Scenario A is rollback safety.

If the SQL injection vulnerability also exists in v1.4.0, CULPRIT must reject:

```text
ROLLBACK → v1.4.0
```

even if v1.4.0 is otherwise a stable release.

---

# 22. Scenario B — Regression

Scenario B shifts:

```text
100%
```

of traffic to:

```text
v1.5.0
```

The new version contains an N+1 inventory access pattern that can cause excessive database activity.

Conceptually:

```text
Request
  |
  +--> Fetch products
          |
          +--> Query inventory
          +--> Query inventory
          +--> Query inventory
          +--> ...
```

Instead of:

```text
1 request
1 database operation
```

the application performs:

```text
1 request
N database operations
```

As traffic increases:

```text
Traffic
   ↓
N+1 queries
   ↓
DB pool pressure
   ↓
Increased latency
   ↓
Timeouts
   ↓
Error rate increase
```

CULPRIT correlates this with:

- Release change
- Git diff
- Runtime metrics
- Database behavior
- Graph relationships
- Previous-version performance

---

# 23. Hypothesis Correlation

CULPRIT builds an evidence-backed hypothesis assessment.

Conceptually:

```text
                    INCIDENT
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
    EXPLOIT        REGRESSION        INFRA
       |               |               |
   Security        Git diff        Runtime
   findings        Release         metrics
   Logs            behavior        health
   Graph           DB queries      dependencies
       |               |               |
       +---------------+---------------+
                       |
                       v
                Evidence Ranking
                       |
                       v
                Root-Cause Report
```

The system should not simply produce:

```text
Root cause: regression
```

Instead, it should explain:

```text
Hypothesis: REGRESSION

Confidence:
High

Supporting evidence:
- LOG-...
- DIFF-...
- GRAPH-...
- FILE-...

Contradicting evidence:
- ...

Why competing hypotheses were rejected:
- EXPLOIT ...
- INFRA ...
```

---

# 24. Evidence-Grounded Reasoning

One of the core design principles of CULPRIT is:

> **No unsupported claims.**

Every material claim generated by the agent must resolve to an exact evidence identifier.

Supported evidence types include:

```text
LOG-n
SAST-n
SCA-n
DAST-n
FILE:path:line
DIFF:hunk
GRAPH:id
```

Example:

```text
The latency increase is associated with the inventory route
because the request logs show elevated latency for /inventory
and the v1.5.0 diff introduces repeated inventory lookups.

Evidence:
LOG-142
DIFF-hunk-27
FILE:target_app/v1.5.0/routes/inventory.py:84
GRAPH:route.inventory
```

This makes the investigation auditable.

---

# 25. Strict Citation Resolution

CULPRIT verifies citations before the final report is accepted.

For example:

```text
FILE:target_app/v1.5.0/routes/inventory.py:84
```

must actually resolve to:

```text
target_app/v1.5.0/routes/inventory.py
```

and:

```text
line 84
```

must exist.

Similarly:

```text
LOG-142
```

must correspond to an actual gateway log entry.

This prevents the model from inventing evidence.

---

# 26. Safety Architecture

CULPRIT follows a strict three-layer model:

```text
             GEMMA 4
                |
                v
       Investigation + Proposal
                |
                v
       Deterministic Verifier
                |
                v
         Human Approval
                |
                v
            Execution
```

The model is never given unrestricted shell or production execution privileges.

---

# 27. Model Proposes, Code Verifies, Human Approves

The model may propose:

```text
Rollback to v1.4.0
```

or:

```text
Reduce traffic to v1.5.0
```

or:

```text
Disable affected route
```

But the model cannot directly execute the action.

The verifier evaluates deterministic safety conditions.

Only after verification can the action be presented for operator approval.

---

# 28. Deterministic Preconditions

Preconditions are calculated by code rather than by the LLM.

Examples include:

### Target health

```text
Is the target release healthy?
```

### Registry availability

```text
Does the required image exist?
```

### Schema compatibility

```text
Is the database schema compatible?
```

### Security safety

```text
Does the target release contain an implicated vulnerability?
```

### Dependency compatibility

```text
Will the proposed action break a required dependency?
```

### Configuration compatibility

```text
Are required environment variables/configuration available?
```

The model cannot override these checks.

---

# 29. Rollback Rejection

Rollback is treated as a safety-sensitive operation.

Suppose:

```text
Current:
v1.5.0

Proposed rollback:
v1.4.0
```

and:

```text
SQLi exists in v1.4.0
```

while the incident is attributed to exploitation of that SQLi.

Then:

```text
Rollback → REJECTED
```

even if:

```text
v1.4.0 = Last Known Good
```

This prevents a common failure mode where reliability remediation accidentally restores a known security vulnerability.

---

# 30. Mitigation Lifecycle

A proposed mitigation follows:

```text
Incident
   ↓
Hypothesis
   ↓
Evidence
   ↓
Candidate Mitigation
   ↓
Deterministic Preconditions
   ↓
Safety Verification
   ↓
Human Approval
   ↓
Execution
   ↓
Post-Action Verification
```

The system should never skip the verification stage.

---

# 31. REPLAY Mode

CULPRIT supports an offline mode:

```env
CULPRIT_MODE=REPLAY
```

REPLAY mode uses cached investigation artifacts from:

```text
cache/
```

No external LLM or network dependency is required for the cached investigation flow.

This provides:

- Deterministic demonstrations
- Offline judging
- Repeatable investigations
- Faster testing
- Resilience when API access is unavailable

The replayed investigation should preserve the same evidence identifiers and report structure used by LIVE mode.

---

# 32. LIVE Mode

LIVE mode:

```env
CULPRIT_MODE=LIVE
```

connects to the configured services and LLM.

The investigation can use:

- Live gateway telemetry
- Live application behavior
- Live Neo4j graph
- Live scanner output
- Live release state
- Configured Gemma 4 model

This allows the demonstration to show that the system is not merely a static chatbot over prewritten incident reports.

---

# 33. LIVE vs Seeded vs Replayed

| Component | Mode | Description |
|---|---|---|
| Gateway | LIVE | Real reverse proxy and request telemetry |
| Target Apps | LIVE | Real FastAPI containers |
| PostgreSQL | LIVE | Real database |
| Neo4j | LIVE | Real code/dependency graph |
| SAST | LIVE SCAN | Semgrep scans code |
| SCA | LIVE SCAN | Trivy scans dependencies |
| DAST | LIVE SCAN | ZAP scans running API |
| Incident Traffic | INJECTED | Controlled scenario traffic |
| Release Ledger | SEEDED | Initial release state |
| Service Manifest | CONFIG | Explicit topology and policy data |
| Investigation Cache | REPLAY | Offline cached runs |

This distinction is important because CULPRIT combines **real system behavior** with **controlled incident injection**.

---

# 34. Service Manifest

The service manifest describes the system topology and safety-relevant configuration.

It can contain information such as:

```text
Service
Version
Route
Database
Database Role
Maximum Pool Size
Image
Port
Dependencies
Permissions
Health Endpoint
```

This provides deterministic infrastructure context to the verifier and agent.

---

# 35. Database Model

PostgreSQL is used by the target applications.

The database provides realistic failure and performance behavior for the scenarios.

Important relationships include:

```text
Application
    |
    v
Database Role
    |
    v
Connection Pool
    |
    v
PostgreSQL
    |
    +--> Products
    +--> Inventory
    +--> Orders
```

This information is also reflected in the Neo4j blast-radius graph.

---

# 36. Why Neo4j?

Traditional log correlation can answer:

> "What happened?"

A graph can additionally answer:

> "What is connected to what?"

For incident response this distinction is important.

For example:

```text
Vulnerable Function
        |
        v
Route
        |
        v
Gateway
        |
        v
External Traffic
```

and:

```text
Vulnerable Function
        |
        v
Database Table
        |
        v
Database Role
        |
        v
Other Services
```

Together these relationships provide a potential blast-radius model.

---

# 37. AI Agent Workflow

The Gemma 4 agent follows an investigation workflow similar to:

```text
1. Receive incident signal

2. Collect operational evidence

3. Identify affected services/routes

4. Query security findings

5. Inspect relevant code changes

6. Query Neo4j topology

7. Compare application versions

8. Form competing hypotheses

9. Gather supporting evidence

10. Gather contradictory evidence

11. Rank hypotheses

12. Generate root-cause explanation

13. Generate mitigation candidates

14. Submit candidates to deterministic verifier

15. Remove unsafe actions

16. Generate evidence-grounded report
```

The agent is therefore used for **reasoning and correlation**, while critical safety decisions remain deterministic.

---

# 38. Example Investigation

An incident starts with:

```text
p95 latency: 110 ms → 4.9 s
error rate: 0.3% → 17%
```

The agent investigates.

### Step 1 — Gateway

The gateway shows:

```text
LOG-142
LOG-143
LOG-144
```

with suspicious request patterns.

### Step 2 — SAST

Semgrep identifies:

```text
SAST-003
```

on the affected route.

### Step 3 — DAST

ZAP identifies a related exploitable behavior:

```text
DAST-002
```

### Step 4 — Graph

Neo4j establishes:

```text
GRAPH:route.products
    ↓
GRAPH:function.list_products
    ↓
GRAPH:table.inventory
```

### Step 5 — Hypothesis comparison

CULPRIT evaluates:

```text
EXPLOIT       → Strong evidence
REGRESSION    → Weak evidence
INFRA         → Contradictory evidence
```

### Step 6 — Mitigation

The agent proposes:

```text
Rollback to v1.4.0
```

### Step 7 — Verifier

The verifier discovers:

```text
SAST-003 also exists in v1.4.0
```

Therefore:

```text
ROLLBACK → REJECTED
```

The unsafe recommendation never reaches execution.

---

# 39. Example Regression Investigation

Suppose the incident begins after traffic moves to v1.5.0.

The system observes:

```text
v1.4.0
p95 = 130 ms

v1.5.0
p95 = 3.7 s
```

The graph identifies repeated database access.

The Git diff shows:

```text
DIFF-hunk-27
```

The corresponding source location is:

```text
FILE:target_app/v1.5.0/routes/inventory.py:84
```

The agent correlates:

```text
100% traffic to v1.5.0
        +
new N+1 logic
        +
increased DB calls
        +
connection pool pressure
        +
latency increase
```

The result:

```text
REGRESSION
```

with evidence references attached to each material claim.

---

# 40. Report Structure

A generated CULPRIT report should contain:

## Incident Summary

```text
What happened?
When did it happen?
Which services were affected?
```

## Impact

```text
Latency
Error rate
Affected routes
Affected versions
```

## Root-Cause Assessment

```text
Primary hypothesis
Confidence
Supporting evidence
Contradicting evidence
```

## Competing Hypotheses

```text
EXPLOIT
REGRESSION
INFRA
```

with evidence for and against each.

## Blast Radius

```text
Affected services
Routes
Functions
Database objects
Roles
Dependencies
```

## Security Context

```text
SAST
SCA
DAST
Cross-version findings
```

## Recommended Mitigation

```text
Action
Target
Expected effect
Risks
```

## Safety Verification

```text
Preconditions
Passed
Failed
Rejected actions
```

## Approval

```text
Human approval required
```

---

# 41. Acceptance Testing

CULPRIT contains stage-by-stage acceptance checks.

Run:

```bash
make check-s0
```

### S0 — Infrastructure Health

Validates:

- Docker services
- Network connectivity
- PostgreSQL
- Redis
- Neo4j
- Application containers

---

```bash
make check-s1
```

### S1 — Target Application Registry & Performance

Validates:

- Application versions
- Blue/Green services
- Health endpoints
- Baseline performance
- Database connectivity

---

```bash
make check-s2
```

### S2 — Security Normalization

Validates:

- Semgrep execution
- Trivy execution
- ZAP execution
- Finding normalization
- Deterministic finding IDs
- Cross-version fingerprints

---

```bash
make check-s3
```

### S3 — Gateway Routing & Scenario Injection

Validates:

- Gateway routing
- Traffic weights
- Request logging
- Rolling metrics
- Scenario A
- Scenario B

---

```bash
make check-s4
```

### S4 — Neo4j Graph Queries

Validates:

- Graph ingestion
- Nodes
- Relationships
- Route reachability
- Blast-radius queries

---

```bash
make check-s5
```

### S5 — Preconditions, Verifier & Executor

Validates:

- Deterministic preconditions
- Safety policies
- Rollback rejection
- Target health
- Registry checks
- Schema compatibility
- Human approval gate

---

```bash
make check-s6
```

### S6 — GenAI Agent & Report Verification

Validates:

- Agent invocation
- Hypothesis generation
- Evidence correlation
- Citation resolution
- Report structure
- Unsupported-claim rejection

---

```bash
make check-s7
```

### S7 — UI Build & Mock Server

Validates:

- Frontend build
- UI routes
- Mock API
- Investigation rendering
- Report display

---

```bash
make check-s8
```

### S8 — Full Integration

Runs the complete system validation.

This is the final end-to-end acceptance test.

---

# 42. Recommended Test Sequence

For development:

```bash
make check-s0
make check-s1
make check-s2
make check-s3
make check-s4
make check-s5
make check-s6
make check-s7
make check-s8
```

Or run the full demo first:

```bash
make demo
```

then:

```bash
make check-s8
```

---

# 43. Running Individual Services

If debugging is required, services can be inspected independently.

List containers:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs
```

Follow logs:

```bash
docker compose logs -f
```

Inspect a specific service:

```bash
docker compose logs -f culprit-api
```

Restart services:

```bash
docker compose restart
```

Stop the stack:

```bash
docker compose down
```

Remove volumes when a completely clean environment is required:

```bash
docker compose down -v
```

Use the volume-removal command carefully because it deletes persisted container data.

---

# 44. Observability

The most important operational signals are:

```text
Request volume
p50 latency
p95 latency
Error rate
Version distribution
Database behavior
```

These are combined with:

```text
Security findings
Git changes
Topology
Release history
```

The purpose is to avoid treating an operational metric in isolation.

For example:

```text
High latency
```

alone does not establish:

```text
Regression
```

But:

```text
High latency
+
only v1.5.0 affected
+
recent code change
+
N+1 database behavior
+
healthy v1.4.0
```

provides substantially stronger evidence.

---

# 45. Design Principles

## Evidence First

The agent should reason from available evidence rather than fabricate explanations.

## Hypothesis Competition

Multiple explanations are evaluated instead of selecting the first plausible cause.

## Deterministic Safety

Safety-critical conditions are checked using deterministic code.

## Least Privilege

The AI agent does not receive unrestricted production access.

## Human-in-the-Loop

High-impact actions require explicit operator approval.

## Auditability

Important claims and actions have resolvable evidence identifiers.

## Reproducibility

REPLAY mode allows investigations to be reproduced without external dependencies.

## Cross-Domain Correlation

Security, reliability, application code, infrastructure, and release information are analyzed together.

---

# 46. Why Gemma 4?

Gemma 4 is used as the reasoning engine because CULPRIT requires an agent capable of working across multiple evidence modalities and performing structured investigation.

The model is responsible for tasks such as:

```text
Evidence interpretation
Hypothesis formation
Hypothesis comparison
Tool selection
Evidence prioritization
Root-cause explanation
Mitigation generation
Report generation
```

However, CULPRIT deliberately does **not** treat the model's output as authoritative.

The model's role is:

```text
Reason → Recommend
```

rather than:

```text
Reason → Execute
```

---

# 47. Why This Architecture Matters

A conventional AI incident assistant might work like:

```text
Logs → LLM → Answer
```

CULPRIT uses a more constrained architecture:

```text
Logs
Security
Code
Git
Graph
Releases
Metrics
   |
   v
Evidence Layer
   |
   v
Gemma 4 Investigation
   |
   v
Hypothesis Assessment
   |
   v
Mitigation Proposal
   |
   v
Deterministic Safety Verification
   |
   v
Human Approval
```

This separation is fundamental to the project's safety model.

---

# 48. Failure Modes Addressed

CULPRIT specifically addresses several common incident-response failure modes.

### Failure Mode 1: Premature Root Cause

An engineer sees a deployment and immediately blames the deployment.

CULPRIT:

```text
compares multiple hypotheses
```

---

### Failure Mode 2: Security and Reliability Silos

A performance incident may actually be caused by exploitation.

CULPRIT:

```text
correlates runtime behavior with security findings
```

---

### Failure Mode 3: Unsafe Rollback

A previous release may contain the vulnerability currently being exploited.

CULPRIT:

```text
checks the rollback target before approval
```

---

### Failure Mode 4: AI Hallucination

The model may generate an unsupported explanation.

CULPRIT:

```text
requires resolvable evidence citations
```

---

### Failure Mode 5: AI-Controlled Production Actions

An agent could otherwise execute an unsafe command.

CULPRIT:

```text
model → proposal
code → verification
human → approval
```

---

# 49. Security Model

CULPRIT follows the principle that an AI agent should not automatically inherit the privileges of the systems it investigates.

The architecture therefore separates:

```text
Read / Investigate
```

from:

```text
Write / Execute
```

The agent can reason about a proposed action, while deterministic policy code determines whether that action is permitted.

This significantly reduces the impact of an incorrect model decision.

---

# 50. Reproducibility

A complete investigation should be reproducible using:

```text
Scenario
Version state
Gateway logs
Security findings
Graph state
Release ledger
Agent configuration
Cached outputs
```

REPLAY mode provides a mechanism for reproducing the investigation without depending on live infrastructure.

---

# 51. Demo Flow

For a live demonstration, the recommended sequence is:

```text
1. Start the stack

   make demo

2. Open the UI

   http://localhost:5173

3. Show baseline system health

4. Select Scenario A or Scenario B

5. Inject the incident

6. Observe latency/error changes

7. Start CULPRIT investigation

8. Show evidence collection

9. Show competing hypotheses

10. Show Neo4j blast radius

11. Show security findings

12. Show root-cause reasoning

13. Show mitigation proposal

14. Show deterministic verification

15. Demonstrate rejected unsafe rollback

16. Show final evidence-grounded report
```

The most important demonstration is not simply that the model identifies a root cause.

It is that the system can explain:

```text
Why it believes the root cause is correct
+
What evidence supports it
+
What alternatives were considered
+
Why a mitigation is safe or unsafe
```

---

# 52. Example Final Decision

A representative output could look conceptually like:

```text
INCIDENT
--------
Elevated latency and database timeout rate on /products.

PRIMARY HYPOTHESIS
------------------
EXPLOIT

CONFIDENCE
----------
High

SUPPORTING EVIDENCE
-------------------
LOG-142
SAST-003
DAST-002
FILE:target_app/v1.5.0/routes/products.py:71
GRAPH:route.products

COMPETING HYPOTHESES
--------------------
REGRESSION
Evidence: DIFF-hunk-14
Assessment: Possible but insufficient

INFRA
Evidence: system-wide health
Assessment: Rejected

PROPOSED MITIGATION
-------------------
Rollback to v1.4.0

VERIFICATION
------------
REJECTED

Reason:
The implicated SQL injection vulnerability is also present
in v1.4.0.

ACTION
------
Rollback blocked.
Human operator should apply an alternative mitigation.
```

The important property is that the unsafe rollback does not execute merely because the LLM suggested it.

---

# 53. Project Value

CULPRIT is designed around a central operational problem:

> **Incident response requires correlating evidence across systems faster than humans can manually do it, but remediation decisions cannot safely be delegated entirely to an LLM.**

CULPRIT therefore combines:

```text
AI reasoning
+
Security intelligence
+
Observability
+
Code intelligence
+
Graph analysis
+
Deterministic verification
+
Human approval
```

This creates an architecture for AI-assisted incident response that is both **autonomous in investigation** and **constrained in execution**.

---

# 54. Quick Reference

## Start

```bash
make demo
```

## UI

```text
http://localhost:5173
```

## API

```text
http://localhost:9000
```

## Gateway

```text
http://localhost:8080
```

## Blue

```text
http://localhost:8001
```

## Green

```text
http://localhost:8002
```

## Neo4j

```text
http://localhost:7474
```

## Registry

```text
http://localhost:5000
```

## Run all acceptance tests

```bash
make check-s8
```

## Stop

```bash
docker compose down
```

## Replay mode

```env
CULPRIT_MODE=REPLAY
```

## Live mode

```env
CULPRIT_MODE=LIVE
```

---

# 55. Final Architecture Summary

CULPRIT can be summarized as:

```text
                 PRODUCTION INCIDENT
                         |
                         v
                 +---------------+
                 | Gateway       |
                 | Telemetry     |
                 +-------+-------+
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
   Security           Code/Git         Runtime
   Findings           Changes          Metrics
        |                |                |
        +----------------+----------------+
                         |
                         v
                  +-------------+
                  |   Neo4j     |
                  | Blast Radius|
                  +------+------+
                         |
                         v
                  +-------------+
                  |   Gemma 4   |
                  | Investigator|
                  +------+------+
                         |
                         v
              +----------------------+
              | Competing Hypotheses |
              | EXPLOIT / REGRESSION |
              | / INFRA              |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | Evidence-Grounded    |
              | Root-Cause Report    |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | Mitigation Proposal  |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | Deterministic        |
              | Safety Verifier      |
              +----------+-----------+
                         |
                  +------+------+
                  |             |
                REJECT        PASS
                  |             |
                  |             v
                  |      Human Approval
                  |             |
                  |             v
                  |          Execute
                  |
                  v
              Block Action
```

---

# 56. Core Principle

CULPRIT is built around one rule:

> **AI should be autonomous enough to investigate complex incidents, but never autonomous enough to bypass deterministic safety controls.**

The system combines the reasoning capabilities of Gemma 4 with deterministic verification, graph-based blast-radius analysis, security intelligence, and human approval to provide an auditable approach to AI-assisted incident response.