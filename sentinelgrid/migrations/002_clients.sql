-- Fase 1 · Fatia 1.1 — Clientes (topo da hierarquia Cliente → Site → Área → Equipamento).
-- Regras de Negócio §4. Soft delete via deleted_at (padrão do módulo).

CREATE TABLE IF NOT EXISTS sg_clients (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  tax_id     TEXT NOT NULL DEFAULT '',
  segment    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'ativo',
  notes      TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sg_clients_name ON sg_clients (LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_clients_status ON sg_clients (status) WHERE deleted_at IS NULL;
