"""
gateway.main – Weighted reverse proxy with JSONL logging, rolling metrics, and admin API.

Features:
- Weighted routing between blue (v1.5.0) and green (v1.4.0) upstreams.
- Structured JSONL logging with deterministic line-based LOG-0001 IDs.
- In-memory rolling metrics per route+version (p50, p95, err_rate, rps).
- Admin API:
    GET /admin/state
    POST /admin/weights {blue: int, green: int}
    POST /admin/rules {route: str, field: str, regex: str}
    DELETE /admin/rules/{id}
    POST /admin/disable {route: str}
    POST /admin/enable {route: str}
    GET /admin/logs
"""

import asyncio
from collections import defaultdict, deque
import datetime
import json
import logging
import os
from pathlib import Path
import random
import re
import time
from typing import Any, Dict, List, Optional
import uuid

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse
import httpx
from pydantic import BaseModel, Field

# Upstream configurations
BLUE_URL = os.environ.get("BLUE_URL", "http://blue:8000")
GREEN_URL = os.environ.get("GREEN_URL", "http://green:8000")
LOG_FILE_PATH = Path(os.environ.get("LOG_FILE_PATH", "logs/gateway.jsonl"))

# Ensure logs directory exists
LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="culprit-gateway", version="1.0.0")

# Global Gateway State
class GatewayState:
    def __init__(self):
        self.weights = {"blue": 50, "green": 50}
        self.rules: List[Dict[str, Any]] = []
        self.disabled_routes: set = set()
        self.rule_counter = 0
        self.log_counter = 0
        # Rolling request records: deque of (timestamp, route, version, status, latency_ms)
        self.rolling_window_seconds = 60.0
        self.request_history: deque = deque(maxlen=20000)
        self.client: Optional[httpx.AsyncClient] = None
        self.log_lock = asyncio.Lock()

        # Count existing log lines if file exists
        if LOG_FILE_PATH.exists():
            try:
                with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
                    self.log_counter = sum(1 for _ in f)
            except Exception:
                self.log_counter = 0

state = GatewayState()


@app.on_event("startup")
async def startup_event():
    # Large pool and timeout for proxying
    state.client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0))


@app.on_event("shutdown")
async def shutdown_event():
    if state.client:
        await state.client.aclose()


# Models
class WeightsIn(BaseModel):
    blue: int = Field(..., ge=0, le=100)
    green: int = Field(..., ge=0, le=100)


class RuleIn(BaseModel):
    route: str
    field: str  # "body", "sku", "headers", "client_ip", "path"
    regex: str


class RouteIn(BaseModel):
    route: str


# Helper: Pick Upstream
def select_upstream() -> tuple[str, str, str]:
    """Returns (upstream_name, upstream_url, version)."""
    w_blue = state.weights.get("blue", 50)
    w_green = state.weights.get("green", 50)
    total = w_blue + w_green
    if total <= 0:
        return "green", GREEN_URL, "1.4.0"
    
    r = random.randint(1, total)
    if r <= w_blue:
        return "blue", BLUE_URL, "1.5.0"
    else:
        return "green", GREEN_URL, "1.4.0"


# Helper: Check Block Rules
def is_request_blocked(route: str, method: str, body_str: str, headers: Dict[str, str], client_ip: str) -> Optional[Dict[str, Any]]:
    for rule in state.rules:
        r_route = rule.get("route", "")
        # Route match (exact or wildcard or prefix)
        if r_route and r_route != "*" and r_route != route and not route.startswith(r_route):
            continue

        field_name = rule.get("field", "body").lower()
        pattern = rule.get("regex", "")
        if not pattern:
            continue

        target_text = ""
        if field_name == "body":
            target_text = body_str
        elif field_name == "sku":
            # Extract sku from JSON body or raw text
            try:
                data = json.loads(body_str)
                target_text = str(data.get("sku", ""))
            except Exception:
                target_text = body_str
        elif field_name == "headers":
            target_text = json.dumps(headers)
        elif field_name in ("client_ip", "ip"):
            target_text = client_ip
        elif field_name == "path":
            target_text = route

        try:
            if re.search(pattern, target_text, re.IGNORECASE):
                return rule
        except Exception:
            pass

    return None


# Helper: Write JSONL log
async def log_request(
    route: str,
    method: str,
    status: int,
    latency_ms: float,
    upstream: str,
    version: str,
    client_ip: str,
    body_excerpt: str,
    request_id: str,
) -> str:
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    async with state.log_lock:
        state.log_counter += 1
        log_id = f"LOG-{state.log_counter:04d}"
        entry = {
            "id": log_id,
            "ts": now_iso,
            "request_id": request_id,
            "route": route,
            "method": method,
            "status": status,
            "latency_ms": round(latency_ms, 2),
            "upstream": upstream,
            "version": version,
            "client_ip": client_ip,
            "body_excerpt": body_excerpt[:200] if body_excerpt else "",
        }
        with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    
    # Record for rolling metrics
    state.request_history.append((time.time(), route, version, status, latency_ms))
    return log_id


# Helper: Calculate Rolling Metrics
def get_rolling_metrics() -> Dict[str, Any]:
    now = time.time()
    cutoff = now - state.rolling_window_seconds
    
    # Filter recent requests
    recent = [r for r in state.request_history if r[0] >= cutoff]
    
    # Group by (route, version) and overall
    grouped = defaultdict(list)
    for _, route, ver, status, lat in recent:
        grouped[(route, ver)].append((status, lat))
        grouped[("all", ver)].append((status, lat))
        grouped[(route, "all")].append((status, lat))
        grouped[("all", "all")].append((status, lat))

    results = {}
    duration = max(1.0, state.rolling_window_seconds)

    for (route, ver), items in grouped.items():
        latencies = sorted([lat for _, lat in items])
        n = len(latencies)
        errors = sum(1 for status, _ in items if status >= 500)
        p50 = latencies[int(n * 0.50)] if n else 0.0
        p95 = latencies[int(n * 0.95)] if n else (latencies[-1] if n else 0.0)
        err_rate = (errors / n) if n else 0.0
        rps = round(n / duration, 2)

        key = f"{route}|{ver}"
        results[key] = {
            "route": route,
            "version": ver,
            "count": n,
            "errors": errors,
            "err_rate": round(err_rate, 4),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "rps": rps,
        }

    return results


# ── Admin Endpoints ─────────────────────────────────────────────────────────

@app.get("/admin/state")
def get_admin_state():
    return {
        "weights": state.weights,
        "rules": state.rules,
        "disabled_routes": list(state.disabled_routes),
        "metrics": get_rolling_metrics(),
        "total_logged": state.log_counter,
    }


@app.post("/admin/weights")
def update_weights(payload: WeightsIn):
    state.weights = {"blue": payload.blue, "green": payload.green}
    return {"status": "ok", "weights": state.weights}


@app.post("/admin/rules")
def add_block_rule(rule: RuleIn):
    state.rule_counter += 1
    new_rule = {
        "id": f"RULE-{state.rule_counter:03d}",
        "route": rule.route,
        "field": rule.field,
        "regex": rule.regex,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    state.rules.append(new_rule)
    return {"status": "ok", "rule": new_rule}


@app.delete("/admin/rules/{rule_id}")
def delete_block_rule(rule_id: str):
    before = len(state.rules)
    state.rules = [r for r in state.rules if r["id"] != rule_id]
    if len(state.rules) == before:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "ok", "deleted": rule_id}


@app.post("/admin/disable")
def disable_route(payload: RouteIn):
    state.disabled_routes.add(payload.route)
    return {"status": "ok", "disabled_routes": list(state.disabled_routes)}


@app.post("/admin/enable")
def enable_route(payload: RouteIn):
    state.disabled_routes.discard(payload.route)
    return {"status": "ok", "disabled_routes": list(state.disabled_routes)}


@app.get("/admin/metrics")
def get_metrics_endpoint():
    return get_rolling_metrics()


# ── Health & Proxy ──────────────────────────────────────────────────────────

@app.get("/health")
def gateway_health():
    return {"status": "ok", "service": "gateway", "weights": state.weights}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def proxy_handler(request: Request, path: str):
    route = "/" + path
    method = request.method
    client_ip = request.client.host if request.client else "127.0.0.1"
    req_id = request.headers.get("x-request-id", str(uuid.uuid4()))

    # Read body
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8", errors="replace")
    headers = dict(request.headers)

    # 1. Check Disabled Route
    if route in state.disabled_routes or any(route.startswith(dr) for dr in state.disabled_routes if dr != "/"):
        t0 = time.perf_counter()
        lat = (time.perf_counter() - t0) * 1000
        await log_request(route, method, 503, lat, "none", "none", client_ip, "route_disabled", req_id)
        return JSONResponse(status_code=503, content={"detail": "Route temporarily disabled by administrator"})

    # 2. Check Block Rules
    matched_rule = is_request_blocked(route, method, body_str, headers, client_ip)
    if matched_rule:
        t0 = time.perf_counter()
        lat = (time.perf_counter() - t0) * 1000
        # SPEC: "Blocked => 403 logged `blocked`"
        await log_request(route, method, 403, lat, "gateway", "none", client_ip, "blocked", req_id)
        return JSONResponse(status_code=403, content={"detail": "blocked", "rule_id": matched_rule["id"]})

    # 3. Select Upstream
    upstream_name, upstream_base, version = select_upstream()
    upstream_url = f"{upstream_base}{route}"
    if request.url.query:
        upstream_url += f"?{request.url.query}"

    # Filter headers to forward
    forward_headers = {k: v for k, v in headers.items() if k.lower() not in ("host", "content-length")}
    forward_headers["x-forwarded-for"] = client_ip
    forward_headers["x-request-id"] = req_id

    # 4. Forward Request
    t0 = time.perf_counter()
    status_code = 500
    resp_content = b""
    resp_headers = {}

    try:
        if not state.client:
            state.client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0))

        resp = await state.client.request(
            method=method,
            url=upstream_url,
            content=body_bytes,
            headers=forward_headers,
        )
        latency_ms = (time.perf_counter() - t0) * 1000
        status_code = resp.status_code
        resp_content = resp.content
        resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in ("content-length", "content-encoding", "transfer-encoding")}
    except httpx.TimeoutException:
        latency_ms = (time.perf_counter() - t0) * 1000
        status_code = 504
        resp_content = json.dumps({"detail": "Gateway Timeout"}).encode()
    except Exception as exc:
        latency_ms = (time.perf_counter() - t0) * 1000
        status_code = 502
        resp_content = json.dumps({"detail": f"Bad Gateway: {exc}"}).encode()

    # Log to JSONL
    body_excerpt = body_str if len(body_str) < 100 else body_str[:100] + "..."
    await log_request(route, method, status_code, latency_ms, upstream_name, version, client_ip, body_excerpt, req_id)

    return Response(
        content=resp_content,
        status_code=status_code,
        headers=resp_headers,
        media_type=resp_headers.get("content-type", "application/json"),
    )
