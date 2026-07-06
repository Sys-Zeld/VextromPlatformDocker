-- Fase 1 (ajuste) — Gestor do cliente pode ter escopo opcional de ÁREA (além do site).
-- Cada área pode ter gestor(es) diferente(s). Nullable/aditivo — não muda gestores atuais.

ALTER TABLE sg_client_managers
  ADD COLUMN IF NOT EXISTS area_id BIGINT REFERENCES sg_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sg_managers_area ON sg_client_managers (area_id) WHERE deleted_at IS NULL;
