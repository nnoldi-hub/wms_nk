-- Migration 031: Add delivery_date, priority and erp_ref to sales_orders
-- Date: 2026-03-13
-- Supports: FAZA 1 (1.4, 1.5, 1.6) din Flux Comenzi Clienti

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS delivery_date   DATE,
  ADD COLUMN IF NOT EXISTS priority        VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL','HIGH','URGENT')),
  ADD COLUMN IF NOT EXISTS erp_ref         VARCHAR(100);

-- Index pentru filtrare rapidă comenzi urgente / întârziate
CREATE INDEX IF NOT EXISTS idx_sales_orders_priority      ON sales_orders(priority);
CREATE INDEX IF NOT EXISTS idx_sales_orders_delivery_date ON sales_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_erp_ref       ON sales_orders(erp_ref);

COMMENT ON COLUMN sales_orders.delivery_date IS 'Termenul de livrare promis clientului';
COMMENT ON COLUMN sales_orders.priority      IS 'Prioritatea comenzii: NORMAL | HIGH | URGENT';
COMMENT ON COLUMN sales_orders.erp_ref       IS 'Referința comenzii în ERP extern (Pluriva etc.)';
