-- Migration 030: Nota de Intrare-Receptie (NIR / Goods Receipts)
-- Format numar: NK{YY}_{SEQ} (ex: NK26_351 conform documentelor)

-- Secventa pentru numerotare NIR (start 1, va fi formatat NK{an}_{nr})
CREATE SEQUENCE IF NOT EXISTS nir_seq START 1 INCREMENT 1;

CREATE TABLE IF NOT EXISTS goods_receipts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nir_number          VARCHAR(50) UNIQUE,              -- NK26_351, generat la confirmare
  supplier_order_id   UUID REFERENCES supplier_orders(id),  -- referinta comanda
  supplier_name       VARCHAR(200) NOT NULL,            -- ENERGOPLAST SA
  invoice_number      VARCHAR(100),                     -- BNENG.0217.2026
  invoice_date        DATE,
  receipt_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  gestiune            VARCHAR(150),                     -- AMB_CMP 04.AMBALAJE (CMP)
  gestiune_code       VARCHAR(30),                      -- AMB_CMP, VZCB_CMP
  transport_doc       VARCHAR(100),                     -- vagonul/auto nr.
  status              VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','CONFIRMED')),
  total_fara_tva      NUMERIC(15,2),
  notes               TEXT,
  created_by          VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id       UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  line_number      INTEGER NOT NULL,
  material_name    VARCHAR(300) NOT NULL,              -- Denumire material
  cod_material     VARCHAR(100),                       -- Cod material (ERP)
  cont_debitor     VARCHAR(30),                        -- Cont contabil
  unit             VARCHAR(20) DEFAULT 'Buc',          -- UM: Buc, Km, Kg, m
  cant_doc         NUMERIC(15,3) DEFAULT 0,            -- Cant. din document
  cant_received    NUMERIC(15,3) NOT NULL DEFAULT 0,  -- Cant. receptionata
  price_intrare    NUMERIC(15,4) DEFAULT 0,            -- Pret intrare
  total_fara_tva   NUMERIC(15,2),                      -- Total fara TVA
  drum_type_id     UUID REFERENCES drum_types(id),     -- tip tambur (pt ambalaje)
  drum_quantity    INTEGER,                            -- numar bucati tamburi
  batch_id         UUID REFERENCES product_batches(id), -- creat la confirmare
  product_sku      VARCHAR(100),                       -- legatura cu products.sku
  order_line_id    UUID REFERENCES supplier_order_lines(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(receipt_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_gr_status       ON goods_receipts(status);
CREATE INDEX IF NOT EXISTS idx_gr_supplier     ON goods_receipts(supplier_name);
CREATE INDEX IF NOT EXISTS idx_gr_order        ON goods_receipts(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_gr_date         ON goods_receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_grl_receipt     ON goods_receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_grl_product_sku ON goods_receipt_lines(product_sku);
