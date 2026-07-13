-- Vínculo lógico bidirecional SentinelGrid <-> Service Report.
--
-- Não há FK SQL entre os bancos dos módulos: service_report_id é uma
-- referência externa, validada pelo contrato de integração. A unicidade vale
-- somente para registros ativos, permitindo reimportar uma entidade depois de
-- um soft delete sem ressuscitar o cadastro antigo.

ALTER TABLE sg_clients   ADD COLUMN IF NOT EXISTS service_report_id BIGINT;
ALTER TABLE sg_sites     ADD COLUMN IF NOT EXISTS service_report_id BIGINT;
ALTER TABLE sg_equipment ADD COLUMN IF NOT EXISTS service_report_id BIGINT;

WITH ranked AS (
  SELECT l.sg_id, l.rs_id,
         ROW_NUMBER() OVER (PARTITION BY l.rs_id ORDER BY l.updated_at DESC, l.sg_id DESC) AS rn
    FROM sg_rs_links l
    JOIN sg_clients c ON c.id = l.sg_id AND c.deleted_at IS NULL
   WHERE l.entity_type = 'client'
)
UPDATE sg_clients c SET service_report_id = r.rs_id
  FROM ranked r WHERE c.id = r.sg_id AND r.rn = 1;

WITH ranked AS (
  SELECT l.sg_id, l.rs_id,
         ROW_NUMBER() OVER (PARTITION BY l.rs_id ORDER BY l.updated_at DESC, l.sg_id DESC) AS rn
    FROM sg_rs_links l
    JOIN sg_sites s ON s.id = l.sg_id AND s.deleted_at IS NULL
   WHERE l.entity_type = 'site'
)
UPDATE sg_sites s SET service_report_id = r.rs_id
  FROM ranked r WHERE s.id = r.sg_id AND r.rn = 1;

WITH ranked AS (
  SELECT l.sg_id, l.rs_id,
         ROW_NUMBER() OVER (PARTITION BY l.rs_id ORDER BY l.updated_at DESC, l.sg_id DESC) AS rn
    FROM sg_rs_links l
    JOIN sg_equipment e ON e.id = l.sg_id AND e.deleted_at IS NULL
   WHERE l.entity_type = 'equipment'
)
UPDATE sg_equipment e SET service_report_id = r.rs_id
  FROM ranked r WHERE e.id = r.sg_id AND r.rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sg_clients_service_report
  ON sg_clients (service_report_id)
  WHERE service_report_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sg_sites_service_report
  ON sg_sites (service_report_id)
  WHERE service_report_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sg_equipment_service_report
  ON sg_equipment (service_report_id)
  WHERE service_report_id IS NOT NULL AND deleted_at IS NULL;

