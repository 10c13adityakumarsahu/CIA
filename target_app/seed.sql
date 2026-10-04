-- Seed data for CULPRIT target_app

INSERT INTO customers (name, email, phone, address) VALUES
  ('Alice Martin',  'alice@example.com',  '555-0101', '1 Main St'),
  ('Bob Chen',      'bob@example.com',    '555-0102', '2 Oak Ave'),
  ('Carol White',   'carol@example.com',  '555-0103', '3 Pine Rd'),
  ('Dan Brown',     'dan@example.com',    '555-0104', '4 Elm Blvd'),
  ('Eva Green',     'eva@example.com',    '555-0105', '5 Cedar Ln')
ON CONFLICT DO NOTHING;

INSERT INTO products (sku, name, price, category) VALUES
  ('WIDGET-001', 'Blue Widget',    9.99,  'widgets'),
  ('WIDGET-002', 'Red Widget',     14.99, 'widgets'),
  ('GADGET-001', 'Smart Gadget',   49.99, 'gadgets'),
  ('GADGET-002', 'Power Gadget',   79.99, 'gadgets'),
  ('TOOL-001',   'Basic Tool',     24.99, 'tools'),
  ('TOOL-002',   'Pro Tool',       59.99, 'tools'),
  ('PART-001',   'Spare Part A',   4.99,  'parts'),
  ('PART-002',   'Spare Part B',   7.99,  'parts'),
  ('PART-003',   'Spare Part C',   3.49,  'parts'),
  ('PART-004',   'Spare Part D',   6.99,  'parts')
ON CONFLICT DO NOTHING;

-- inventory rows (one per sku, no index on sku in v1.5.0)
INSERT INTO inventory (sku, qty, warehouse) VALUES
  ('WIDGET-001', 100, 'main'),
  ('WIDGET-002', 80,  'main'),
  ('GADGET-001', 30,  'main'),
  ('GADGET-002', 20,  'main'),
  ('TOOL-001',   50,  'main'),
  ('TOOL-002',   25,  'main'),
  ('PART-001',   200, 'main'),
  ('PART-002',   150, 'main'),
  ('PART-003',   300, 'main'),
  ('PART-004',   175, 'main')
ON CONFLICT DO NOTHING;
