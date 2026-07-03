CREATE SEQUENCE IF NOT EXISTS sg_maintenance_order_number_seq;

CREATE TABLE IF NOT EXISTS sg_maintenance_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  client_id BIGINT NOT NULL REFERENCES sg_clients(id) ON DELETE RESTRICT,
  site_id BIGINT NOT NULL REFERENCES sg_sites(id) ON DELETE RESTRICT,
  area_id BIGINT NOT NULL REFERENCES sg_areas(id) ON DELETE RESTRICT,
  plan_id BIGINT REFERENCES sg_equipment_plans(id) ON DELETE SET NULL,
  checklist_id BIGINT REFERENCES sg_checklists(id) ON DELETE SET NULL,
  maintenance_type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  planned_date DATE,
  scheduled_date TIMESTAMPTZ,
  executed_date TIMESTAMPTZ,
  technician_id TEXT NOT NULL DEFAULT '',
  client_manager_id BIGINT REFERENCES sg_client_managers(id) ON DELETE SET NULL,
  scope TEXT NOT NULL DEFAULT '',
  final_condition TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_maintenance_orders_equipment_idx
  ON sg_maintenance_orders (equipment_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sg_maintenance_orders_client_status_idx
  ON sg_maintenance_orders (client_id, status, planned_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sg_maintenance_orders_type_idx
  ON sg_maintenance_orders (maintenance_type)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_order_corrective_details (
  order_id BIGINT PRIMARY KEY REFERENCES sg_maintenance_orders(id) ON DELETE RESTRICT,
  symptom TEXT NOT NULL DEFAULT '',
  alarm TEXT NOT NULL DEFAULT '',
  operational_impact TEXT NOT NULL DEFAULT '',
  probable_cause TEXT NOT NULL DEFAULT '',
  root_cause TEXT NOT NULL DEFAULT '',
  action_taken TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL DEFAULT '',
  corrective_class TEXT NOT NULL DEFAULT 'programada',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sg_client_approvals (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES sg_maintenance_orders(id) ON DELETE RESTRICT,
  client_manager_id BIGINT REFERENCES sg_client_managers(id) ON DELETE SET NULL,
  approver_name TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ,
  authorized_window TEXT NOT NULL DEFAULT '',
  restrictions TEXT NOT NULL DEFAULT '',
  release_condition TEXT NOT NULL DEFAULT '',
  final_accept BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_client_approvals_order_idx
  ON sg_client_approvals (order_id)
  WHERE deleted_at IS NULL;
