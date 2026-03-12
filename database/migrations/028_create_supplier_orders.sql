-- Migration 028: Comenzi Furnizor (Purchase Orders)
-- Format: CA_3392 / 11/03/2026 conform documentelor NK Smart Cables

CREATE TABLE IF NOT EXISTS supplier_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    VARCHAR(50) UNIQUE NOT NULL,           -- CA_3392
  supplier_name   VARCHAR(200) NOT NULL,                -- ENERGOPLAST SA
  supplier_cui    VARCHAR(50),
  supplier_address TEXT,
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   DATE,
  currency        VARCHAR(10) DEFAULT 'RON',
  status          VARCHAR(30) DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','CONFIRMED','RECEIVING','RECEIVED','CLOSED','CANCELLED')),
  total_value     NUMERIC(15,2),
  notes           TEXT,
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_order_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  line_number     INTEGER NOT NULL,
  product_sku     VARCHAR(100),                        -- legatura cu products.sku
  product_name    VARCHAR(300) NOT NULL,               -- denumire din comanda
  quantity        NUMERIC(15,3) NOT NULL,
  unit            VARCHAR(20) DEFAULT 'Km',            -- Km, Buc, Kg, m
  list_price      NUMERIC(15,4) DEFAULT 0,             -- Pret Lista
  discount_pct    NUMERIC(5,2) DEFAULT 0,              -- Disco %
  unit_price      NUMERIC(15,4) NOT NULL DEFAULT 0,   -- Pret Unitar
  line_value      NUMERIC(15,2),                       -- Valoare (qty * unit_price)
  packaging_type  VARCHAR(50),                         -- Mod Ambalare
  received_qty    NUMERIC(15,3) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_status   ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier  ON supplier_orders(supplier_name);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_date      ON supplier_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sol_order_id              ON supplier_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_sol_product_sku           ON supplier_order_lines(product_sku);
