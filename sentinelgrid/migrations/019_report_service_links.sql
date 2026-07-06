-- Fase 11.2 — Mapeamento SentinelGrid → Service Report (ADR-004) e rastreio de envio da OM.
-- sg_rs_links guarda o id do registro correspondente no RS por entidade (cliente/site/equipamento),
-- garantindo reuso idempotente (1:1) sem duplicar. Colunas na OM registram a OS gerada.

CREATE TABLE IF NOT EXISTS sg_rs_links (
  entity_type TEXT NOT NULL,          -- 'client' | 'site' | 'equipment'
  sg_id       BIGINT NOT NULL,        -- id no SentinelGrid
  rs_id       BIGINT NOT NULL,        -- id correspondente no Service Report
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, sg_id)
);
CREATE INDEX IF NOT EXISTS idx_sg_rs_links_rs ON sg_rs_links (entity_type, rs_id);

ALTER TABLE sg_maintenance_orders ADD COLUMN IF NOT EXISTS rs_service_order_id   BIGINT;
ALTER TABLE sg_maintenance_orders ADD COLUMN IF NOT EXISTS rs_service_order_code TEXT NOT NULL DEFAULT '';
ALTER TABLE sg_maintenance_orders ADD COLUMN IF NOT EXISTS rs_sent_at            TIMESTAMPTZ;
