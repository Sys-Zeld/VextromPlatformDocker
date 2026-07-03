-- Fase 1 · Fatia 1.5 — Equipamento (entidade central). Regras §7, §28.2.
-- client_id/site_id/area_id NOT NULL (derivados da área no service). FKs de
-- catálogo (tipo/fabricante/modelo) opcionais (SET NULL se o lookup for removido).

CREATE TABLE IF NOT EXISTS sg_equipment (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           BIGINT NOT NULL REFERENCES sg_clients(id) ON DELETE RESTRICT,
  site_id             BIGINT NOT NULL REFERENCES sg_sites(id) ON DELETE RESTRICT,
  area_id             BIGINT NOT NULL REFERENCES sg_areas(id) ON DELETE RESTRICT,
  tag                 TEXT NOT NULL DEFAULT '',
  equipment_type_id   BIGINT REFERENCES sg_equipment_types(id) ON DELETE SET NULL,
  manufacturer_id     BIGINT REFERENCES sg_manufacturers(id) ON DELETE SET NULL,
  model_id            BIGINT REFERENCES sg_equipment_models(id) ON DELETE SET NULL,
  serial_number       TEXT NOT NULL DEFAULT '',
  rated_power         TEXT NOT NULL DEFAULT '',
  input_voltage       TEXT NOT NULL DEFAULT '',
  output_voltage      TEXT NOT NULL DEFAULT '',
  dc_voltage          TEXT NOT NULL DEFAULT '',
  frequency           TEXT NOT NULL DEFAULT '',
  redundancy_config   TEXT NOT NULL DEFAULT '',
  module_count        INTEGER,
  battery_type        TEXT NOT NULL DEFAULT '',
  install_date        DATE,
  commission_date     DATE,
  criticality         TEXT NOT NULL DEFAULT 'media',
  operational_status  TEXT NOT NULL DEFAULT 'operacional_normal',
  internal_technician TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  created_by          TEXT NOT NULL DEFAULT '',
  updated_by          TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sg_equipment_client ON sg_equipment (client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_site ON sg_equipment (site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_area ON sg_equipment (area_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_criticality ON sg_equipment (criticality) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_status ON sg_equipment (operational_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_tag ON sg_equipment (LOWER(tag)) WHERE deleted_at IS NULL;
