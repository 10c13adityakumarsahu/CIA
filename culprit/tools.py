"""
culprit.tools – Tool implementations used by the incident investigator agent.

Tools:
  - search_logs(query, status, limit)
  - log_stats(route)
  - list_findings(source)
  - read_file(path, start, end) -> strictly rejects path traversal
  - git_diff()
  - service_manifest()
  - get_metrics(route, window)
  - blast_radius(finding_id, route)
  - get_release_ledger()
  - find_last_stable(exclude_finding_ids)
  - check_version_findings(version, finding_ids)
  - list_mitigation_actions()
"""

from collections import Counter
import json
import os
from pathlib import Path
import re
import subprocess
from typing import Any, Dict, List, Optional
import urllib.request

from culprit.normalize import load_all_findings, Finding
from ledger import Ledger
from graph.queries import data_reach, shared_resource, version_contains

REPO_ROOT = Path(__file__).resolve().parent.parent
GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")
LOG_FILE_PATH = REPO_ROOT / "logs" / "gateway.jsonl"


def search_logs(
    query: Optional[str] = None,
    status: Optional[int] = None,
    route: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Search gateway JSONL logs with optional query text, HTTP status, or route filter (most recent first)."""
    if not LOG_FILE_PATH.exists():
        return []

    entries = []
    with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                entry = json.loads(line_str)
                if "id" not in entry:
                    entry["id"] = f"LOG-{line_num:04d}"

                if status is not None and entry.get("status") != status:
                    continue
                if route and entry.get("route") != route and not entry.get("route", "").startswith(route):
                    continue
                if query:
                    q = query.lower()
                    haystack = f"{entry.get('route','')} {entry.get('client_ip','')} {entry.get('body_excerpt','')} {entry.get('status','')} {entry.get('upstream','')}".lower()
                    if q not in haystack:
                        continue

                entries.append(entry)
            except Exception:
                continue

    # Return most recent matching entries first
    return list(reversed(entries))[:limit]


def log_stats(route: Optional[str] = None) -> Dict[str, Any]:
    """Compute summary statistics for gateway logs."""
    if not LOG_FILE_PATH.exists():
        return {"total_requests": 0, "status_counts": {}, "error_count": 0, "slow_requests": 0}

    total = 0
    status_counts = Counter()
    error_count = 0
    slow_count = 0
    routes_counter = Counter()

    with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                r_path = entry.get("route", "")
                if route and r_path != route and not r_path.startswith(route):
                    continue
                total += 1
                s = entry.get("status", 200)
                status_counts[s] += 1
                routes_counter[r_path] += 1
                if s >= 500:
                    error_count += 1
                if entry.get("latency_ms", 0) > 1000:
                    slow_count += 1
            except Exception:
                continue

    return {
        "total_requests": total,
        "status_counts": dict(status_counts),
        "error_count": error_count,
        "slow_requests": slow_count,
        "top_routes": dict(routes_counter.most_common(5)),
    }


def list_findings(source: Optional[str] = None) -> List[Dict[str, Any]]:
    """Load normalized SAST, SCA, and DAST findings."""
    findings_dir = REPO_ROOT / "findings"
    findings = load_all_findings(findings_dir)
    if source:
        findings = [f for f in findings if f.source.lower() == source.lower()]
    return [f.to_dict() for f in findings]


def read_file(path: str, start: int = 1, end: Optional[int] = None) -> str:
    """
    Read file content from the repository between lines [start, end] (1-indexed).
    SECURITY REQUIREMENT: Strictly rejects path traversal attempts.
    """
    clean_path = path.replace("\\", "/").strip()
    # Reject directory traversal patterns
    if ".." in clean_path or clean_path.startswith("/") or re.search(r"^[a-zA-Z]:", clean_path):
        # Resolve target path and verify within REPO_ROOT
        try:
            target = (REPO_ROOT / clean_path).resolve()
        except Exception as exc:
            raise ValueError(f"Path traversal detected: invalid path {path}") from exc
    else:
        target = (REPO_ROOT / clean_path).resolve()

    # Ensure target is strictly inside REPO_ROOT
    try:
        target.relative_to(REPO_ROOT.resolve())
    except ValueError as exc:
        raise ValueError(f"Path traversal blocked: {path} resolves outside workspace root") from exc

    if not target.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if not target.is_file():
        raise ValueError(f"Path is not a file: {path}")

    lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
    start_idx = max(0, start - 1)
    end_idx = len(lines) if end is None else min(len(lines), end)

    selected = lines[start_idx:end_idx]
    numbered = [f"{start_idx + i + 1}: {line}" for i, line in enumerate(selected)]
    return "\n".join(numbered)


def git_diff() -> str:
    """Return current git diff from repo root."""
    try:
        res = subprocess.run(["git", "diff"], cwd=REPO_ROOT, capture_output=True, text=True, check=False)
        return res.stdout.strip()
    except Exception as exc:
        return f"Error executing git diff: {exc}"


def diff_versions(path: str = "main.py", v1: str = "v1.4.0", v2: str = "v1.5.0") -> str:
    """Compute unified diff between two versions of a target_app file (e.g. v1.4.0 and v1.5.0)."""
    import difflib
    f1 = REPO_ROOT / f"target_app/{v1}/{path}"
    f2 = REPO_ROOT / f"target_app/{v2}/{path}"
    if not f1.exists() or not f2.exists():
        return git_diff()
    lines1 = f1.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
    lines2 = f2.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
    diff = "".join(difflib.unified_diff(lines1, lines2, fromfile=f"target_app/{v1}/{path}", tofile=f"target_app/{v2}/{path}"))
    return diff.strip()


def service_manifest() -> Dict[str, Any]:
    """Return infrastructure service manifest."""
    return {
        "gateway": {"port": 8080, "upstreams": ["blue:8000 (v1.5.0)", "green:8000 (v1.4.0)"]},
        "blue": {"port": 8001, "version": "1.5.0", "status": "current"},
        "green": {"port": 8002, "version": "1.4.0", "status": "stable"},
        "database": {"port": 5432, "type": "postgres 16", "role": "app_rw", "pool_max": 5},
        "neo4j": {"bolt_port": 7687, "http_port": 7474},
        "redis": {"port": 6379, "type": "redis 7"},
        "registry": {"port": 5000, "type": "registry:2"},
    }


def get_metrics(route: str = "all", window: int = 60) -> Dict[str, Any]:
    """Fetch rolling metrics from the gateway admin API."""
    try:
        url = f"{GATEWAY_URL.rstrip('/')}/admin/metrics"
        with urllib.request.urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            if route != "all":
                return {k: v for k, v in data.items() if route in k}
            return data
    except Exception as exc:
        return {"error": f"Failed to fetch gateway metrics: {exc}"}


def blast_radius(finding_id: Optional[str] = None, route: Optional[str] = None) -> Dict[str, Any]:
    """Query Neo4j knowledge graph for data reach of a finding or shared pool resources of a route."""
    if finding_id:
        return data_reach(finding_id)
    if route:
        return shared_resource(route)
    return {"nodes": [], "edges": [], "error": "Specify either finding_id or route"}


def get_release_ledger() -> List[Dict[str, Any]]:
    """Retrieve full release history from Redis ledger."""
    l = Ledger()
    return l.list_releases()


def find_last_stable(exclude_finding_ids: Optional[List[str]] = None) -> Optional[str]:
    """Find last stable release excluding specified implicated finding IDs."""
    l = Ledger()
    return l.find_last_stable(exclude_finding_ids=exclude_finding_ids)


def check_version_findings(version: str, finding_ids: List[str]) -> Dict[str, Any]:
    """Check which findings from the provided list exist in target version."""
    return version_contains(finding_ids, version)


def list_mitigation_actions() -> List[Dict[str, Any]]:
    """List available mitigation actions and parameter signatures."""
    return [
        {
            "action": "rollback",
            "params": {"version": "str (e.g. '1.4.0')"},
            "description": "Rollback traffic completely to target release",
        },
        {
            "action": "failover",
            "params": {},
            "description": "Immediate failover 100% to green (LKG stable)",
        },
        {
            "action": "canary_shift",
            "params": {"blue": "int (0..100)", "green": "int (0..100)"},
            "description": "Shift gateway traffic weights between blue and green",
        },
        {
            "action": "block_rule",
            "params": {"route": "str", "field": "body|sku|headers|client_ip|path", "regex": "str"},
            "description": "Deploy regex block rule returning 403 on gateway",
        },
        {
            "action": "disable_endpoint",
            "params": {"route": "str"},
            "description": "Temporarily disable an API endpoint returning 503",
        },
        {
            "action": "hotfix",
            "params": {"description": "str"},
            "description": "Propose code hotfix patch (not executed live)",
        },
    ]
