-- Migration 042: Sync inventory_items from product_batches
-- Creates trigger that keeps inventory_items in sync automatically.
-- Also backfills existing batches that have a location assigned.

-- ============================================================
-- TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION sync_inventory_from_batch()
RETURNS TRIGGER AS $$
DECLARE
  v_zone_id      UUID;
  v_warehouse_id UUID;
BEGIN
  -- Use NEW for INSERT/UPDATE, OLD for DELETE
  -- For UPDATE we may need to clean up the OLD location if it changed
  IF TG_OP = 'UPDATE' AND OLD.location_id IS DISTINCT FROM NEW.location_id AND OLD.location_id IS NOT NULL THEN
    -- Remove from old location
    DELETE FROM inventory_items
    WHERE lot_number = OLD.batch_number
      AND location_id = OLD.location_id
      AND product_sku  = OLD.product_sku;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM inventory_items
    WHERE lot_number = OLD.batch_number
      AND product_sku = OLD.product_sku;
    RETURN OLD;
  END IF;

  -- Remove entry if batch has no location or is exhausted/damaged
  IF NEW.location_id IS NULL OR NEW.status IN ('EMPTY', 'DAMAGED') THEN
    DELETE FROM inventory_items
    WHERE lot_number = NEW.batch_number
      AND product_sku = NEW.product_sku;
    RETURN NEW;
  END IF;

  -- Lookup zone and warehouse from location
  SELECT zone_id, warehouse_id
    INTO v_zone_id, v_warehouse_id
    FROM locations
   WHERE id = NEW.location_id;

  IF v_zone_id IS NULL OR v_warehouse_id IS NULL THEN
    -- Location has no zone/warehouse — skip silently
    RETURN NEW;
  END IF;

  -- Upsert into inventory_items
  INSERT INTO inventory_items
    (product_sku, warehouse_id, zone_id, location_id, quantity, lot_number, received_at)
  VALUES
    (NEW.product_sku, v_warehouse_id, v_zone_id, NEW.location_id,
     NEW.current_quantity, NEW.batch_number, COALESCE(NEW.received_at, NOW()))
  ON CONFLICT (product_sku, location_id, lot_number)
    WHERE lot_number IS NOT NULL
  DO UPDATE SET
    quantity   = EXCLUDED.quantity,
    zone_id    = EXCLUDED.zone_id,
    warehouse_id = EXCLUDED.warehouse_id,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_inventory_from_batch ON product_batches;

CREATE TRIGGER trg_sync_inventory_from_batch
  AFTER INSERT OR UPDATE OF location_id, current_quantity, status, product_sku
  OR DELETE
  ON product_batches
  FOR EACH ROW
  EXECUTE FUNCTION sync_inventory_from_batch();

-- ============================================================
-- BACKFILL: populate existing batches
-- ============================================================
INSERT INTO inventory_items
  (product_sku, warehouse_id, zone_id, location_id, quantity, lot_number, received_at)
SELECT
  pb.product_sku,
  l.warehouse_id,
  l.zone_id,
  pb.location_id,
  pb.current_quantity,
  pb.batch_number,
  COALESCE(pb.received_at, NOW())
FROM product_batches pb
JOIN locations l ON l.id = pb.location_id
WHERE pb.location_id IS NOT NULL
  AND pb.status NOT IN ('EMPTY', 'DAMAGED')
  AND pb.current_quantity > 0
  AND pb.product_sku IS NOT NULL
  AND l.warehouse_id IS NOT NULL
  AND l.zone_id IS NOT NULL
ON CONFLICT (product_sku, location_id, lot_number)
  WHERE lot_number IS NOT NULL
DO UPDATE SET
  quantity     = EXCLUDED.quantity,
  zone_id      = EXCLUDED.zone_id,
  warehouse_id = EXCLUDED.warehouse_id,
  updated_at   = NOW();

-- Report result
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM inventory_items;
  RAISE NOTICE 'inventory_items populated: % rows', cnt;
END $$;
