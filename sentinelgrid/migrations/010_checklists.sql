CREATE TABLE IF NOT EXISTS sg_checklists (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  equipment_type_id BIGINT REFERENCES sg_equipment_types(id) ON DELETE SET NULL,
  manufacturer_id BIGINT REFERENCES sg_manufacturers(id) ON DELETE SET NULL,
  model_id BIGINT REFERENCES sg_equipment_models(id) ON DELETE SET NULL,
  program_id BIGINT REFERENCES sg_maintenance_programs(id) ON DELETE SET NULL,
  maintenance_type TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS sg_checklists_name_active_uniq
  ON sg_checklists (LOWER(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sg_checklists_scope_idx
  ON sg_checklists (equipment_type_id, manufacturer_id, model_id, program_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sg_checklists_active_idx
  ON sg_checklists (active)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_checklist_items (
  id BIGSERIAL PRIMARY KEY,
  checklist_id BIGINT NOT NULL REFERENCES sg_checklists(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'inspection',
  required BOOLEAN NOT NULL DEFAULT TRUE,
  expected_value TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sg_checklist_items_checklist_idx
  ON sg_checklist_items (checklist_id, order_index)
  WHERE deleted_at IS NULL;
