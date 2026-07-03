-- Fase 2 - Fatia 2.1: Programas de manutencao.
-- Programa e o modelo padrao que depois sera aplicado a um equipamento para gerar
-- plano individual. Escopo por tipo/fabricante/modelo/criticidade/contrato e opcional.

CREATE TABLE IF NOT EXISTS sg_maintenance_programs (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  equipment_type_id   BIGINT REFERENCES sg_equipment_types(id) ON DELETE SET NULL,
  manufacturer_id     BIGINT REFERENCES sg_manufacturers(id) ON DELETE SET NULL,
  model_id            BIGINT REFERENCES sg_equipment_models(id) ON DELETE SET NULL,
  contract_id         BIGINT REFERENCES sg_contracts(id) ON DELETE SET NULL,
  criticality         TEXT,
  maintenance_type    TEXT NOT NULL,
  periodicity         TEXT NOT NULL,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  scope_notes         TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  created_by          TEXT NOT NULL DEFAULT '',
  updated_by          TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sg_programs_name ON sg_maintenance_programs (LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_programs_type ON sg_maintenance_programs (equipment_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_programs_model ON sg_maintenance_programs (model_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_programs_criticality ON sg_maintenance_programs (criticality) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_programs_active ON sg_maintenance_programs (active) WHERE deleted_at IS NULL;
