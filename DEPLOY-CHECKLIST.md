# 🚀 Checklist de Deploy em Produção — VextromPlatform

Runbook passo a passo para subir a plataforma em produção (Docker + Nginx + Let's Encrypt).
Gerado em 2026-07-17. Execute os passos **em ordem**. Não pule a verificação pós-deploy.

> Convenção: comandos rodam **no servidor de produção** (Linux), a partir da raiz do projeto,
> salvo indicação de que é local (Windows).

---

## 0. Pré-requisitos

- [ ] Servidor Linux com **Docker** e **Docker Compose v2** (`docker compose version`).
- [ ] **DNS** do domínio apontando para o IP público do servidor (registro A). Confirme:
      `dig +short SEU_DOMINIO` deve retornar o IP do servidor.
- [ ] Portas **80** e **443** liberadas no firewall/security group.
- [ ] Acesso ao repositório e à branch de deploy (`docker`).

---

## 1. Código: commitar e ir para a branch de deploy

> A branch de deploy é **`docker`**. O trabalho recente está em `feat/react-spa-fase-0`.
> ⚠️ Existem mudanças de **várias frentes** no working tree — revise o diff antes de commitar
> e **não misture** trabalho não testado no release.

- [ ] Revisar o que vai entrar: `git status` e `git diff`.
- [ ] Commitar o que for do release e mergear na branch de deploy:
      ```bash
      git checkout feat/react-spa-fase-0
      git add -A            # ou seletivo, conforme revisão
      git commit -m "feat: Auditor SentinelGrid + formato OM-XXXXX-YY + hardening OWASP"
      git checkout docker
      git merge --no-ff feat/react-spa-fase-0
      git push origin docker
      ```
- [ ] No servidor: `git fetch && git checkout docker && git pull`.

---

## 2. Gerar os segredos

Gere valores fortes e **únicos** (não reutilize entre ambientes).

**Linux / Git Bash:**
```bash
openssl rand -hex 16   # POSTGRES_PASSWORD
openssl rand -hex 32   # ADMIN_SESSION_SECRET
openssl rand -hex 32   # API_KEY_PEPPER
openssl rand -hex 24   # MINIO_ROOT_PASSWORD (= S3_SECRET_ACCESS_KEY)
openssl rand -hex 12   # PGADMIN_PASSWORD (ou senha forte à sua escolha)
```

**PowerShell (Windows), equivalente a `openssl rand -hex N` bytes → 2N chars:**
```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })   # 32 bytes
```

- [ ] `ADMIN_PASS`: escolha uma **senha forte** (não é gerada acima; é a senha de login do admin).

---

## 3. Preencher o `.env.prod`

Edite `.env.prod` (arquivo **local**, fora do git). Substitua **todos** os `TROQUE_..._AQUI`
e os placeholders de domínio.

| Variável | O que colocar |
|---|---|
| `DOMAIN` | seu domínio, ex.: `plataforma.suaempresa.com` (sem `https://`) |
| `CERTBOT_EMAIL` | e-mail real (avisos de expiração do certificado) |
| `CERTBOT_STAGING` | `1` para o 1º teste (não gasta rate-limit do LE); `0` para valer |
| `APP_BASE_URL` | `https://SEU_DOMINIO` (usado em links de e-mail/PDF) |
| `POSTGRES_PASSWORD` | segredo gerado — **deve ser idêntico** ao embutido em TODAS as `*_DATABASE_URL` |
| `DATABASE_URL` / `SPECFLOW_/REPORT_SERVICE_/CONFIG_/MODULE_SPEC_DATABASE_URL` | trocar `TROQUE_SENHA_FORTE_AQUI` pela **mesma** `POSTGRES_PASSWORD` |
| `ADMIN_USER` / `ADMIN_PASS` | usuário e senha forte do admin |
| `ADMIN_SESSION_SECRET` | segredo gerado (32 bytes) |
| `API_KEY_PEPPER` | segredo gerado (32 bytes) |
| `MINIO_ROOT_PASSWORD` **e** `S3_SECRET_ACCESS_KEY` | mesmo segredo (têm de bater) |
| `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` | credenciais do pgAdmin |
| `SMTP_*` | preencher **se** for usar envio de e-mail/OS (senão o envio falha) |
| `ANTHROPIC_API_KEY` (ou `OPENAI_*`) | preencher **se** for usar tradução/revisão por IA |

- [ ] Nenhum `TROQUE_..._AQUI` restante: `grep -n "TROQUE_" .env.prod` deve não retornar nada.
- [ ] `POSTGRES_PASSWORD` bate com as URLs: `grep -c "SUA_SENHA_PG" .env.prod` (confira a contagem).
- [ ] `.env.prod` **não** é versionado (confirme: `git check-ignore .env.prod` deve imprimir `.env.prod`).

---

## 4. Decidir o SentinelGrid (onde está o Auditor e o formato OM-XXXXX-YY)

O módulo **SentinelGrid** está marcado `in_development` e vem **desligado por padrão**.
Todo o trabalho recente (Auditor, numeração `OM-XXXXX-YY`) só aparece se ele estiver ligado.

- [ ] **Se for levar o SentinelGrid a produção**, adicione ao `.env.prod`:
      ```
      SENTINELGRID_ENABLED=true
      ```
      (As migrations do módulo rodam **automaticamente no boot** — nada manual.)
      Ciente de que é um módulo ainda em desenvolvimento.
- [ ] Se **não** for, deixe sem a variável (fica desligado) — o resto da plataforma sobe normal.

---

## 5. Primeira emissão do certificado TLS (só na 1ª vez)

```bash
docker compose -f docker-compose.certbot-init.yml --env-file .env.prod up
```
- [ ] Aguarde **"Certificado emitido com sucesso!"** e pressione **Ctrl+C**.
- [ ] Dica: rode primeiro com `CERTBOT_STAGING=1` para validar o fluxo; depois troque para `0`
      e repita para emitir o certificado real.

---

## 6. Subir o stack de produção

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
- [ ] Acompanhar o boot (migrations rodam aqui — são idempotentes):
      ```bash
      docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f app
      ```
      Espere ver o servidor escutando e **sem** "Startup failed".
- [ ] Conferir que todos os serviços estão `Up`:
      ```bash
      docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod ps
      ```

---

## 7. Verificação pós-deploy (não pule)

- [ ] **HTTP → HTTPS**: `curl -I http://SEU_DOMINIO` retorna 301/302 para `https://`.
- [ ] **Login público responde**: `curl -I https://SEU_DOMINIO/admin/login` → `200`.
- [ ] **Headers de segurança** presentes:
      ```bash
      curl -sI https://SEU_DOMINIO/admin/login | grep -iE "content-security-policy|strict-transport|x-frame-options"
      ```
      Deve ter `Strict-Transport-Security` (HSTS só aparece em HTTPS), `X-Frame-Options: DENY` e CSP.
- [ ] **Certificado válido** no browser (cadeado, sem aviso).
- [ ] **Login** no `/admin/login` com `ADMIN_USER`/`ADMIN_PASS`.
- [ ] **SPA carrega**: acesse `/app`; abra o **console do navegador** e confira que não há erro de
      *"Refused to … Content Security Policy"* (a CSP estrita do SPA foi aplicada no hardening).
- [ ] Se SentinelGrid ligado: abrir **Auditor** e uma OM nova (deve sair como `OM-00001-26`…).

---

## 8. Backup e rollback

- [ ] **Antes** de qualquer deploy futuro sobre dados existentes, faça backup:
      ```bash
      docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod exec app npm run db:backup:all
      docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod exec app npm run assets:backup
      ```
- [ ] **Rollback** de código: `git checkout <commit_anterior>` na branch `docker` e refazer o passo 6.
      Restore de banco: `npm run db:restore:<modulo>` (ver `README.md`).

---

## 9. Ferramentas de administração (opcional)

Portainer + pgAdmin (acesso restrito a `127.0.0.1` no compose de prod — use túnel SSH):
```bash
docker compose -f docker-compose.admin.yml up -d
```

---

## ⚠️ Pendência de segurança conhecida (não bloqueia o deploy)

A CSP **global** (telas legadas EJS) ainda usa `'unsafe-inline'` em scripts. O SPA React (`/app`)
já roda com CSP estrita. Fechar a brecha do EJS exige migrar os scripts inline para `nonce`
(tela por tela, com teste) — planejado, não é blocker. Ver `memory/blindagem-owasp-plataforma.md`.

---

### Resumo dos blockers (têm de estar ✅ antes de ir ao ar)
1. [ ] `.env.prod` sem nenhum `TROQUE_..._AQUI`, com `DOMAIN`/`APP_BASE_URL` reais.
2. [ ] Código commitado e mergeado na branch `docker`.
3. [ ] Decisão sobre `SENTINELGRID_ENABLED` tomada.
4. [ ] Certificado TLS emitido (passo 5) e verificação pós-deploy (passo 7) OK.
