-- Fase 1 · Ajuste — Contratos ganham número de contrato (numeração INICIAIS-NNNNNN-AA)
-- e contato do cliente (e-mail/telefone). Gestores já têm email/phone desde a 007.

ALTER TABLE sg_contracts ADD COLUMN IF NOT EXISTS contract_number TEXT NOT NULL DEFAULT '';
ALTER TABLE sg_contracts ADD COLUMN IF NOT EXISTS contact_email   TEXT NOT NULL DEFAULT '';
ALTER TABLE sg_contracts ADD COLUMN IF NOT EXISTS contact_phone   TEXT NOT NULL DEFAULT '';

-- Número de contrato único entre os contratos ativos (ignora vazios e soft-deletados).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sg_contracts_number
  ON sg_contracts (contract_number)
  WHERE deleted_at IS NULL AND contract_number <> '';
