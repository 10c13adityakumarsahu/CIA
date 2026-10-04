-- CULPRIT target_app shared schema
-- Applied once; versions share the same DB.

CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
        CREATE ROLE app_rw LOGIN PASSWORD 'app_rw_pass';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    phone       TEXT,
    address     TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    sku         TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    category    TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
    id          SERIAL PRIMARY KEY,
    sku         TEXT NOT NULL,   -- intentionally NOT indexed in v1.5.0
    qty         INTEGER NOT NULL DEFAULT 0,
    warehouse   TEXT DEFAULT 'main'
);

CREATE TABLE IF NOT EXISTS orders (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    sku         TEXT NOT NULL,
    qty         INTEGER NOT NULL DEFAULT 1,
    total       NUMERIC(10,2),
    status      TEXT DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER REFERENCES orders(id),
    amount      NUMERIC(10,2),
    method      TEXT,
    status      TEXT DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Grant app_rw read access
GRANT SELECT ON customers, products, inventory, orders, payments TO app_rw;
GRANT INSERT, UPDATE ON orders, payments TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;

INSERT INTO schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;
