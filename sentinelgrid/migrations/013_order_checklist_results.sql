CREATE TABLE IF NOT EXISTS sg_order_checklist_results (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES sg_maintenance_orders(id) ON DELETE RESTRICT,
  checklist_id BIGINT NOT NULL REFERENCES sg_checklists(id) ON DELETE RESTRICT,
  checklist_item_id BIGINT NOT NULL REFERENCES sg_checklist_items(id) ON DELETE RESTRICT,
  value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS sg_order_checklist_results_order_item_uniq
  ON sg_order_checklist_results (order_id, checklist_item_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sg_order_checklist_results_order_idx
  ON sg_order_checklist_results (order_id, status)
  WHERE deleted_at IS NULL;
