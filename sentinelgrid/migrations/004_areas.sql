-- Fase 1 · Fatia 1.3 — Áreas (localização física/funcional do equipamento). Regras §6.
-- site_id NOT NULL → toda área pertence a um site (e, via site, a um cliente).

CREATE TABLE IF NOT EXISTS sg_areas (
  id                  BIGSERIAL PRIMARY KEY,
  site_id             BIGINT NOT NULL REFERENCES sg_sites(id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  area_type           TEXT NOT NULL DEFAULT '',
  classification      TEXT NOT NULL DEFAULT '',
  access_restrictions TEXT NOT NULL DEFAULT '',
  env_conditions      TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  created_by          TEXT NOT NULL DEFAULT '',
  updated_by          TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sg_areas_site ON sg_areas (site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_areas_name ON sg_areas (LOWER(name)) WHERE deleted_at IS NULL;
