-- Aprovadores definidos por usuário (um ou mais). Qualquer um deles — ou o
-- Administrador, como substituto — decide sobre os relatórios do usuário, e
-- só eles os enxergam na Gestão. A regra lê os aprovadores ATUAIS do
-- solicitante: mudar a lista transfere na hora os relatórios pendentes.
-- Sem nenhum aprovador disponível, o usuário não consegue enviar relatórios.
CREATE TABLE ex_user_approvers (
  user_id     TEXT NOT NULL REFERENCES ex_users(id) ON DELETE RESTRICT,
  approver_id TEXT NOT NULL REFERENCES ex_users(id) ON DELETE RESTRICT,
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, approver_id),
  CHECK (user_id <> approver_id)
);
CREATE INDEX ix_ex_user_approvers_approver ON ex_user_approvers (approver_id);
