-- Aprovador definido por usuário: só ele (ou o Administrador, como substituto)
-- decide sobre os relatórios do usuário, e só ele os enxerga na Gestão.
-- A regra lê o aprovador ATUAL do solicitante: trocar o aprovador de alguém
-- transfere na hora os relatórios pendentes dessa pessoa.
-- Sem aprovador definido, o usuário não consegue enviar relatórios.
ALTER TABLE ex_users ADD COLUMN approver_id TEXT REFERENCES ex_users(id) ON DELETE RESTRICT;
ALTER TABLE ex_users ADD CONSTRAINT ck_ex_users_approver_not_self CHECK (approver_id IS NULL OR approver_id <> id);
CREATE INDEX ix_ex_users_approver ON ex_users (approver_id) WHERE deleted_at IS NULL;
