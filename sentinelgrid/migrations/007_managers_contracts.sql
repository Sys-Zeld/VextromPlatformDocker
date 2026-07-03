-- Fase 1 · Fatia 1.6 — Gestores do cliente (§8) e Contratos/Escopo (§26).
-- Ambos pertencem a um cliente. Gestor pode ter escopo opcional de site.

CREATE TABLE IF NOT EXISTS sg_client_managers (
  id         BIGSERIAL PRIMARY KEY,
  client_id  BIGINT NOT NULL REFERENCES sg_clients(id) ON DELETE RESTRICT,
  site_id    BIGINT REFERENCES sg_sites(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  role_type  TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sg_managers_client ON sg_client_managers (client_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_contracts (
  id                BIGSERIAL PRIMARY KEY,
  client_id         BIGINT NOT NULL REFERENCES sg_clients(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  valid_from        DATE,
  valid_to          DATE,
  maint_per_year    INTEGER,
  sla_corrective    TEXT NOT NULL DEFAULT '',
  requires_report   BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  scope             TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  created_by        TEXT NOT NULL DEFAULT '',
  updated_by        TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sg_contracts_client ON sg_contracts (client_id) WHERE deleted_at IS NULL;
