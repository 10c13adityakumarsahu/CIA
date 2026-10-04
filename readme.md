The core implementation goal is:

Given an incident + evidence from logs/code/git/SAST/SCA/DAST, have Gemma investigate competing hypotheses and produce an evidence-verified conclusion.

1. High-level architecture
                         ┌──────────────────┐
                         │  Demo Web App     │
                         │ FastAPI + Postgres│
                         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                 Incident                    Security
                  Traffic                    Scanners
                    │                    ┌──────┼──────┐
                    ▼                    ▼      ▼      ▼
                  Logs                 SAST    SCA    DAST
                    │                    │      │      │
                    └────────────────────┼──────┼──────┘
                                         ▼
                               ┌──────────────────┐
                               │ Evidence Store   │
                               │ Normalized JSON  │
                               └────────┬─────────┘
                                        │
                                        ▼
                              ┌────────────────────┐
                              │   CULPRIT AGENT    │
                              │      Gemma 4        │
                              └─────────┬──────────┘
                                        │
                            Tool-calling investigation
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  ▼                     ▼                     ▼
              Search logs          Read source            Git diff
                  │                     │                     │
                  └─────────────────────┼─────────────────────┘
                                        ▼
                              Competing hypotheses
                                        │
                                        ▼
                              Structured investigation
                                        │
                                        ▼
                           ┌────────────────────────┐
                           │ Grounding Verifier     │
                           └────────────┬───────────┘
                                        ▼
                               Investigation UI

The key architectural principle is:

Gemma should not directly access everything.

Give it controlled tools. That makes the agent predictable and makes the demo much easier to explain.

2. Build the demo application first
Use a very small FastAPI application.

I'd use an e-commerce domain because everyone understands it.

/api/orders
/api/products
/api/users
/api/payments

But you really only need one important endpoint:

POST /api/orders

with something like:

{
  "product_id": 10,
  "quantity": 2,
  "coupon": "WELCOME10"
}

Have the application interact with PostgreSQL.

3. Create the intentionally vulnerable code
For example, create a deliberately unsafe query path:

query = (
    "SELECT discount "
    "FROM coupons "
    f"WHERE code = '{coupon}'"
)

This gives Semgrep something meaningful to detect.

But don't stop there.

The same code should exist in both incident scenarios.

That's crucial.

4. Create two deterministic incidents
This is the heart of your demo.

Incident A — Attack
The request contains a controlled time-delay SQL injection payload.

Conceptually:

POST /api/orders

coupon=<controlled test payload>

The resulting log contains:

request_id=ATTACK-001
endpoint=/api/orders
database_error=...
query_duration=8.1s
input_pattern=...

The evidence should indicate:

SAST → unsafe SQL
DAST → injection finding
Logs → suspicious input + corresponding delay
Code → unsafe query
Git → no relevant performance change

Gemma should conclude:

LIKELY ATTACK
Confidence: HIGH

Incident B — Regression
Same endpoint.

Same vulnerable code.

Same scanner findings.

But this time the request is completely normal.

The recent code change introduces something like:

for item in items:
    query_database(item)

instead of batching the query.

Now the logs show:

request_id=REGRESSION-001
endpoint=/api/orders
database_error=timeout
query_duration=8.0s
input=normal

And git shows:

commit abc123
Changed order processing
Added database query inside loop

Gemma should conclude:

LIKELY REGRESSION
Confidence: HIGH

The SAST finding remains real, but:

SAST-001
→ RELATED TO CODE
→ NOT CAUSAL TO THIS INCIDENT

That is your killer demonstration.

5. Don't actually exploit anything during the demo
You don't need an exploit framework.

Create controlled requests against your own local application and record deterministic results.

For example:

scenario_attack.json
scenario_regression.json

Each scenario can define:

{
  "scenario": "attack",
  "endpoint": "/api/orders",
  "request_ids": [
    "ATTACK-001",
    "ATTACK-002"
  ]
}

Then your demo can simply run:

python simulate.py attack

or:

python simulate.py regression

This gives you reproducibility.

6. Run real scanners
You don't want mocked scanner results if you can avoid it.

SAST — Semgrep
Run Semgrep against your application.

Output something like:

{
  "check_id": "sql-injection",
  "path": "app/orders.py",
  "start": {
    "line": 42
  },
  "severity": "ERROR"
}

Normalize it.

SCA — Trivy
Run Trivy against your dependencies/container.

Get:

package
version
vulnerability
severity

Normalize that too.

DAST — OWASP ZAP
For hackathon reliability, I agree with your proposal:

Pre-run ZAP and save the JSON.

Don't make the live demo depend on ZAP finishing successfully in real time.

You can show:

DAST scan: completed
Findings: 6

and load the prepared report.

7. Create a unified evidence schema
This is extremely important.

Don't give Gemma five completely different formats.

Convert everything into one schema.

For example:

{
  "id": "SAST-001",
  "source": "sast",
  "type": "sql_injection",
  "severity": "HIGH",
  "file": "app/orders.py",
  "line": 42,
  "endpoint": "/api/orders",
  "description": "Unsafe SQL construction",
  "evidence": "String concatenation used in SQL query"
}

SCA:

{
  "id": "SCA-007",
  "source": "sca",
  "package": "example-lib",
  "severity": "HIGH",
  "cve": "CVE-XXXX",
  "description": "..."
}

Log:

{
  "id": "LOG-193",
  "source": "runtime",
  "timestamp": "...",
  "endpoint": "/api/orders",
  "request_id": "ATTACK-001",
  "message": "Database query exceeded timeout"
}

Git:

{
  "id": "GIT-42",
  "commit": "abc123",
  "file": "app/orders.py",
  "line": 71,
  "change": "Added DB query inside loop"
}

Now your AI has a consistent evidence language.

8. Build the agent tools
This is where I'd spend most of the AI engineering effort.

Give Gemma tools such as:

search_logs
{
  "endpoint": "/api/orders",
  "time_window": "10m"
}

Returns relevant logs.

list_findings
{
  "source": "all",
  "endpoint": "/api/orders"
}

Returns SAST/SCA/DAST findings.

read_file
{
  "path": "app/orders.py",
  "start_line": 30,
  "end_line": 60
}

git_diff
{
  "since": "incident"
}

get_service_manifest
Returns:

{
  "orders-api": {
    "database": "postgres",
    "role": "orders_readwrite"
  }
}

You can add:

get_log_by_id
This is useful for citation verification.

9. Make Gemma investigate rather than summarize
The initial prompt should establish its role.

Conceptually:

You are Culprit, a production incident investigator.

Your job is NOT to list vulnerabilities.

Determine which hypothesis best explains the incident:

1. Security attack
2. Code regression
3. Infrastructure failure

You must investigate the available evidence.

Do not assume a scanner finding caused the incident merely because
it references the same endpoint.

For every conclusion:
- cite evidence IDs
- identify contradicting evidence
- assign confidence
- distinguish causal findings from unrelated findings

Never invent file names, lines, logs, commits or findings.

Then let the model call tools.

10. Agent loop
The basic implementation can be:

while not investigation_complete:

    response = gemma(messages, tools=TOOLS)

    if response.tool_call:
        result = execute_tool(response.tool_call)
        messages.append(result)

    else:
        report = parse_structured_output(response)
        break

You don't need a complex autonomous-agent framework.

For a hackathon, a controlled tool loop is better.

11. Force structured output
Don't let Gemma return arbitrary Markdown.

Make it produce something like:

{
  "incident_summary": "...",

  "hypotheses": [
    {
      "label": "exploit",
      "confidence": 0.91,
      "supporting_evidence": [
        "LOG-193",
        "SAST-001",
        "DAST-002"
      ],
      "contradicting_evidence": []
    },
    {
      "label": "regression",
      "confidence": 0.17,
      "supporting_evidence": [],
      "contradicting_evidence": [
        "LOG-193"
      ]
    }
  ],

  "verdict": {
    "label": "exploit",
    "confidence": 0.91
  },

  "finding_verdicts": [
    {
      "finding_id": "SAST-001",
      "classification": "related",
      "reason": "...",
      "evidence": ["LOG-193"]
    }
  ],

  "remediation": []
}

This makes the UI and verifier straightforward.

12. Build the grounding verifier
This should not use AI.

Make it deterministic.

For every citation:

LOG-193

check:

Does LOG-193 exist?

For:

orders.py:42

check:

Does orders.py exist?
Does line 42 exist?
Does the cited snippet match?

For:

SAST-001

check:

Does SAST-001 exist in normalized findings?

Then calculate:

verified_citations / total_citations

Your UI can show:

12/12 evidence claims verified ✓

This is a fantastic visual.

13. Add the rules baseline
Keep this very simple.

Something like:

if finding.endpoint == incident.endpoint:
    related += finding

if finding.file in changed_files:
    related += finding

if finding.timestamp overlaps incident:
    related += finding

That's your keyword/rule correlation baseline.

Then demonstrate:

Attack scenario
Rules:

Security finding → related

Gemma:

Security attack → 91%

Regression scenario
Rules:

Security finding → related

Gemma:

Regression → 89%
SAST finding → decoy/non-causal

This demonstrates the value of reasoning.

14. UI structure
Keep Streamlit extremely simple.

I'd use four sections.

Header
CULPRIT
AI Production Incident Investigator

Incident #ATTACK-001
POST /api/orders

Section 1 — Incident
5xx          ↑ 38%
Latency      ↑ 8.1s
DB Errors    ↑ 24

Section 2 — Investigation
Show tool calls:

✓ Searching logs...
✓ Reading orders.py:30-60
✓ Checking SAST findings...
✓ Checking DAST findings...
✓ Checking recent git changes...
✓ Comparing attack vs regression...

This is important because judges can see the agent reasoning through tools.

Section 3 — Verdict
┌─────────────────────────────┐
│ LIKELY SECURITY INCIDENT    │
│ Confidence: 91%             │
└─────────────────────────────┘

Why?

✓ Malicious input observed
✓ Corresponding DB delay observed
✓ Vulnerable code path confirmed
✓ DAST finding matches endpoint

Section 4 — Finding funnel
71 Total Findings
       ↓
12 Relevant
       ↓
4 Supporting
       ↓
1 Likely Causal

Clicking a finding should show the evidence.

15. Then run Incident B
Don't change the UI.

Click:

[ Switch Scenario ]

Select:

Regression

Same endpoint.

Same vulnerability.

Same scanner backlog.

Then:

┌─────────────────────────────┐
│ LIKELY CODE REGRESSION      │
│ Confidence: 89%             │
└─────────────────────────────┘

And:

SAST-001
✓ Real vulnerability
✗ Not causal to current incident

This is your money shot.

16. Project directory
I'd keep the repository approximately:

culprit/
│
├── app/
│   ├── main.py
│   ├── orders.py
│   └── database.py
│
├── scenarios/
│   ├── attack/
│   │   ├── config.json
│   │   └── logs.json
│   └── regression/
│       ├── config.json
│       └── logs.json
│
├── scanners/
│   ├── run_sast.py
│   ├── run_sca.py
│   └── zap_report.json
│
├── evidence/
│   ├── findings.json
│   ├── logs.json
│   └── git.json
│
├── agent/
│   ├── agent.py
│   ├── tools.py
│   ├── prompts.py
│   └── schemas.py
│
├── verifier/
│   └── verifier.py
│
├── baseline/
│   └── rules.py
│
├── ui/
│   └── app.py
│
├── docker-compose.yml
├── requirements.txt
└── README.md

17. Four-hour implementation priority
I'd actually modify your proposed schedule slightly.

0:00–0:40 — Application + scenarios
Get:

FastAPI
Postgres
Attack scenario
Regression scenario

working.

Don't touch UI yet.

0:40–1:15 — Evidence pipeline
Get:

logs
SAST
SCA
DAST
git diff

into one normalized JSON structure.

1:15–2:30 — Gemma agent
This is the highest priority.

Implement:

Gemma
 ↓
tool call
 ↓
tool result
 ↓
Gemma
 ↓
structured report

Get one scenario working end-to-end.

2:30–3:00 — Grounding verifier
Implement deterministic citation validation.

This is more valuable than UI polish.

3:00–3:30 — Rules baseline
Implement simple correlation.

Then run:

rules vs Gemma

on both scenarios.

3:30–4:00 — UI
Only expose:

Incident

Agent investigation

Verdict

Evidence

Noise funnel

Rules vs Gemma

18. What should be real?
I'd make this distinction explicit in the UI/README.

Real
FastAPI application

PostgreSQL

Source code

Git history

Semgrep

Trivy

Gemma investigation

Tool calls

Grounding verifier

Rules baseline

Precomputed
ZAP report

Deterministic
Incident traffic

Scenario selection

Log generation

That's completely legitimate for a hackathon POC.

You're demonstrating the investigation system, not pretending to have a live production environment.

19. One thing I would NOT implement
Don't build a generic RAG pipeline like:

PDFs → embeddings → vector DB → LLM

It doesn't fit your core idea.

Your strongest architecture is:

Incident
   ↓
Evidence retrieval
   ↓
Tool-using investigation
   ↓
Hypothesis competition
   ↓
Evidence-backed conclusion
   ↓
Deterministic verification

That's much more technically interesting.

20. Final implementation principle
Think of Culprit as three layers:

Layer 1 — Evidence
What actually happened?

Logs
Code
Git
SAST
SCA
DAST

Layer 2 — Reasoning
What explanation best fits the evidence?

Attack
vs
Regression
vs
Infrastructure

Gemma lives here.

Layer 3 — Trust
Can we prove what the AI said?

Citation verification
Evidence IDs
Source lines
Confidence
Contradicting evidence

This third layer is what can make the project feel substantially more sophisticated than a normal LLM agent.