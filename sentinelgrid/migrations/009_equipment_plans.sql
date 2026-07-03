-- Fase 2 - Fatia 2.2: Planos individuais do equipamento.
-- Um programa padrao pode ser aplicado a um equipamento para gerar um plano
-- individual com periodicidade/ajustes proprios e itens editaveis.

CREATE TABLE IF NOT EXISTS sg_equipment_plans (
  id               BIGSERIAL PRIMARY KEY,
  equipment_id     BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE RESTRICT,
  program_id       BIGINT REFERENCES sg_maintenance_programs(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  maintenance_type TEXT NOT NULL,
  periodicity      TEXT NOT NULL,
  adjustments      JSONB NOT NULL DEFAULT '{}'::jsonb,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT NOT NULL DEFAULT '',
  created_by       TEXT NOT NULL DEFAULT '',
  updated_by       TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sg_equipment_plans_equipment ON sg_equipment_plans (equipment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_plans_program ON sg_equipment_plans (program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_plans_active ON sg_equipment_plans (active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_plan_items (
  id               BIGSERIAL PRIMARY KEY,
  plan_id          BIGINT NOT NULL REFERENCES sg_equipment_plans(id) ON DELETE RESTRICT,
  title            TEXT NOT NULL,
  maintenance_type TEXT NOT NULL,
  periodicity      TEXT NOT NULL,
  next_due_date    DATE,
  order_index      INTEGER NOT NULL DEFAULT 0,
  notes            TEXT NOT NULL DEFAULT '',
  created_by       TEXT NOT NULL DEFAULT '',
  updated_by       TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sg_plan_items_plan ON sg_plan_items (plan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_plan_items_due ON sg_plan_items (next_due_date) WHERE deleted_at IS NULL;
