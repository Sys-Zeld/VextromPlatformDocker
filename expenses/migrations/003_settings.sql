-- Configurações do módulo (chave/valor). Primeiro uso: e-mail (SMTP próprio
-- ou da plataforma, notificações ligadas/desligadas). Senha SMTP é gravada
-- cifrada pelo serviço (nunca em texto puro).
CREATE TABLE ex_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
