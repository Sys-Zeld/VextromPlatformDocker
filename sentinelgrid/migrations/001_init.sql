-- SentinelGrid — migração baseline (Fase 0).
-- O controle de versão de schema é feito pela tabela sg_schema_migrations (runner).
-- Esta baseline registra apenas metadados do módulo; as entidades de negócio
-- (sg_clients, sg_sites, sg_areas, sg_equipment, ...) entram a partir da Fase 1.

CREATE TABLE IF NOT EXISTS sg_module_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sg_module_meta (key, value)
VALUES
  ('module', 'sentinelgrid'),
  ('schema_baseline', '001_init')
ON CONFLICT (key) DO NOTHING;
