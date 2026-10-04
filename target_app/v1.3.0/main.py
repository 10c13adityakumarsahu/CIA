"""
target_app v1.3.0 – stable release.
Vulnerability: SQL injection in POST /api/orders via f-string on `sku`.
"""
import os
import time
import psycopg2
import psycopg2.pool
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

APP_VERSION = "1.3.0"

# ---------- DB pool (max=5 per spec) ----------
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


# ---------- App ----------
app = FastAPI(title="shop", version=APP_VERSION)


class OrderIn(BaseModel):
    customer_id: int
    sku: str
    qty: int = 1


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
            # VULNERABILITY: SQLi – sku interpolated directly via f-string
            query = f"SELECT id, price FROM products WHERE sku = '{order.sku}'"  # noqa: S608
            cur.execute(query)
            product = cur.fetchone()
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            product_id, price = product
            total = float(price) * order.qty
            cur.execute(
                "INSERT INTO orders (customer_id, sku, qty, total, status) "
                "VALUES (%s, %s, %s, %s, 'pending') RETURNING id",
                (order.customer_id, order.sku, order.qty, total),
            )
            order_id = cur.fetchone()[0]
            conn.commit()
        return {"order_id": order_id, "total": total, "version": APP_VERSION}
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
