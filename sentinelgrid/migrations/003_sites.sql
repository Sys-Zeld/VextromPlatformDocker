-- Fase 1 · Fatia 1.2 — Sites (unidade física do cliente). Regras de Negócio §5.
-- client_id NOT NULL → todo site pertence a um cliente (client-scoping, ADR-010).

CREATE TABLE IF NOT EXISTS sg_sites (
  id            BIGSERIAL PRIMARY KEY,
  client_id     BIGINT NOT NULL REFERENCES sg_clients(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  site_type     TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT '',
  local_contact TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  created_by    TEXT NOT NULL DEFAULT '',
  updated_by    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sg_sites_client ON sg_sites (client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_sites_name ON sg_sites (LOWER(name)) WHERE deleted_at IS NULL;
