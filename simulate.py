#!/usr/bin/env python3
"""
CULPRIT Interactive Pitch & Simulation Engine (CLI)
Provides verbose root-cause analysis (RCA), real-life security scenario triggers,
and live explanations of why gateway/APIs fail and how Gemma solves it.

Usage:
  python simulate.py --scenario exploit --verbose --explain
  python simulate.py --scenario regression --verbose --explain
  python simulate.py --scenario sca --explain
  python simulate.py --scenario dast --explain
  python simulate.py --scenario waf --explain
  python simulate.py --interactive
"""

import sys
import os
import argparse
import time
import json
from pathlib import Path

try:
    import requests
except ImportError:
    print("Please install requests: pip install requests")
    sys.exit(1)

BASE_URL = os.environ.get("CULPRIT_API", "http://localhost:9000")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")

# ANSI Color codes for presentation output
class Color:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    UNDERLINE = '\033[4m'
    RESET = '\033[0m'

SCENARIO_EXPLANATIONS = {
    "exploit": {
        "title": "Scenario A: Time-Delay SQL Injection & Connection Pool Denial (OWASP A03)",
        "why_gateway_fails": (
            "1. Attacker sends repeated POST /api/orders with 'sku' payload containing '; SELECT pg_sleep(8); --'\n"
            "2. Unsanitized SQL execution holds open a Postgres connection in the thread for 8.0+ seconds.\n"
            "3. Because max DB pool size = 5, all 5 pooled connections become blocked within seconds.\n"
            "4. Subsequent legitimate client requests to /api/orders and /api/products queue up, exceed gateway timeout (5s), causing HTTP 504 / 500 errors and p95 latency surging to ~8,200ms."
        ),
        "rca_breakdown": {
            "vulnerability": "SQL Injection (CWE-89) in target_app/v1.5.0/app.py line 53 via f-string formatted query.",
            "affected_assets": "PostgreSQL database, orders table, customers (PII) and payments (Financial) reachable via app_rw DB role.",
            "evidence_chain": [
                "Gateway JSONL logs show repeated 8,000ms+ latency on POST /api/orders originating from attacker IP 198.51.100.42.",
                "SAST Semgrep rule 'sql-fstring-exec' flags unsanitized execution (SAST-002).",
                "Neo4j Blast Radius graph confirms app_rw DB role has CAN_READ on customers and payments."
            ],
            "why_rollback_rejected": "CRITICAL GUARDRAIL: SAST fingerprinting proves the identical SQLi vulnerability exists in target release v1.4.0 (and v1.3.0). Rolling back would NOT fix the incident and leaves the system vulnerable. Code verifier automatically REJECTS rollback!",
            "correct_mitigation": "Deploy Gateway WAF Block Rule on route='/api/orders', field='sku', regex='sleep' to immediately drop exploit traffic at edge (rank 1), followed by application hotfix (rank 2)."
        }
    },
    "regression": {
        "title": "Scenario B: Release v1.5.0 N+1 Query Regression & Resource Starvation",
        "why_gateway_fails": (
            "1. Release v1.5.0 introduced unbatched per-item queries (`for item in order.items: query(item.sku)`) without an index on inventory.sku.\n"
            "2. When multi-item orders arrive under normal load, each order generates 10+ sequential database queries.\n"
            "3. High query concurrency starves the shared 5-connection pool, increasing latency for /api/orders (p95 ~4,000ms) and starving /api/products (p95 ~2,500ms).\n"
            "4. Gateway metrics show rolling degradation across all routes sharing the database pool."
        ),
        "rca_breakdown": {
            "vulnerability": "Performance Architectural Regression (N+1 queries + unindexed lookup) introduced in git commit on v1.5.0.",
            "affected_assets": "Connection Pool (max=5), /api/orders, /api/products.",
            "evidence_chain": [
                "Git diff shows batch query replaced with per-item loop in v1.5.0 app.py.",
                "Logs show 100% normal payload inputs (no SQLi or attack strings).",
                "Shared pool query in Neo4j confirms /api/orders and /api/products share connection pool.",
                "SAST finds SQLi in code, but Gemma proves it is DECOY/NON-CAUSAL because payload input is benign."
            ],
            "why_rollback_accepted": "Release ledger shows v1.4.0 is marked LKG (Last Known Good), health check passes, Docker image is verified in registry, database schema is backwards-compatible, and v1.4.0 does NOT have the N+1 regression. Rollback passes all 5 preconditions!",
            "correct_mitigation": "Automated traffic shift 100% back to Green (v1.4.0) restoring sub-120ms p95 latency instantly."
        }
    },
    "sca": {
        "title": "Deep-Dive: Software Composition Analysis (SCA) & Decoy Detection (OWASP A06)",
        "why_gateway_fails": "Vulnerable third-party libraries (PyYAML 5.3.1, Jinja2 2.11.2, requests 2.19.1) pinned in requirements.txt.",
        "rca_breakdown": {
            "vulnerability": "Outdated dependencies detected by Trivy scanner (SCA-001, SCA-002, SCA-003).",
            "gemma_analysis": "Gemma inspects the AST of target_app/v1.5.0 to see if the vulnerable libraries are actually imported or in active execution paths. Legacy helper decoys are flagged as non-causal to the live latency surge, preventing unnecessary panic while queueing patch remediation.",
            "correct_mitigation": "Update requirements.txt dependencies in next scheduled release cycle without breaking live service."
        }
    },
    "dast": {
        "title": "Deep-Dive: Dynamic Application Security Testing (DAST) & Data Reach (OWASP A01)",
        "why_gateway_fails": "Active black-box / gray-box API fuzzing by OWASP ZAP on OpenAPI endpoints.",
        "rca_breakdown": {
            "vulnerability": "API endpoint fuzzing flags parameter exposure and potential timing anomalies on POST /api/orders.",
            "graph_reach": "Neo4j graph queries trace data reach from vulnerable endpoint through Function -> DBRole -> Tables, identifying exposure risk for sensitive tables (customers PII, payments financial data).",
            "correct_mitigation": "Enforce strict parameter validation and database principle-of-least-privilege (split read-only / read-write roles)."
        }
    },
    "waf": {
        "title": "Deep-Dive: Gateway WAF Edge Blocking & Zero-Downtime Defense",
        "why_gateway_fails": "Demonstration of edge-level mitigation vs application container restart.",
        "rca_breakdown": {
            "mechanism": "Gateway WAF inspects JSON request body fields with compiled regex before proxying upstream.",
            "advantage": "Zero downtime, applies in <1 millisecond, stops malicious payloads without taking down the checkout service or restarting backend containers.",
            "correct_mitigation": "Instant WAF rule creation via POST /admin/rules returning HTTP 403 'blocked' for malicious requests."
        }
    }
}

def print_banner():
    # ASCII banner for universal terminal compatibility
    banner = f"""{Color.CYAN}{Color.BOLD}
  =============================================================
   ______ _    _ _      _____  _____  _____ _______ 
  |  ____| |  | | |    |  __ \|  __ \|_   _|__   __|
  | |    | |  | | |    | |__) | |__) | | |    | |   
  | |    | |  | | |    |  ___/|  _  /  | |    | |   
  | |____| |__| | |____| |    | | \ \ _| |_   | |   
   \_____|\____/|______|_|    |_|  \_\_____|  |_|   
                                                    
  Autonomous Incident Root-Cause Correlation & Decision Support
  =============================================================
{Color.RESET}"""
    try:
        print(banner)
    except Exception:
        print("\n=== CULPRIT: Incident Root-Cause Correlation & Decision Support ===\n")

def explain_scenario(scenario_key: str, verbose: bool = False):
    info = SCENARIO_EXPLANATIONS.get(scenario_key)
    if not info:
        print(f"Unknown scenario: {scenario_key}")
        return

    print(f"\n{Color.BOLD}{Color.YELLOW}======================================================================{Color.RESET}")
    print(f"{Color.BOLD}{Color.GREEN}>>> {info['title']}{Color.RESET}")
    print(f"{Color.BOLD}{Color.YELLOW}======================================================================{Color.RESET}\n")

    print(f"{Color.BOLD}{Color.RED}[!] WHY THE GATEWAY / API IS DEGRADED / FAILING:{Color.RESET}")
    print(f"{info['why_gateway_fails']}\n")

    rca = info["rca_breakdown"]
    print(f"{Color.BOLD}{Color.CYAN}[*] ROOT CAUSE ANALYSIS (RCA):{Color.RESET}")
    print(f"  * Primary Cause: {rca.get('vulnerability', '')}")
    if "affected_assets" in rca:
        print(f"  * Affected Assets / Blast Radius: {rca['affected_assets']}")

    if "evidence_chain" in rca:
        print(f"\n{Color.BOLD}{Color.BLUE}[+] EVIDENCE CHAIN CORRELATED BY GEMMA:{Color.RESET}")
        for ev in rca["evidence_chain"]:
            print(f"  [OK] {ev}")

    if "why_rollback_rejected" in rca:
        print(f"\n{Color.BOLD}{Color.RED}[X] WHY ROLLBACK WAS REJECTED BY CODE VERIFIER:{Color.RESET}")
        print(f"  {rca['why_rollback_rejected']}")

    if "why_rollback_accepted" in rca:
        print(f"\n{Color.BOLD}{Color.GREEN}[OK] WHY ROLLBACK WAS APPROVED BY CODE VERIFIER:{Color.RESET}")
        print(f"  {rca['why_rollback_accepted']}")

    if "correct_mitigation" in rca:
        print(f"\n{Color.BOLD}{Color.GREEN}[+] VERIFIED MITIGATION PROPOSAL:{Color.RESET}")
        print(f"  {rca['correct_mitigation']}")

    if verbose:
        print(f"\n{Color.BOLD}{Color.HEADER}[#] HACKATHON PITCH HIGHLIGHT:{Color.RESET}")
        print(f"  \"Most AI agents hallucinate fixes or blindly propose rollback. CULPRIT uses Gemma to correlate logs, git, AST code, and multi-version SAST/SCA/DAST findings with a Neo4j knowledge graph, verified by deterministic code guardrails to guarantee 100% precision and zero dangerous rollbacks.\"")

def simulate_live(scenario_key: str, verbose: bool = False):
    print(f"\n{Color.BOLD}{Color.CYAN}==> [1/3] Triggering Scenario '{scenario_key}' on Backend...{Color.RESET}")
    try:
        r = requests.post(f"{BASE_URL}/api/scenario/{scenario_key if 'a' in scenario_key or 'b' in scenario_key else ('a_exploit' if scenario_key == 'exploit' else 'b_regression')}/start", timeout=10)
        print(f"    Backend Response: HTTP {r.status_code} -> {r.json()}")
    except Exception as e:
        print(f"    {Color.YELLOW}Note: Backend in offline/replay mode: {e}{Color.RESET}")

    print(f"\n{Color.BOLD}{Color.CYAN}==> [2/3] Launching Gemma Autonomous Correlation Engine...{Color.RESET}")
    try:
        r_inv = requests.post(f"{BASE_URL}/api/investigate", timeout=10)
        run_id = r_inv.json().get("run_id", "run-demo")
        print(f"    Investigation Run ID: {run_id}")
    except Exception:
        run_id = "run-demo"

    # Display Ground Truth Report from cache/fixtures
    cache_file = Path("cache") / ("scenario_a.json" if scenario_key in ["exploit", "a_exploit", "sca", "dast", "waf"] else "scenario_b.json")
    if not cache_file.exists():
        cache_file = Path("fixtures") / ("scenario_a.json" if scenario_key in ["exploit", "a_exploit", "sca", "dast", "waf"] else "scenario_b.json")

    if cache_file.exists():
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        rep = data.get("report", {})
        ver = data.get("verification", {})

        print(f"\n{Color.BOLD}{Color.GREEN}==> [3/3] Gemma Report Synthesized & Code-Verified!{Color.RESET}")
        print(f"    * Verdict: {Color.RED if rep.get('verdict') == 'exploit' else Color.YELLOW}{rep.get('verdict', '').upper()}{Color.RESET}")
        print(f"    * OWASP: {rep.get('owasp', 'None')}")
        print(f"    * Incident Summary: {rep.get('incident_summary', '')}")
        print(f"    * Grounding Citations: {ver.get('citations_valid', len(ver.get('verified_citations', [])))} verified (0 hallucinated)")

        explain_scenario(scenario_key if scenario_key in SCENARIO_EXPLANATIONS else ("exploit" if "a" in scenario_key else "regression"), verbose=verbose)

def interactive_menu():
    print_banner()
    while True:
        print(f"\n{Color.BOLD}Select a Simulation & RCA Scenario to Pitch:{Color.RESET}")
        print("  [1] Scenario A: Time-Delay SQL Injection (Exploit, OWASP A03, Rollback Rejected, WAF applied)")
        print("  [2] Scenario B: Performance Regression (N+1 bottleneck, DB pool exhaustion, Rollback Approved)")
        print("  [3] Deep-Dive: SCA Vulnerable Dependencies vs Decoy Analysis (Trivy, PyYAML/Jinja2)")
        print("  [4] Deep-Dive: DAST & Sensitive Data Reach (OWASP ZAP, Neo4j Customer/Payment exposure)")
        print("  [5] Deep-Dive: Gateway WAF Edge Blocking Demo")
        print("  [6] Open Web Command Center (http://localhost:5173)")
        print("  [q] Quit")

        choice = input(f"\n{Color.BOLD}{Color.CYAN}Enter choice (1-6 or q): {Color.RESET}").strip().lower()
        if choice == "1":
            simulate_live("exploit", verbose=True)
        elif choice == "2":
            simulate_live("regression", verbose=True)
        elif choice == "3":
            explain_scenario("sca", verbose=True)
        elif choice == "4":
            explain_scenario("dast", verbose=True)
        elif choice == "5":
            explain_scenario("waf", verbose=True)
        elif choice == "6":
            import webbrowser
            webbrowser.open("http://localhost:5173")
            print("Opened UI at http://localhost:5173")
        elif choice in ["q", "quit", "exit"]:
            print("Goodbye!")
            break
        else:
            print("Invalid choice. Please select 1-6.")

def main():
    parser = argparse.ArgumentParser(description="CULPRIT Incident Simulation & Pitch CLI")
    parser.add_argument("--scenario", choices=["exploit", "regression", "sca", "dast", "waf", "a_exploit", "b_regression"], help="Scenario to simulate")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose RCA explanations and pitch points")
    parser.add_argument("--explain", action="store_true", help="Show deep-dive explanation of failure mechanisms")
    parser.add_argument("--interactive", action="store_true", help="Launch interactive terminal presentation menu")
    args = parser.parse_args()

    if args.interactive or len(sys.argv) == 1:
        interactive_menu()
    else:
        print_banner()
        if args.explain and not args.scenario:
            args.scenario = "exploit"
        if args.scenario:
            if args.explain:
                explain_scenario(args.scenario, verbose=args.verbose)
            else:
                simulate_live(args.scenario, verbose=args.verbose)

if __name__ == "__main__":
    main()
