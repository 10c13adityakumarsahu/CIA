"""
loadgen.main – Steady, realistic background traffic generator for CULPRIT gateway.
Sends periodic requests to /health, /api/products, /api/orders, and /api/payments/{id}.
"""

import os
import random
import time
import requests

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://gateway:8080")
RPS = float(os.environ.get("LOAD_RPS", "5.0"))

SKUS = [
    "WIDGET-001", "WIDGET-002",
    "GADGET-001", "GADGET-002",
    "TOOL-001", "TOOL-002",
    "PART-001", "PART-002",
]


def send_traffic_loop():
    print(f"Starting loadgen targeting {GATEWAY_URL} at ~{RPS} RPS...")
    session = requests.Session()
    
    # Wait for gateway to be available
    for _ in range(30):
        try:
            r = session.get(f"{GATEWAY_URL}/health", timeout=2)
            if r.status_code == 200:
                print("Gateway is healthy! Beginning traffic loop.")
                break
        except Exception:
            time.sleep(1)
    
    interval = 1.0 / max(1.0, RPS)
    
    while True:
        try:
            action = random.choices(
                ["products", "order", "payment", "health"],
                weights=[40, 30, 20, 10],
                k=1,
            )[0]

            if action == "products":
                session.get(f"{GATEWAY_URL}/api/products", timeout=5)
            elif action == "order":
                sku = random.choice(SKUS)
                payload = {
                    "customer_id": random.randint(1, 5),
                    "sku": sku,
                    "qty": random.randint(1, 3),
                }
                session.post(f"{GATEWAY_URL}/api/orders", json=payload, timeout=10)
            elif action == "payment":
                payment_id = random.randint(1, 5)
                session.get(f"{GATEWAY_URL}/api/payments/{payment_id}", timeout=5)
            elif action == "health":
                session.get(f"{GATEWAY_URL}/health", timeout=5)
        except Exception:
            pass

        time.sleep(interval)


if __name__ == "__main__":
    send_traffic_loop()
