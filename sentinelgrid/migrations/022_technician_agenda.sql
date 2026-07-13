-- Duração prevista da execução usada para ocupar a agenda dos técnicos.
ALTER TABLE sg_maintenance_orders
  ADD COLUMN IF NOT EXISTS execution_days INTEGER NOT NULL DEFAULT 1;

ALTER TABLE sg_maintenance_orders
  DROP CONSTRAINT IF EXISTS chk_sg_maintenance_orders_execution_days;
ALTER TABLE sg_maintenance_orders
  ADD CONSTRAINT chk_sg_maintenance_orders_execution_days
  CHECK (execution_days BETWEEN 1 AND 365);
