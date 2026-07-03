ALTER TABLE sg_maintenance_orders
  ADD COLUMN IF NOT EXISTS plan_item_id BIGINT REFERENCES sg_plan_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sg_maintenance_orders_plan_item_idx
  ON sg_maintenance_orders (plan_item_id)
  WHERE deleted_at IS NULL;
