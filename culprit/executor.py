"""
culprit.executor – Executes and reverts approved mitigations via Gateway admin API and Redis ledger.

Actions:
  - rollback {version}
  - failover
  - canary_shift {blue, green}
  - block_rule {route, field, regex}
  - disable_endpoint {route}
  - hotfix (preview only)
"""

from __future__ import annotations

import datetime
import json
import os
import time
from typing import Any, Dict, List, Optional
import urllib.request
import uuid

from ledger import Ledger

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")


class ActionRecord:
    def __init__(
        self,
        action_id: str,
        action: str,
        params: Dict[str, Any],
        previous_state: Dict[str, Any],
        executed_at: str,
    ):
        self.action_id = action_id
        self.action = action
        self.params = params
        self.previous_state = previous_state
        self.executed_at = executed_at


class Executor:
    def __init__(self, gateway_url: str = GATEWAY_URL):
        self.gateway_url = gateway_url.rstrip("/")
        self.ledger = Ledger()
        self.history: Dict[str, ActionRecord] = {}

    def _get_gateway_state(self) -> Dict[str, Any]:
        url = f"{self.gateway_url}/admin/state"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            return json.loads(resp.read().decode())

    def preview(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a diff/preview of the state change without executing."""
        current_state = self._get_gateway_state()
        preview_data = {
            "action": action,
            "params": params,
            "current_state": {
                "weights": current_state.get("weights"),
                "rules_count": len(current_state.get("rules", [])),
                "disabled_routes": current_state.get("disabled_routes", []),
            },
            "proposed_changes": {},
        }

        if action in ("rollback", "failover"):
            target_ver = params.get("version", "1.4.0") if action == "rollback" else "1.4.0"
            preview_data["proposed_changes"] = {
                "weights": {"blue": 0, "green": 100},
                "active_upstream": f"green (v{target_ver})",
                "traffic_shift": "100% traffic routed to green",
            }
        elif action == "canary_shift":
            blue = params.get("blue", 50)
            green = params.get("green", 50)
            preview_data["proposed_changes"] = {
                "weights": {"blue": blue, "green": green},
                "traffic_shift": f"{blue}% blue, {green}% green",
            }
        elif action == "block_rule":
            preview_data["proposed_changes"] = {
                "new_rule": {
                    "route": params.get("route", "/"),
                    "field": params.get("field", "body"),
                    "regex": params.get("regex", ""),
                },
                "effect": "Matching requests will be rejected with HTTP 403",
            }
        elif action == "disable_endpoint":
            preview_data["proposed_changes"] = {
                "disabled_route": params.get("route", ""),
                "effect": "Route will return HTTP 503 Service Unavailable",
            }
        elif action == "hotfix":
            preview_data["proposed_changes"] = {
                "patch_description": params.get("description", "Hotfix proposed"),
                "effect": "Code fix ready for deployment review (manual)",
            }

        return preview_data

    def execute(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute approved mitigation action against live gateway and ledger."""
        action_id = f"ACT-{uuid.uuid4().hex[:8]}"
        current_state = self._get_gateway_state()
        now_iso = datetime.datetime.utcnow().isoformat() + "Z"

        record = ActionRecord(
            action_id=action_id,
            action=action,
            params=params,
            previous_state=current_state,
            executed_at=now_iso,
        )
        self.history[action_id] = record

        result_detail = {}

        if action in ("rollback", "failover"):
            # Shift traffic 100% to green
            req_data = json.dumps({"blue": 0, "green": 100}).encode()
            req = urllib.request.Request(
                f"{self.gateway_url}/admin/weights",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                res = json.loads(resp.read().decode())
                result_detail = res

        elif action == "canary_shift":
            blue = int(params.get("blue", 50))
            green = int(params.get("green", 50))
            req_data = json.dumps({"blue": blue, "green": green}).encode()
            req = urllib.request.Request(
                f"{self.gateway_url}/admin/weights",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                result_detail = json.loads(resp.read().decode())

        elif action == "block_rule":
            req_data = json.dumps({
                "route": params.get("route", "/api/orders"),
                "field": params.get("field", "sku"),
                "regex": params.get("regex", ""),
            }).encode()
            req = urllib.request.Request(
                f"{self.gateway_url}/admin/rules",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                result_detail = json.loads(resp.read().decode())
                # Save rule_id for clean undo
                if "rule" in result_detail:
                    record.params["created_rule_id"] = result_detail["rule"]["id"]

        elif action == "disable_endpoint":
            req_data = json.dumps({"route": params.get("route", "")}).encode()
            req = urllib.request.Request(
                f"{self.gateway_url}/admin/disable",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                result_detail = json.loads(resp.read().decode())

        elif action == "hotfix":
            result_detail = {"status": "ok", "message": "Hotfix patch recorded"}

        return {
            "status": "executed",
            "action_id": action_id,
            "action": action,
            "params": params,
            "result": result_detail,
        }

    def undo(self, action_id: str) -> Dict[str, Any]:
        """Revert the action and restore previous gateway state."""
        if action_id not in self.history:
            raise ValueError(f"Action ID {action_id} not found in execution history")

        record = self.history[action_id]
        prev = record.previous_state
        action = record.action

        if action in ("rollback", "failover", "canary_shift"):
            prev_weights = prev.get("weights", {"blue": 50, "green": 50})
            req_data = json.dumps(prev_weights).encode()
            req = urllib.request.Request(
                f"{self.gateway_url}/admin/weights",
                data=req_data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                pass

        elif action == "block_rule":
            rule_id = record.params.get("created_rule_id")
            if rule_id:
                req = urllib.request.Request(f"{self.gateway_url}/admin/rules/{rule_id}", method="DELETE")
                try:
                    with urllib.request.urlopen(req, timeout=3):
                        pass
                except Exception:
                    pass

        elif action == "disable_endpoint":
            route = record.params.get("route", "")
            if route:
                req_data = json.dumps({"route": route}).encode()
                req = urllib.request.Request(
                    f"{self.gateway_url}/admin/enable",
                    data=req_data,
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=3):
                    pass

        del self.history[action_id]
        return {"status": "undone", "action_id": action_id, "action": action}

    def verify_recovery(self, action_id: str, duration_seconds: int = 5) -> Dict[str, Any]:
        """Verify metric recovery after mitigation execution."""
        time.sleep(min(duration_seconds, 2))
        current_state = self._get_gateway_state()
        metrics = current_state.get("metrics", {})
        
        overall = metrics.get("all|all", {})
        err_rate = overall.get("err_rate", 0.0)
        p95_ms = overall.get("p95_ms", 0.0)

        status = "recovered"
        if err_rate > 0.05:
            status = "not_recovered"
        elif err_rate > 0.01 or p95_ms > 200:
            status = "partial"

        return {
            "status": status,
            "action_id": action_id,
            "metrics": {
                "err_rate": err_rate,
                "p95_ms": p95_ms,
                "rps": overall.get("rps", 0.0),
            },
        }
