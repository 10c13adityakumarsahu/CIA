"""
culprit.preconditions – Evaluates preconditions for proposed mitigation actions.
Computed strictly by CODE, never by the model.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional
import urllib.request

from culprit.schemas import PreconditionResult
from ledger import Ledger
from graph.queries import version_contains

REGISTRY_URL = os.environ.get("REGISTRY_URL", "http://localhost:5000")
GREEN_HEALTH_URL = os.environ.get("GREEN_HEALTH_URL", "http://localhost:8002/health")
BLUE_HEALTH_URL = os.environ.get("BLUE_HEALTH_URL", "http://localhost:8001/health")


def check_target_healthy(version: str) -> PreconditionResult:
    """Check if target version service is responding healthy."""
    url = GREEN_HEALTH_URL if version == "1.4.0" else BLUE_HEALTH_URL
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "ok":
                return PreconditionResult(name="target_healthy", passed=True, detail=f"Target {version} healthy on {url}")
            return PreconditionResult(name="target_healthy", passed=False, detail=f"Target {version} returned non-ok: {data}")
    except Exception as exc:
        return PreconditionResult(name="target_healthy", passed=False, detail=f"Target {version} health check failed: {exc}")


def check_image_in_registry(version: str, repo: str = "shop") -> PreconditionResult:
    """Check if image tag exists in local registry."""
    l = Ledger(registry_url=REGISTRY_URL)
    tags = l.get_registry_tags(repo)
    if version in tags:
        return PreconditionResult(name="image_in_registry", passed=True, detail=f"Image tag {version} found in registry catalog")
    return PreconditionResult(name="image_in_registry", passed=False, detail=f"Image tag {version} missing from registry (tags: {tags})")


def check_schema_compatible(target_version: str, current_schema_version: int = 1) -> PreconditionResult:
    """Check if target release schema_version is compatible with current database schema."""
    l = Ledger()
    rel = l.get_release(target_version)
    if not rel:
        return PreconditionResult(name="schema_compatible", passed=False, detail=f"Release {target_version} not found in ledger")
    
    target_schema = rel.get("schema_version", 1)
    if target_schema <= current_schema_version:
        return PreconditionResult(name="schema_compatible", passed=True, detail=f"Target schema v{target_schema} compatible with db v{current_schema_version}")
    return PreconditionResult(name="schema_compatible", passed=False, detail=f"Target schema v{target_schema} exceeds db v{current_schema_version}")


def check_target_lacks_implicated_findings(target_version: str, implicated_finding_ids: List[str]) -> PreconditionResult:
    """
    CRITICAL SAFETY CHECK:
    Verify that the target release does NOT contain any of the findings implicated in the incident.
    """
    if not implicated_finding_ids:
        return PreconditionResult(name="target_lacks_implicated_findings", passed=True, detail="No implicated findings in incident")

    res = version_contains(implicated_finding_ids, target_version)
    present_nodes = res.get("nodes", [])
    present_finding_ids = [n["props"].get("finding_id") or n["id"] for n in present_nodes if n.get("label") == "Finding"]

    if present_finding_ids:
        return PreconditionResult(
            name="target_lacks_implicated_findings",
            passed=False,
            detail=f"Target {target_version} contains implicated findings: {present_finding_ids}",
        )
    return PreconditionResult(
        name="target_lacks_implicated_findings",
        passed=True,
        detail=f"Target {target_version} does not contain any of the {len(implicated_finding_ids)} implicated findings",
    )


def check_is_last_stable(version: str) -> PreconditionResult:
    """Check if version is currently the last known stable release."""
    l = Ledger()
    last_stable = l.find_last_stable()
    if last_stable == version:
        return PreconditionResult(name="is_last_stable", passed=True, detail=f"Version {version} is the last stable release in ledger")
    return PreconditionResult(name="is_last_stable", passed=False, detail=f"Version {version} is not the last stable release (last stable is {last_stable})")


def evaluate_action_preconditions(
    action: str,
    params: Dict[str, Any],
    implicated_finding_ids: Optional[List[str]] = None,
) -> List[PreconditionResult]:
    """Evaluate all required preconditions for a proposed mitigation action."""
    results: List[PreconditionResult] = []
    imp_ids = implicated_finding_ids or []

    if action in ("rollback", "failover"):
        version = params.get("version", "1.4.0") if action == "rollback" else "1.4.0"
        results.append(check_target_healthy(version))
        results.append(check_image_in_registry(version))
        results.append(check_schema_compatible(version))
        results.append(check_target_lacks_implicated_findings(version, imp_ids))
        results.append(check_is_last_stable(version))

    elif action == "canary_shift":
        blue = params.get("blue", 50)
        green = params.get("green", 50)
        valid_weights = (0 <= blue <= 100) and (0 <= green <= 100) and (blue + green == 100)
        results.append(PreconditionResult(
            name="valid_weights",
            passed=valid_weights,
            detail=f"Weights blue={blue}, green={green} sum to 100" if valid_weights else "Invalid weight range or sum != 100",
        ))
        if green > 0:
            results.append(check_target_healthy("1.4.0"))
            if imp_ids:
                results.append(check_target_lacks_implicated_findings("1.4.0", imp_ids))

    elif action == "block_rule":
        route = params.get("route", "")
        field = params.get("field", "")
        regex = params.get("regex", "")
        
        valid_route = bool(route and (route.startswith("/") or route == "*"))
        results.append(PreconditionResult(name="valid_route", passed=valid_route, detail=f"Route '{route}' is valid"))

        valid_field = field.lower() in ("body", "sku", "headers", "client_ip", "path")
        results.append(PreconditionResult(name="valid_field", passed=valid_field, detail=f"Field '{field}' is recognized"))

        try:
            re.compile(regex)
            valid_regex = bool(regex)
            results.append(PreconditionResult(name="valid_regex", passed=valid_regex, detail="Regex compiled successfully"))
        except Exception as exc:
            results.append(PreconditionResult(name="valid_regex", passed=False, detail=f"Invalid regex: {exc}"))

    elif action == "disable_endpoint":
        route = params.get("route", "")
        valid_route = bool(route and route.startswith("/"))
        results.append(PreconditionResult(name="valid_route", passed=valid_route, detail=f"Route '{route}' is valid"))

    elif action == "hotfix":
        desc = params.get("description", "")
        results.append(PreconditionResult(name="has_description", passed=bool(desc), detail="Hotfix description provided"))

    return results
