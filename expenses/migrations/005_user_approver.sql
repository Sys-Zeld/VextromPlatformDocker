-- Aprovador definido por usuário (primeira versão: um aprovador por usuário).
-- Substituído pela lista de aprovadores em 007_user_approvers.sql, que copia
-- este valor para a tabela nova e remove a coluna.
ALTER TABLE ex_users ADD COLUMN approver_id TEXT REFERENCES ex_users(id) ON DELETE RESTRICT;
ALTER TABLE ex_users ADD CONSTRAINT ck_ex_users_approver_not_self CHECK (approver_id IS NULL OR approver_id <> id);
CREATE INDEX ix_ex_users_approver ON ex_users (approver_id) WHERE deleted_at IS NULL;
