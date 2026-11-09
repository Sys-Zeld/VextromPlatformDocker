-- Autenticação própria do módulo: login e senha independentes do hub.
-- Os relatórios passam a referenciar ex_users.id. O cadastro anterior
-- (ex_members, ligado às contas da plataforma) fica preservado, sem uso.

CREATE TABLE ex_users (
  id                   TEXT PRIMARY KEY DEFAULT ('ex:' || gen_random_uuid()::text),
  username             TEXT NOT NULL CHECK (length(trim(username)) >= 3),
  full_name            TEXT NOT NULL DEFAULT '',
  email                TEXT NOT NULL DEFAULT '',
  -- "scrypt$<salt hex>$<hash hex>"; vazio enquanto o convite não foi aceito.
  password_hash        TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  is_admin             BOOLEAN NOT NULL DEFAULT FALSE,
  is_approver          BOOLEAN NOT NULL DEFAULT FALSE,
  is_finance           BOOLEAN NOT NULL DEFAULT FALSE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  failed_attempts      INT NOT NULL DEFAULT 0,
  locked_until         TIMESTAMPTZ,
  -- Incrementado em troca de senha/desativação: invalida sessões abertas.
  session_version      INT NOT NULL DEFAULT 1,
  last_login_at        TIMESTAMPTZ,
  password_changed_at  TIMESTAMPTZ,
  created_by           TEXT NOT NULL DEFAULT '',
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ux_ex_users_username ON ex_users (LOWER(username)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_ex_users_email ON ex_users (LOWER(email)) WHERE deleted_at IS NULL AND email <> '';

-- Exclusão de conta é lógica (relatórios e auditoria referenciam o id).
CREATE TRIGGER tr_ex_users_no_delete BEFORE DELETE ON ex_users
  FOR EACH ROW EXECUTE FUNCTION ex_forbid_mutation();

-- Tokens de uso único (convite e redefinição de senha). Só o hash é guardado.
CREATE TABLE ex_user_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES ex_users(id) ON DELETE RESTRICT,
  kind       TEXT NOT NULL CHECK (kind IN ('invite', 'reset')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ex_user_tokens_user ON ex_user_tokens (user_id, kind) WHERE used_at IS NULL;
