-- Módulo Relatório de Despesas — esquema inicial (banco isolado "expenses").
-- Usuários vivem no configdb (outro banco): user_id guarda admin_users.id
-- (ou "env:<username>" para o admin do .env), sem FK possível entre bancos.

-- Registros financeiros e de auditoria não podem ser alterados/apagados pelas
-- operações normais do módulo. DROP (reset/restore) não dispara triggers de linha.
CREATE OR REPLACE FUNCTION ex_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registro imutável em % (operação %)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TABLE ex_module_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO ex_module_meta (key, value) VALUES ('schema', 'expenses');

-- Categorias configuráveis.
CREATE TABLE ex_categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ux_ex_categories_name ON ex_categories (LOWER(name));

INSERT INTO ex_categories (name, sort_order) VALUES
  ('Alimentação', 10),
  ('Hospedagem', 20),
  ('Transporte', 30),
  ('Combustível', 40),
  ('Estacionamento', 50),
  ('Pedágio', 60),
  ('Materiais', 70),
  ('Serviços', 80),
  ('Outras despesas', 90);

-- Cadastro complementar (um por usuário). Campos sensíveis cifrados (AES-256-GCM).
CREATE TABLE ex_profiles (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            TEXT NOT NULL UNIQUE,
  username           TEXT NOT NULL,
  full_name          TEXT NOT NULL DEFAULT '',
  cpf_enc            TEXT,
  email              TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  bank_code          TEXT NOT NULL DEFAULT '',
  bank_name          TEXT NOT NULL DEFAULT '',
  agency             TEXT NOT NULL DEFAULT '',
  account_number_enc TEXT,
  account_digit      TEXT NOT NULL DEFAULT '',
  account_type       TEXT NOT NULL DEFAULT ''
                     CHECK (account_type IN ('', 'CORRENTE', 'POUPANCA', 'PAGAMENTO')),
  pix_key_enc        TEXT,
  pix_key_type       TEXT NOT NULL DEFAULT ''
                     CHECK (pix_key_type IN ('', 'CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sequência legível por ano: RD-2026-000001.
CREATE TABLE ex_report_sequences (
  year       INT PRIMARY KEY,
  last_value INT NOT NULL DEFAULT 0
);

CREATE TABLE ex_reports (
  id                   BIGSERIAL PRIMARY KEY,
  report_number        TEXT NOT NULL,
  user_id              TEXT NOT NULL,
  requester_username   TEXT NOT NULL,
  requester_name       TEXT NOT NULL DEFAULT '',
  title                TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description          TEXT NOT NULL DEFAULT '',
  project_id           BIGINT,
  project_name         TEXT NOT NULL DEFAULT '',
  cost_center_id       BIGINT,
  cost_center          TEXT NOT NULL DEFAULT '',
  start_date           DATE NOT NULL,
  end_date             DATE NOT NULL,
  currency             CHAR(3) NOT NULL DEFAULT 'BRL',
  total_amount         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  approved_amount      NUMERIC(14,2) CHECK (approved_amount >= 0),
  paid_amount          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status               TEXT NOT NULL DEFAULT 'RASCUNHO'
                       CHECK (status IN ('RASCUNHO', 'ENVIADO', 'EM_ANALISE', 'DEVOLVIDO', 'APROVADO', 'REJEITADO', 'PAGO')),
  submitted_at         TIMESTAMPTZ,
  review_started_at    TIMESTAMPTZ,
  reviewer_id          TEXT,
  reviewer_name        TEXT,
  approved_at          TIMESTAMPTZ,
  approved_by_id       TEXT,
  approved_by_name     TEXT,
  rejected_at          TIMESTAMPTZ,
  returned_at          TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  last_decision_reason TEXT NOT NULL DEFAULT '',
  version              INT NOT NULL DEFAULT 1,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_ex_reports_period CHECK (end_date >= start_date)
);
CREATE UNIQUE INDEX ux_ex_reports_number ON ex_reports (report_number);
CREATE INDEX ix_ex_reports_user ON ex_reports (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_ex_reports_status ON ex_reports (status) WHERE deleted_at IS NULL;
CREATE INDEX ix_ex_reports_submitted ON ex_reports (submitted_at DESC) WHERE deleted_at IS NULL;

-- Relatórios não são apagados fisicamente (exclusão lógica via deleted_at).
CREATE TRIGGER tr_ex_reports_no_delete BEFORE DELETE ON ex_reports
  FOR EACH ROW EXECUTE FUNCTION ex_forbid_mutation();

CREATE TABLE ex_items (
  id              BIGSERIAL PRIMARY KEY,
  report_id       BIGINT NOT NULL REFERENCES ex_reports(id) ON DELETE RESTRICT,
  category_id     INT NOT NULL REFERENCES ex_categories(id) ON DELETE RESTRICT,
  expense_date    DATE NOT NULL,
  description     TEXT NOT NULL CHECK (length(trim(description)) > 0),
  justification   TEXT NOT NULL CHECK (length(trim(justification)) > 0),
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency        CHAR(3) NOT NULL DEFAULT 'BRL',
  merchant        TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  -- Reservado para aprovação parcial por lançamento (v1 aprova integralmente).
  approved_amount NUMERIC(14,2) CHECK (approved_amount >= 0),
  created_by      TEXT NOT NULL DEFAULT '',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ex_items_report ON ex_items (report_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_ex_items_category ON ex_items (category_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_ex_items_date ON ex_items (expense_date) WHERE deleted_at IS NULL;

CREATE TABLE ex_attachments (
  id            BIGSERIAL PRIMARY KEY,
  item_id       BIGINT NOT NULL REFERENCES ex_items(id) ON DELETE RESTRICT,
  report_id     BIGINT NOT NULL REFERENCES ex_reports(id) ON DELETE RESTRICT,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  file_size     INT NOT NULL CHECK (file_size > 0),
  storage_path  TEXT NOT NULL,
  file_hash     CHAR(64) NOT NULL,
  uploaded_by   TEXT NOT NULL,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ex_attachments_item ON ex_attachments (item_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_ex_attachments_report ON ex_attachments (report_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_ex_attachments_hash ON ex_attachments (file_hash) WHERE deleted_at IS NULL;

CREATE TABLE ex_approval_history (
  id                BIGSERIAL PRIMARY KEY,
  report_id         BIGINT NOT NULL REFERENCES ex_reports(id) ON DELETE RESTRICT,
  previous_status   TEXT,
  new_status        TEXT NOT NULL,
  action            TEXT NOT NULL,
  performed_by      TEXT NOT NULL,
  performed_by_name TEXT NOT NULL DEFAULT '',
  reason            TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ex_history_report ON ex_approval_history (report_id, created_at);
CREATE TRIGGER tr_ex_history_immutable BEFORE UPDATE OR DELETE ON ex_approval_history
  FOR EACH ROW EXECUTE FUNCTION ex_forbid_mutation();

CREATE TABLE ex_payments (
  id                        BIGSERIAL PRIMARY KEY,
  report_id                 BIGINT NOT NULL REFERENCES ex_reports(id) ON DELETE RESTRICT,
  -- INTEGRAL na v1; PARCIAL reservado para evolução.
  payment_type              TEXT NOT NULL DEFAULT 'INTEGRAL' CHECK (payment_type IN ('INTEGRAL', 'PARCIAL')),
  amount                    NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date              DATE NOT NULL,
  payment_method            TEXT NOT NULL
                            CHECK (payment_method IN ('PIX', 'TED', 'DEPOSITO', 'DINHEIRO', 'OUTRO')),
  transaction_reference     TEXT NOT NULL DEFAULT '',
  proof_path                TEXT,
  proof_name                TEXT,
  proof_mime                TEXT,
  bank_details_snapshot_enc TEXT,
  notes                     TEXT NOT NULL DEFAULT '',
  recorded_by               TEXT NOT NULL,
  recorded_by_name          TEXT NOT NULL DEFAULT '',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Um único pagamento integral por relatório (barreira contra duplicidade).
CREATE UNIQUE INDEX ux_ex_payments_integral ON ex_payments (report_id) WHERE payment_type = 'INTEGRAL';
CREATE INDEX ix_ex_payments_date ON ex_payments (payment_date DESC);
CREATE TRIGGER tr_ex_payments_immutable BEFORE UPDATE OR DELETE ON ex_payments
  FOR EACH ROW EXECUTE FUNCTION ex_forbid_mutation();

CREATE TABLE ex_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  report_id       BIGINT REFERENCES ex_reports(id) ON DELETE RESTRICT,
  actor_id        TEXT NOT NULL,
  actor_name      TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT,
  previous_status TEXT,
  new_status      TEXT,
  reason          TEXT NOT NULL DEFAULT '',
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ex_audit_report ON ex_audit_log (report_id, created_at);
CREATE INDEX ix_ex_audit_created ON ex_audit_log (created_at DESC);
CREATE TRIGGER tr_ex_audit_immutable BEFORE UPDATE OR DELETE ON ex_audit_log
  FOR EACH ROW EXECUTE FUNCTION ex_forbid_mutation();

-- Notificações internas (não havia infraestrutura reutilizável).
CREATE TABLE ex_notifications (
  id                BIGSERIAL PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  report_id         BIGINT REFERENCES ex_reports(id) ON DELETE RESTRICT,
  event             TEXT NOT NULL,
  title             TEXT NOT NULL,
  message           TEXT NOT NULL DEFAULT '',
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ex_notifications_recipient ON ex_notifications (recipient_user_id, created_at DESC);
CREATE INDEX ix_ex_notifications_unread ON ex_notifications (recipient_user_id) WHERE read_at IS NULL;
