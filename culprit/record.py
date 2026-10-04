import asyncio
import json
import os
from pathlib import Path
import sys
import time
from typing import Any, Dict, List
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from culprit.agent import InvestigationAgent
from culprit.executor import Executor
from culprit.tools import list_findings, get_metrics, blast_radius
from ledger import Ledger
from scenarios.inject import start_scenario_a, start_scenario_b, reset_scenario

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")


async def record_scenario_run(scenario_name: str) -> Dict[str, Any]:
    print(f"\n==================================================")
    print(f"  RECORDING SCENARIO: {scenario_name.upper()}")
    print(f"==================================================")

    # 1. Reset baseline
    reset_scenario(GATEWAY_URL)
    time.sleep(1)

    # 2. Inject Scenario
    if scenario_name == "scenario_a":
        start_scenario_a(GATEWAY_URL, burst_count=8, sleep_delay=8)
    else:
        start_scenario_b(GATEWAY_URL, num_requests=10)

    time.sleep(1)

    # 3. Run Agent Investigation & Stream Events
    agent = InvestigationAgent()
    events = []
    report_data = None
    verification_data = None

    async for ev in agent.investigate_stream():
        events.append(ev)
        ev_type = ev.get("event")
        if ev_type == "tool_call":
            print(f"  [Agent Tool Call] {ev['data']['tool']}")
        elif ev_type == "report":
            report_data = ev["data"]
            print(f"  [Agent Report] Verdict: {report_data['verdict'].upper()} (OWASP: {report_data.get('owasp')})")
        elif ev_type == "verification":
            verification_data = ev["data"]
            print(f"  [Verifier] Valid: {verification_data['valid']} (Citations checked: {verification_data['citations_checked']})")

    # 4. Record Mitigation Execution & Verification
    executor = Executor(GATEWAY_URL)
    mitigation_records = []

    if report_data and report_data.get("mitigations"):
        top_mitigation = report_data["mitigations"][0]
        action = top_mitigation["action"]
        params = top_mitigation["params"]

        # Preview
        preview = executor.preview(action, params)
        print(f"  [Mitigation Preview] {action} -> {preview.get('proposed_changes')}")

        # Execute
        executed = executor.execute(action, params)
        act_id = executed["action_id"]
        print(f"  [Mitigation Executed] ID: {act_id}")

        # Verify Recovery
        recovery = executor.verify_recovery(act_id, duration_seconds=1)
        print(f"  [Recovery Verify] Status: {recovery['status']}")

        # Undo
        undo_res = executor.undo(act_id)
        print(f"  [Mitigation Undo] Restored state successfully.")

        mitigation_records.append({
            "preview": preview,
            "execution": executed,
            "recovery": recovery,
            "undo": undo_res,
        })

    # Save to cache
    output_file = CACHE_DIR / f"{scenario_name}.json"
    data = {
        "scenario": scenario_name,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "events": events,
        "report": report_data,
        "verification": verification_data,
        "mitigations": mitigation_records,
    }
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Saved recording to {output_file}")
    reset_scenario(GATEWAY_URL)
    return data


def record_static_cache():
    """Record static snapshots of state, metrics, and graph for offline replay mode."""
    # State snapshot
    state_file = CACHE_DIR / "state.json"
    state_data = {
        "mode": "REPLAY",
        "status": "ok",
        "active_scenario": "none",
        "lkg": Ledger().get_lkg() or "1.4.0",
        "findings_count": len(list_findings()),
        "gateway_metrics": get_metrics(),
    }
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state_data, f, indent=2)

    # Metrics snapshot
    metrics_file = CACHE_DIR / "metrics.json"
    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump(get_metrics(), f, indent=2)

    # Graph snapshot
    graph_file = CACHE_DIR / "graph.json"
    with open(graph_file, "w", encoding="utf-8") as f:
        json.dump(blast_radius(finding_id="SAST-002"), f, indent=2)

    print("Saved static cache snapshots to cache/")


async def main():
    print("Starting full scenario recording for REPLAY mode...")
    await record_scenario_run("scenario_a")
    await record_scenario_run("scenario_b")
    record_static_cache()
    print("\n[SUCCESS] Full recording completed and saved to cache/!")


if __name__ == "__main__":
    asyncio.run(main())
