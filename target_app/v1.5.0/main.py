"""
target_app v1.5.0 – current (degraded) release.
Vulnerabilities:
  1. SQLi: orders SQL built with f-string on `sku` (same as v1.3.0 / v1.4.0).
  2. N+1: per-item inventory query in POST /api/orders for each item in a batch.
  3. inventory.sku NOT indexed → full table scan per N+1 hit.
"""
import os
import psycopg2
import psycopg2.pool
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

APP_VERSION = "1.5.0"

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"]
        _pool = psycopg2.pool.ThreadedConnectionPool(1, 5, dsn)
    return _pool


def get_conn():
    return get_pool().getconn()


def put_conn(conn):
    get_pool().putconn(conn)


app = FastAPI(title="shop", version=APP_VERSION)


class OrderItem(BaseModel):
    sku: str
    qty: int = 1


class OrderIn(BaseModel):
    customer_id: int
    sku: str
    qty: int = 1
    items: List[OrderItem] = []  # v1.5.0: supports multi-item orders


@app.get("/health")
def health():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ok", "version": APP_VERSION}
    finally:
        put_conn(conn)


@app.get("/api/products")
def list_products():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, sku, name, price, category FROM products ORDER BY id")
            rows = cur.fetchall()
        return [{"id": r[0], "sku": r[1], "name": r[2], "price": float(r[3]), "category": r[4]}
                for r in rows]
    finally:
        put_conn(conn)


@app.post("/api/orders", status_code=201)
def create_order(order: OrderIn):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # VULNERABILITY 1: SQLi – sku interpolated directly via f-string
            query = f"SELECT id, price FROM products WHERE sku = '{order.sku}'"  # noqa: S608
            cur.execute(query)
            product = cur.fetchone()
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            _product_id, price = product
            total = float(price) * order.qty

            # VULNERABILITY 2 + 3: N+1 – separate inventory query per item,
            # inventory.sku has NO index → full table scan each time
            all_items = [OrderItem(sku=order.sku, qty=order.qty)] + (order.items or [])
            inventory_info = []
            for item in all_items:
                # Each iteration fires a separate unindexed query
                cur.execute(
                    "SELECT qty FROM inventory WHERE sku = %s AND warehouse = 'main'",
                    (item.sku,),
                )
                inv = cur.fetchone()
                inventory_info.append({
                    "sku": item.sku,
                    "available": inv[0] if inv else 0,
                    "requested": item.qty,
                })

            cur.execute(
                "INSERT INTO orders (customer_id, sku, qty, total, status) "
                "VALUES (%s, %s, %s, %s, 'pending') RETURNING id",
                (order.customer_id, order.sku, order.qty, total),
            )
            order_id = cur.fetchone()[0]
            conn.commit()

        return {
            "order_id": order_id,
            "sku": order.sku,
            "total": total,
            "inventory": inventory_info,
            "version": APP_VERSION,
        }
    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        put_conn(conn)


@app.get("/api/payments/{payment_id}")
def get_payment(payment_id: int):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, order_id, amount, method, status, created_at FROM payments WHERE id = %s",
                (payment_id,),
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Payment not found")
        return {"id": row[0], "order_id": row[1], "amount": float(row[2]),
                "method": row[3], "status": row[4], "created_at": str(row[5])}
    finally:
        put_conn(conn)
