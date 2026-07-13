-- Técnicos próprios do SentinelGrid e vínculo múltiplo com ordens de manutenção.
CREATE TABLE IF NOT EXISTS sg_technicians (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sg_technicians_email
  ON sg_technicians (LOWER(email)) WHERE email <> '' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_order_technicians (
  order_id BIGINT NOT NULL REFERENCES sg_maintenance_orders(id) ON DELETE CASCADE,
  technician_id BIGINT NOT NULL REFERENCES sg_technicians(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_sg_order_technicians_technician
  ON sg_order_technicians (technician_id);
