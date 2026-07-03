-- Fase 1 · Fatia 1.4 — Catálogo: Fabricantes, Tipos de equipamento e Modelos. Regras §9.
-- Modelo pertence a um fabricante + um tipo. Nome único (case-insensitive) por escopo.

CREATE TABLE IF NOT EXISTS sg_manufacturers (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sg_manufacturers_name ON sg_manufacturers (LOWER(name)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_equipment_types (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sg_equipment_types_name ON sg_equipment_types (LOWER(name)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_equipment_models (
  id                BIGSERIAL PRIMARY KEY,
  manufacturer_id   BIGINT NOT NULL REFERENCES sg_manufacturers(id) ON DELETE RESTRICT,
  equipment_type_id BIGINT NOT NULL REFERENCES sg_equipment_types(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  notes             TEXT NOT NULL DEFAULT '',
  created_by        TEXT NOT NULL DEFAULT '',
  updated_by        TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sg_models_manufacturer ON sg_equipment_models (manufacturer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_models_type ON sg_equipment_models (equipment_type_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sg_models_name ON sg_equipment_models (manufacturer_id, LOWER(name)) WHERE deleted_at IS NULL;
