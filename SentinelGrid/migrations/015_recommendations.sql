CREATE TABLE IF NOT EXISTS sg_recommendations (
  id BIGSERIAL PRIMARY KEY,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  order_id BIGINT REFERENCES sg_maintenance_orders(id) ON DELETE SET NULL,
  report_id BIGINT REFERENCES sg_associated_reports(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  technical_reason TEXT NOT NULL DEFAULT '',
  criticality TEXT NOT NULL DEFAULT 'media',
  due_date DATE,
  responsible TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aberta',
  evidence TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_recommendations_equipment_idx ON sg_recommendations (equipment_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sg_recommendations_order_idx ON sg_recommendations (order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sg_recommendations_due_idx ON sg_recommendations (due_date, criticality) WHERE deleted_at IS NULL;
