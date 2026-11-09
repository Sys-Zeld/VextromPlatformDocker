-- Cadastro de usuários do módulo (quem acessa e com qual papel).
-- A conta de login continua sendo a da plataforma (configdb.admin_users);
-- aqui fica só a liberação de acesso e os papéis dentro do módulo:
--   Colaborador (todo membro ativo) · Aprovador · Financeiro.
-- Sem linha (ou inativo) = sem acesso. O Administrador da plataforma sempre
-- entra, com todos os papéis, para conseguir cadastrar os demais.
CREATE TABLE ex_members (
  user_id      TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_approver  BOOLEAN NOT NULL DEFAULT FALSE,
  is_finance   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   TEXT NOT NULL DEFAULT '',
  updated_by   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ex_members_roles ON ex_members (is_approver, is_finance) WHERE active;

-- Quem já tem relatório entra como Colaborador, para a mudança de regra não
-- tirar o acesso de ninguém que já usava o módulo.
INSERT INTO ex_members (user_id, username, created_by, updated_by)
SELECT DISTINCT ON (user_id) user_id, requester_username, 'migration', 'migration'
  FROM ex_reports
 WHERE user_id NOT LIKE 'env:%'
 ORDER BY user_id, created_at DESC
ON CONFLICT (user_id) DO NOTHING;
