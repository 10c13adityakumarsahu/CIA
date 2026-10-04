"""
culprit.api – FastAPI backend server for CULPRIT incident investigator (:9000).

Endpoints:
  GET  /api/state
  GET  /api/metrics
  GET  /api/findings
  GET  /api/graph?finding=&route=
  GET  /api/source?path=&start=&end=
  GET  /api/logs/{id}
  GET  /api/ledger
  POST /api/scenario/{a_exploit|b_regression}/start
  POST /api/scenario/reset
  POST /api/investigate
  GET  /api/investigate/{run}/stream (SSE)
  POST /api/mitigation/preview
  POST /api/mitigation/execute
  POST /api/mitigation/{id}/undo
  GET  /api/mitigation/{id}/verify (SSE)
"""

import asyncio
import json
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
import uuid

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from culprit.agent import InvestigationAgent
from culprit.executor import Executor
from culprit.normalize import load_all_findings
from culprit.tools import (
    search_logs,
    log_stats,
    list_findings,
    read_file,
    git_diff,
    service_manifest,
    get_metrics,
    blast_radius,
    get_release_ledger,
    find_last_stable,
)
from ledger import Ledger
from scenarios.inject import start_scenario_a, start_scenario_b, reset_scenario

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="culprit-api", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = Executor()
agent = InvestigationAgent()
active_runs: Dict[str, Dict[str, Any]] = {}
current_scenario: str = "none"


class MitigationReq(BaseModel):
    action: str
    params: Dict[str, Any] = {}


def format_sse(event_type: str, data: Any) -> str:
    payload = json.dumps(data) if not isinstance(data, str) else data
    return f"event: {event_type}\ndata: {payload}\n\n"


def get_mode() -> str:
    return os.environ.get("CULPRIT_MODE", "LIVE").upper()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "culprit-api", "mode": get_mode()}


@app.get("/api/state")
def get_system_state():
    mode = get_mode()
    # In replay mode, load from cache if available
    if mode == "REPLAY" and (CACHE_DIR / "state.json").exists():
        try:
            with open(CACHE_DIR / "state.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                data["mode"] = "REPLAY"
                return data
        except Exception:
            pass

    findings = list_findings()
    ledger = Ledger()
    metrics = get_metrics()

    return {
        "mode": mode,
        "status": "ok",
        "active_scenario": current_scenario,
        "lkg": ledger.get_lkg() or "1.4.0",
        "findings_count": len(findings),
        "gateway_metrics": metrics,
    }


@app.get("/api/metrics")
def get_live_metrics():
    if get_mode() == "REPLAY" and (CACHE_DIR / "metrics.json").exists():
        try:
            with open(CACHE_DIR / "metrics.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return get_metrics()


@app.get("/api/findings")
def get_findings_list(source: Optional[str] = None):
    return list_findings(source)


@app.get("/api/graph")
def get_graph_subgraph(
    finding: Optional[str] = Query(None),
    route: Optional[str] = Query(None),
):
    if get_mode() == "REPLAY" and (CACHE_DIR / "graph.json").exists():
        try:
            with open(CACHE_DIR / "graph.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return blast_radius(finding_id=finding, route=route)


@app.get("/api/source")
def get_source_code(
    path: str = Query(..., description="Relative file path"),
    start: int = Query(1, ge=1),
    end: Optional[int] = Query(None),
):
    try:
        content = read_file(path, start=start, end=end)
        return {"path": path, "start": start, "end": end, "content": content}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/diff")
def get_release_diff(
    v1: str = Query("v1.4.0", description="Base version"),
    v2: str = Query("v1.5.0", description="Target version"),
    path: str = Query("main.py", description="Target file name"),
):
    try:
        from culprit.tools import diff_versions
        diff_text = diff_versions(path=path, v1=v1, v2=v2)
        return {"v1": v1, "v2": v2, "path": path, "diff": diff_text}
    except Exception as exc:
        return {"v1": v1, "v2": v2, "path": path, "diff": git_diff(), "error": str(exc)}


@app.get("/api/logs/{log_id}")
def get_single_log(log_id: str):
    results = search_logs(query=log_id, limit=1)
    if not results:
        # Try finding by line number
        m = re.match(r"^LOG-(\d+)$", log_id, re.IGNORECASE)
        if m:
            line_no = int(m.group(1))
            all_logs = search_logs(limit=line_no + 10)
            if len(all_logs) >= line_no:
                return all_logs[line_no - 1]
        raise HTTPException(status_code=404, detail=f"Log {log_id} not found")
    return results[0]


@app.get("/api/ledger")
def get_ledger_state():
    return get_release_ledger()


@app.post("/api/scenario/{scenario_name}/start")
def start_scenario_endpoint(scenario_name: str):
    global current_scenario
    if scenario_name in ("a_exploit", "a"):
        current_scenario = "a_exploit"
        res = start_scenario_a()
        return {"status": "started", "scenario": "a_exploit", "result": res}
    elif scenario_name in ("b_regression", "b"):
        current_scenario = "b_regression"
        res = start_scenario_b()
        return {"status": "started", "scenario": "b_regression", "result": res}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown scenario {scenario_name}. Use a_exploit or b_regression")


@app.post("/api/scenario/reset")
def reset_scenario_endpoint():
    global current_scenario
    current_scenario = "none"
    res = reset_scenario()
    return {"status": "reset", "result": res}


@app.post("/api/investigate")
def start_investigation_run():
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    active_runs[run_id] = {
        "run_id": run_id,
        "scenario": current_scenario,
        "started_at": time.time(),
        "status": "running",
    }
    return {"run_id": run_id, "status": "started"}


@app.get("/api/investigate/{run_id}/stream")
async def stream_investigation(run_id: str):
    # In replay mode, stream cached run
    if get_mode() == "REPLAY":
        scenario_file = CACHE_DIR / (
            "scenario_a.json" if "a" in current_scenario.lower() else "scenario_b.json"
        )
        if scenario_file.exists():
            async def replay_generator():
                with open(scenario_file, "r", encoding="utf-8") as f:
                    events = json.load(f).get("events", [])
                for ev in events:
                    yield format_sse(ev["event"], ev["data"])
                    await asyncio.sleep(0.02)
            return StreamingResponse(replay_generator(), media_type="text/event-stream")

    # Live investigation stream
    async def event_generator():
        recorded_events = []
        async for ev in agent.investigate_stream():
            recorded_events.append(ev)
            yield format_sse(ev["event"], ev["data"])

        # Cache completed run if in scenario
        if current_scenario in ("a_exploit", "b_regression"):
            cache_file = CACHE_DIR / f"{current_scenario}.json"
            try:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump({"scenario": current_scenario, "events": recorded_events}, f, indent=2)
            except Exception:
                pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/mitigation/preview")
def preview_mitigation(req: MitigationReq):
    return executor.preview(req.action, req.params)


@app.post("/api/mitigation/execute")
def execute_mitigation(req: MitigationReq):
    return executor.execute(req.action, req.params)


@app.post("/api/mitigation/{action_id}/undo")
def undo_mitigation(action_id: str):
    try:
        return executor.undo(action_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/mitigation/{action_id}/verify")
async def verify_mitigation_recovery(action_id: str):
    async def recovery_stream():
        for i in range(5):
            res = executor.verify_recovery(action_id, duration_seconds=1)
            yield format_sse("recovery_status", res)
            await asyncio.sleep(1)
        yield format_sse("done", {"status": "verification_completed"})

    return StreamingResponse(recovery_stream(), media_type="text/event-stream")


@app.get("/api/scenarios/explain")
def get_all_scenarios_explain():
    from simulate import SCENARIO_EXPLANATIONS
    return SCENARIO_EXPLANATIONS


@app.get("/api/explain/{scenario_key}")
def get_scenario_explain(scenario_key: str):
    from simulate import SCENARIO_EXPLANATIONS
    key = "exploit" if "a" in scenario_key or scenario_key == "exploit" else "regression" if "b" in scenario_key or scenario_key == "regression" else scenario_key
    info = SCENARIO_EXPLANATIONS.get(key)
    if not info:
        raise HTTPException(status_code=404, detail="Scenario explanation not found")
    return info

