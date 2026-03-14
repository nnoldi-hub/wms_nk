-- Migration 033: Add shipping/loading fields to sales_orders
-- Date: 2026-03-13

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS loaded_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS loaded_by       VARCHAR(200),
  ADD COLUMN IF NOT EXISTS vehicle_number  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS driver_name     VARCHAR(200),
  ADD COLUMN IF NOT EXISTS delivered_at    TIMESTAMP;

COMMENT ON COLUMN sales_orders.loaded_at      IS 'Timestamp when order was marked LOADED';
COMMENT ON COLUMN sales_orders.loaded_by      IS 'Username who marked the order as LOADED';
COMMENT ON COLUMN sales_orders.vehicle_number IS 'Vehicle/truck registration number';
COMMENT ON COLUMN sales_orders.driver_name    IS 'Driver full name';
COMMENT ON COLUMN sales_orders.delivered_at   IS 'Timestamp when order was marked DELIVERED';
