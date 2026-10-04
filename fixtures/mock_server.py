"""
Mock API server for CULPRIT UI offline development and testing.
Serves responses from fixtures/ with SSE simulation.
"""
import asyncio
import json
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

app = FastAPI(title="CULPRIT Mock API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FIXTURES_DIR = Path(__file__).resolve().parent

# In-memory mock state
mock_state = {
    "active_scenario": None,
    "run_id": "run-mock-001",
    "mitigation_state": {
        "status": "idle",
        "last_action": None,
        "backup_weights": {"blue": 100, "green": 0},
        "current_weights": {"blue": 100, "green": 0},
        "active_rules": [],
    }
}

def load_fixture(name: str) -> Any:
    path = FIXTURES_DIR / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}

@app.get("/health")
def health():
    return {"status": "ok", "mock": True}

@app.get("/api/state")
def get_state():
    data = load_fixture("state.json")
    data["mode"] = "REPLAY"
    data["active_scenario"] = mock_state["active_scenario"]
    return data

@app.get("/api/metrics")
def get_metrics(route: Optional[str] = None, window: int = 60):
    return load_fixture("metrics.json")

@app.get("/api/findings")
def get_findings():
    return load_fixture("findings.json")

@app.get("/api/graph")
def get_graph(finding: Optional[str] = None, route: Optional[str] = None):
    return load_fixture("graph.json")

@app.get("/api/source")
def get_source(path: str = Query(...), start: int = Query(1), end: int = Query(100)):
    # Safely resolve target_app source if possible
    base_dir = FIXTURES_DIR.parent
    clean_path = path.lstrip("/\\")
    target = (base_dir / clean_path).resolve()
    if target.exists() and target.is_relative_to(base_dir):
        lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
        selected = lines[max(0, start - 1):end]
        return {
            "path": clean_path,
            "start": start,
            "end": end,
            "content": "\n".join(selected),
            "total_lines": len(lines)
        }
    return {
        "path": clean_path,
        "start": start,
        "end": end,
        "content": f"# Mock content for {clean_path}\n# Lines {start}-{end}\npass\n",
        "total_lines": 100
    }

@app.get("/api/logs/{log_id}")
def get_log(log_id: str):
    return {
        "id": log_id,
        "ts": "2026-10-04T12:00:00Z",
        "request_id": f"req-{log_id}",
        "route": "/api/orders",
        "method": "POST",
        "status": 500 if "exploit" in str(mock_state["active_scenario"]) else 200,
        "latency_ms": 8200 if "exploit" in str(mock_state["active_scenario"]) else 120,
        "upstream": "blue:8001",
        "version": "1.5.0",
        "client_ip": "198.51.100.42",
        "body_excerpt": "{'sku': \"WIDGET-001'; SELECT pg_sleep(8); --\", 'qty': 1}"
    }

@app.get("/api/ledger")
def get_ledger():
    return [
        {"version": "1.3.0", "status": "stable", "deployed_at": "2026-09-01T00:00:00Z", "p95_ms": 110, "err_rate": 0.0},
        {"version": "1.4.0", "status": "stable", "deployed_at": "2026-09-15T00:00:00Z", "p95_ms": 115, "err_rate": 0.0, "is_lkg": True},
        {"version": "1.5.0", "status": "current", "deployed_at": "2026-10-01T00:00:00Z", "p95_ms": 420, "err_rate": 0.02}
    ]

@app.post("/api/scenario/{scenario_name}/start")
def start_scenario(scenario_name: str):
    mock_state["active_scenario"] = scenario_name
    return {"status": "started", "scenario": scenario_name}

@app.post("/api/scenario/reset")
def reset_scenario():
    mock_state["active_scenario"] = None
    mock_state["mitigation_state"]["status"] = "idle"
    return {"status": "reset"}

@app.post("/api/investigate")
def start_investigate():
    scen = mock_state["active_scenario"] or "a_exploit"
    run_id = f"run-mock-{scen}"
    mock_state["run_id"] = run_id
    return {"run_id": run_id, "status": "started"}

@app.get("/api/investigate/{run_id}/stream")
async def stream_investigation(run_id: str):
    scen_file = "scenario_b.json" if "b" in run_id or (mock_state["active_scenario"] and "b" in mock_state["active_scenario"]) else "scenario_a.json"
    cached = load_fixture(scen_file)
    events = cached.get("events", [])

    async def event_generator():
        for ev in events:
            yield {
                "event": ev.get("event", "message"),
                "data": json.dumps(ev.get("data", {}))
            }
            await asyncio.sleep(0.05)
        # Final report event
        if "report" in cached:
            yield {
                "event": "report",
                "data": json.dumps(cached["report"])
            }
        if "verification" in cached:
            yield {
                "event": "verification",
                "data": json.dumps(cached["verification"])
            }
        yield {
            "event": "done",
            "data": json.dumps({"status": "completed", "run_id": run_id})
        }

    return EventSourceResponse(event_generator())

@app.post("/api/mitigation/preview")
def preview_mitigation(payload: Dict[str, Any]):
    action = payload.get("action", "")
    params = payload.get("params", {})
    diff_text = f"--- gateway_state (current)\n+++ gateway_state (proposed)\n"
    if action == "rollback":
        ver = params.get("version", "1.4.0")
        diff_text += f"- weights: {{'blue': 100, 'green': 0}}\n+ weights: {{'blue': 0, 'green': 100}} (target {ver})\n"
    elif action == "block_rule":
        diff_text += f"+ rule: block {params.get('route')} field={params.get('field')} regex={params.get('regex')}\n"
    elif action == "disable_endpoint":
        diff_text += f"+ disable: route {params.get('route')}\n"
    elif action == "canary_shift":
        diff_text += f"- weights: {{'blue': 100, 'green': 0}}\n+ weights: {params}\n"
    return {
        "action": action,
        "diff": diff_text,
        "preconditions": [
            {"name": "target_healthy", "satisfied": True, "detail": "Target container responds 200 to /health"},
            {"name": "image_in_registry", "satisfied": True, "detail": "Image tag verified in registry"},
            {"name": "schema_compatible", "satisfied": True, "detail": "No destructive DB migrations"},
            {"name": "target_lacks_implicated_findings", "satisfied": action != "rollback" or mock_state["active_scenario"] == "b_regression", "detail": "Target image does not contain implicated SQLi finding"},
            {"name": "is_last_stable", "satisfied": True, "detail": "Target is marked stable in ledger"}
        ]
    }

import time

@app.post("/api/mitigation/execute")
def execute_mitigation(payload: Dict[str, Any]):
    action = payload.get("action", "")
    params = payload.get("params", {})
    mit_id = f"mit-{int(time.time())}"
    mock_state["mitigation_state"]["status"] = "executed"
    mock_state["mitigation_state"]["last_action"] = action
    return {
        "id": mit_id,
        "action": action,
        "params": params,
        "status": "applied",
        "executed_at": "2026-10-04T12:05:00Z"
    }

@app.post("/api/mitigation/{mit_id}/undo")
def undo_mitigation(mit_id: str):
    mock_state["mitigation_state"]["status"] = "undone"
    return {"id": mit_id, "status": "undone", "message": "Mitigation successfully reverted"}

@app.get("/api/mitigation/{mit_id}/verify")
async def verify_mitigation_stream(mit_id: str):
    async def verify_gen():
        for step in range(1, 6):
            p95 = max(110, 8000 - step * 1500)
            err = max(0.0, 0.05 - step * 0.01)
            yield {
                "event": "metric_sample",
                "data": json.dumps({"step": step, "p95_ms": p95, "err_rate": round(err, 3)})
            }
            await asyncio.sleep(0.05)
        yield {
            "event": "verdict",
            "data": json.dumps({"status": "recovered", "p95_ms": 115, "err_rate": 0.0, "message": "Metrics stabilized within SLO"})
        }
    return EventSourceResponse(verify_gen())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
