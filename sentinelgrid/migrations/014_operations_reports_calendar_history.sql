CREATE TABLE IF NOT EXISTS sg_measurements (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES sg_maintenance_orders(id) ON DELETE RESTRICT,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  technician_id TEXT NOT NULL DEFAULT '',
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_measurements_order_idx ON sg_measurements (order_id, measured_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sg_measurements_equipment_idx ON sg_measurements (equipment_id, metric) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_replaced_parts (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES sg_maintenance_orders(id) ON DELETE RESTRICT,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  part_description TEXT NOT NULL,
  part_code TEXT NOT NULL DEFAULT '',
  manufacturer TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  removed_condition TEXT NOT NULL DEFAULT '',
  new_part_installed BOOLEAN NOT NULL DEFAULT TRUE,
  evidence TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_replaced_parts_order_idx ON sg_replaced_parts (order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sg_replaced_parts_equipment_idx ON sg_replaced_parts (equipment_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_attachments (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  file_ref TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_attachments_entity_idx ON sg_attachments (entity_type, entity_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_associated_reports (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES sg_maintenance_orders(id) ON DELETE RESTRICT,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  report_code TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  issued_at TIMESTAMPTZ,
  technician TEXT NOT NULL DEFAULT '',
  report_type TEXT NOT NULL DEFAULT '',
  file_ref TEXT NOT NULL DEFAULT '',
  external_link TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_associated_reports_order_idx ON sg_associated_reports (order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sg_associated_reports_equipment_idx ON sg_associated_reports (equipment_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_events (
  id BIGSERIAL PRIMARY KEY,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  generated_order_id BIGINT REFERENCES sg_maintenance_orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'media',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL,
  action_taken TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_events_equipment_idx ON sg_events (equipment_id, occurred_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sg_events_order_idx ON sg_events (generated_order_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_equipment_history (
  id BIGSERIAL PRIMARY KEY,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  event_kind TEXT NOT NULL,
  ref_table TEXT NOT NULL DEFAULT '',
  ref_id BIGINT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sg_equipment_history_equipment_idx ON sg_equipment_history (equipment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS sg_equipment_history_ref_idx ON sg_equipment_history (ref_table, ref_id);

CREATE TABLE IF NOT EXISTS sg_calendar_entries (
  id BIGSERIAL PRIMARY KEY,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  plan_item_id BIGINT REFERENCES sg_plan_items(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  maintenance_type TEXT NOT NULL,
  planned_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planejada',
  generated_order_id BIGINT REFERENCES sg_maintenance_orders(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (equipment_id, plan_item_id, planned_date)
);

CREATE INDEX IF NOT EXISTS sg_calendar_entries_year_month_idx ON sg_calendar_entries (year, month, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sg_calendar_entries_equipment_idx ON sg_calendar_entries (equipment_id, planned_date) WHERE deleted_at IS NULL;
