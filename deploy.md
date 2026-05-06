# Deploy — VextromPlatform

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Docker Engine | 24+ |
| Docker Compose | v2.20+ |
| DNS do domínio | Apontando para o IP do servidor |

---

## Estrutura de arquivos

```
docker-compose.yml               → base compartilhado (dev + prod + staging)
docker-compose.override.yml      → overrides de desenvolvimento (carregado automaticamente)
docker-compose.staging.yml       → staging HTTP (porta 80, sem SSL)
docker-compose.staging-https.yml → staging HTTPS com certificado auto-assinado
docker-compose.prod.yml          → produção (Nginx + Let's Encrypt + restart)
docker-compose.admin.yml         → stack de administração independente (Portainer + pgAdmin)
docker-compose.certbot-init.yml  → emissão inicial do certificado SSL (uso único)
docker-compose.portainer.yml     → Portainer CE standalone (staging/testes locais)
Dockerfile                       → multi-stage: target dev | target prod
.env                             → variáveis de desenvolvimento local
.env.staging                     → variáveis de staging (não commitar)
.env.prod                        → variáveis de produção (não commitar)
docker/nginx/templates/          → config Nginx (HTTPS + proxy)
docker/nginx/bootstrap.conf      → config HTTP temporária para emissão do cert
docker/nginx/init-certs.sh       → script de emissão do cert via certbot
```

---

## Desenvolvimento

### Rodando localmente sem Docker

Requer PostgreSQL e Redis rodando localmente.

```bash
npm install
npm run db:migrate
npm run dev
```

Acesse: http://localhost:3000

### Rodando com Docker (dev)

O `docker-compose.override.yml` é carregado automaticamente.
O código é montado como volume — salvar um arquivo reinicia o servidor via nodemon.

```bash
# Primeira vez
docker compose up --build

# Execuções seguintes
docker compose up

# Rodar migrations dentro do container
docker compose exec app npm run db:migrate

# Ver logs
docker compose logs -f app
```

Acesse: http://localhost:3000

As portas do PostgreSQL (5432) e Redis (6379) ficam expostas para ferramentas locais (DBeaver, Redis Insight, etc).

---

## Staging (teste no servidor antes da produção)

O ambiente de staging roda a **imagem de produção** (`target: prod`) isolada da produção via `--project-name`.

### Staging HTTP (porta 80)

Teste rápido sem SSL — ideal para validar regras de negócio e migrations.

**1. Configurar `.env.staging`:**

| Variável | O que colocar |
|---|---|
| `APP_BASE_URL` | `http://IP-DO-SERVIDOR` |
| `POSTGRES_PASSWORD` | Qualquer senha (só para staging) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Chave real se quiser testar IA |

> SMTP fica desabilitado no `.env.staging` por padrão para não disparar e-mails reais.

**2. Subir:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  up -d --build
```

**3. Migrations:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  exec app npm run db:migrate
```

**4. Logs:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  logs -f app
```

Acesse: `http://IP-DO-SERVIDOR`

> Libere a porta 80 no firewall: `ufw allow 80/tcp`

**5. Derrubar:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  down -v
```

---

### Staging HTTPS (certificado auto-assinado)

Testa o stack completo com Nginx e HTTPS.
O certificado é gerado automaticamente — nenhum script externo ou OpenSSL local é necessário.

**1. Adicionar ao `.env.staging`:**

```bash
DOMAIN=192.168.1.100
APP_BASE_URL=https://192.168.1.100
```

**2. Subir:**

```bash
docker compose \
  -f docker-compose.yml \
    -f docker-compose.staging-https.yml \
      --env-file .env.staging \
        -p vextrom-staging-https \
          up -d --build
```

Na primeira execução o serviço `cert-gen` gera o certificado automaticamente antes do Nginx subir.

**3. Migrations:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging-https.yml \
  --env-file .env.staging \
  -p vextrom-staging-https \
  exec app npm run db:migrate
```

Acesse: `https://IP-DO-SERVIDOR`

> O navegador exibirá aviso de certificado não confiável — clique em **Avançar**. Esperado com cert auto-assinado.

**4. Derrubar:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging-https.yml \
  --env-file .env.staging \
  -p vextrom-staging-https \
  down -v
```

---

### Checklist de validação no staging

Antes de liberar para produção, verifique:

- [ ] Login admin funciona
- [ ] Criação e edição de equipamentos
- [ ] Upload e download de documentos
- [ ] Geração de PDF
- [ ] Módulo Report Service (ordens de serviço)
- [ ] Links públicos de token
- [ ] Backup e restore de banco (`npm run db:backup:all`)
- [ ] Logs sem erros críticos (`logs -f app`)

---

## Produção

### 1. Preparar o servidor

```bash
# Instalar Docker Engine
curl -fsSL https://get.docker.com | sh

# Adicionar usuário ao grupo docker (evita sudo)
usermod -aG docker $USER
newgrp docker
```

**Criar a rede compartilhada entre stacks (apenas uma vez):**

```bash
docker network create vextrom_net
```

> Esta rede permite que o pgAdmin da stack de administração alcance o PostgreSQL da stack de produção.

### 2. Enviar o código

```bash
# No servidor, clone o repositório
git clone <url-do-repositorio> /opt/vextrom
cd /opt/vextrom
```

Ou via rsync a partir da máquina local:

```bash
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dados' \
  ./ usuario@servidor:/opt/vextrom/
```

### 3. Configurar variáveis de produção

```bash
nano .env.prod
```

Campos obrigatórios:

| Variável | Descrição | Como gerar |
|---|---|---|
| `DOMAIN` | Domínio do servidor | ex: `app.vextrom.com.br` |
| `CERTBOT_EMAIL` | E-mail para avisos SSL | ex: `admin@vextrom.com.br` |
| `POSTGRES_PASSWORD` | Senha do banco | `openssl rand -hex 16` |
| `ADMIN_SESSION_SECRET` | Segredo das sessões admin | `openssl rand -hex 32` |
| `API_KEY_PEPPER` | Pepper das API keys | `openssl rand -hex 32` |
| `ADMIN_PASS` | Senha do usuário admin | Senha forte manual |
| `APP_BASE_URL` | URL pública da aplicação | `https://seu-dominio.com` |

> **Atenção:** `POSTGRES_PASSWORD` deve ser idêntico no campo `POSTGRES_PASSWORD=` e em todas as `DATABASE_URL` do arquivo.

### 4. Testar certificado SSL (staging Let's Encrypt)

```bash
# No .env.prod, defina temporariamente:
CERTBOT_STAGING=1
```

```bash
docker compose -f docker-compose.certbot-init.yml --env-file .env.prod up
```

Aguarde `Certificado emitido com sucesso!` → **Ctrl+C**.

### 5. Emitir o certificado real

```bash
# No .env.prod:
CERTBOT_STAGING=0
```

```bash
docker volume rm vextrom_certbot_certs vextrom_certbot_www

docker compose -f docker-compose.certbot-init.yml --env-file .env.prod up
```

Aguarde `Certificado emitido com sucesso!` → **Ctrl+C**.

### 6. Subir o stack completo

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  up -d --build
```

### 7. Rodar as migrations

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec app npm run db:migrate
```

### 8. Verificar saúde dos serviços

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  ps
```

Todos os serviços devem aparecer com status `running (healthy)`.

Acesse: https://seu-dominio.com

### 9. Subir a stack de administração

Portainer e pgAdmin rodam em **stack separada** da aplicação. Isso garante que as ferramentas de administração continuem no ar durante redeploys da aplicação.

```bash
docker compose \
  -f docker-compose.admin.yml \
  --env-file .env.prod \
  -p vextrom_admin \
  up -d
```

Acesso sempre via **SSH tunnel** (sem porta exposta no firewall):

| Ferramenta | Tunnel | URL local |
|---|---|---|
| Portainer | `ssh -L 9443:localhost:9443 user@servidor` | `https://localhost:9443` |
| pgAdmin | `ssh -L 8184:localhost:8184 user@servidor` | `http://localhost:8184` |

Crie o usuário admin do Portainer na primeira abertura.

---

## Stack de administração (Portainer + pgAdmin)

A stack de administração é **independente da stack da aplicação** — gerenciada pelo arquivo `docker-compose.admin.yml` com projeto `vextrom_admin`.

### Subir

```bash
docker compose \
  -f docker-compose.admin.yml \
  --env-file .env.prod \
  -p vextrom_admin \
  up -d
```

### Derrubar

```bash
docker compose \
  -f docker-compose.admin.yml \
  -p vextrom_admin \
  down
```

### Atualizar Portainer ou pgAdmin

```bash
docker compose \
  -f docker-compose.admin.yml \
  --env-file .env.prod \
  -p vextrom_admin \
  pull

docker compose \
  -f docker-compose.admin.yml \
  --env-file .env.prod \
  -p vextrom_admin \
  up -d
```

### Resetar o Portainer (recriar senha admin)

```bash
docker compose -f docker-compose.admin.yml -p vextrom_admin stop portainer
docker volume rm vextrom_portainer_data
docker compose -f docker-compose.admin.yml --env-file .env.prod -p vextrom_admin up -d portainer
```

---

## pgAdmin 4 — administração do banco de dados

O pgAdmin 4 roda na stack de administração, acessível **somente via SSH tunnel**:

```bash
ssh -L 8184:localhost:8184 user@servidor
```

Acesse: `http://localhost:8184`

O servidor PostgreSQL do projeto é pré-configurado via `docker/pgadmin/servers.json`.

### Primeiro acesso

1. Abra `http://localhost:8184`
2. Faça login com as credenciais `PGADMIN_EMAIL` e `PGADMIN_PASSWORD` do `.env.prod`
3. No painel esquerdo, clique em **VextromPlatform → PostgreSQL**
4. Digite a senha do PostgreSQL (`POSTGRES_PASSWORD`) — o pgAdmin armazena para as próximas sessões
5. Explore os bancos: `dbspeflow`, `reportservice`, `configdb`, `dbmodulespec`

### Bancos disponíveis

| Banco | Uso |
|---|---|
| `dbspeflow` | Dados principais (equipamentos, campos, tokens) |
| `reportservice` | Ordens de serviço |
| `configdb` | Usuários admin, backups |
| `dbmodulespec` | Módulo de especificação (opcional) |

### Configurar credenciais do pgAdmin

No `.env.prod`, preencha antes de subir a stack de admin:

```
PGADMIN_EMAIL=admin@seu-dominio.com
PGADMIN_PASSWORD=senha-forte-aqui
```

---

## Portainer — gerenciamento visual de containers

O Portainer CE roda na stack de administração, acessível **somente via SSH tunnel**:

```bash
ssh -L 9443:localhost:9443 user@servidor
```

Acesse: `https://localhost:9443`

### O que você pode fazer no Portainer

| Ação | Onde encontrar |
|---|---|
| Ver status de todos os containers | Home → Containers |
| Iniciar / parar / reiniciar um container | Containers → ações |
| Ver logs em tempo real | Containers → nome do container → Logs |
| Acessar o terminal do container | Containers → nome → Console |
| Gerenciar volumes e dados | Volumes |
| Ver e remover imagens | Images |
| Subir um novo stack Docker Compose | Stacks → Add stack |
| Inspecionar variáveis de ambiente | Containers → Inspect |

### Arquitetura de rede em produção

```
Internet
   │
   ▼
Nginx :443  ──►  app:3000  (somente via Nginx, sem porta exposta)

SSH Tunnel
   │
   ▼
localhost:9443  ──►  portainer:9443  (somente local)
localhost:8184  ──►  pgadmin:80      (somente local)
```

Apenas o Nginx escuta nas portas 80 e 443 no host. Portainer e pgAdmin não têm portas acessíveis externamente.

---

## Cockpit — gerenciamento do servidor

O Cockpit é instalado **diretamente no host** (AlmaLinux) e roda somente em localhost.

### Instalação (AlmaLinux)

```bash
dnf install -y cockpit
systemctl enable --now cockpit.socket
```

**Restringir para somente localhost** (sem acesso externo):

```bash
mkdir -p /etc/systemd/system/cockpit.socket.d
cat > /etc/systemd/system/cockpit.socket.d/listen.conf << 'EOF'
[Socket]
ListenStream=
ListenStream=127.0.0.1:9090
EOF
systemctl daemon-reload
systemctl restart cockpit.socket
```

> Não é necessário abrir nenhuma porta no `firewalld`.

### Acesso

```bash
ssh -L 9090:localhost:9090 user@servidor
```

Acesse: `http://localhost:9090` — logue com o usuário root do servidor.

---

## Operações do dia a dia

### Ver logs

```bash
# Todos os serviços
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f

# Só o app
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f app

# Nginx (acessos e erros)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f nginx
```

### Deploy de nova versão

```bash
git pull

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  up -d --build

# Rodar migrations se houver alterações no banco
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec app npm run db:migrate
```

### Invalidar sessões admin

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec app node scripts/clear-admin-sessions.js
```

### Backup dos bancos

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec app npm run db:backup:all
```

Os backups ficam salvos no volume `dados_volume` em `/app/dados/`.

### Backup e restore de assets (via UI)

A UI de manutenção suporta upload de até **200 MB** (limite do Nginx).

Acesse: `https://seu-dominio.com/admin/maintenance/system` → **Backup e restore de Assets**

O ZIP inclui:
- `dados/docs` — documentos anexados aos equipamentos
- `dados/service-report-pdfs` — PDFs de ordens de serviço
- `dados/service-report-html` — HTMLs de ordens de serviço
- `dados/report-img` — imagens e logos dos relatórios

### Restore de assets acima de 200 MB (via SCP)

Para arquivos maiores que 200 MB, envie diretamente ao servidor via SCP e restaure pela linha de comando, bypassing o Nginx.

**1. Enviar o ZIP da máquina local para o servidor:**

```bash
scp assets-backup-ARQUIVO.zip user@servidor:/opt/vextrom/dados/backups/
```

**2. Restaurar:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec app node scripts/restore-assets.js \
  --file=/app/dados/backups/assets-backup-ARQUIVO.zip
```

> O script aceita backups antigos (com `docs/report/img/`) e remapeia automaticamente para `dados/report-img/`.

### Acessar o banco via psql

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec postgres psql -U postgres -d dbspeflow
```

### Acessar o Redis

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec redis redis-cli
```

---

## Renovação do certificado SSL

O serviço `certbot` verifica e renova automaticamente a cada 12 horas.
A renovação efetiva só ocorre quando restam menos de 30 dias para o vencimento.

Para forçar uma renovação manual:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec certbot certbot renew --force-renewal
```

Após renovar, recarregue o Nginx:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  exec nginx nginx -s reload
```

---

## Parar e reiniciar

```bash
# Parar sem remover dados
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod stop

# Reiniciar
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod start

# Remover containers (volumes de dados são preservados)
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod down
```

> **Atenção:** `docker compose down -v` remove os volumes de dados (banco, Redis, certificados). Use com cuidado.

---

## Volumes persistentes

### Stack da aplicação (`docker-compose.prod.yml`)

| Volume | Conteúdo |
|---|---|
| `postgres_data` | Dados do PostgreSQL |
| `redis_data` | Dados do Redis (AOF) |
| `dados_volume` | Documentos, backups, arquivos de usuário e imagens de relatórios (`dados/report-img/`) |
| `vextrom_certbot_www` | Desafios ACME (webroot) |
| `vextrom_certbot_certs` | Certificados Let's Encrypt |

### Stack de administração (`docker-compose.admin.yml`)

| Volume | Conteúdo |
|---|---|
| `vextrom_portainer_data` | Configuração e dados do Portainer |
| `vextrom_pgadmin_data` | Configuração e sessões do pgAdmin 4 |

---

## Serviços e portas

### Stack da aplicação

| Serviço | Porta interna | Porta exposta (prod) |
|---|---|---|
| app (Node.js) | 3000 | — (somente via Nginx) |
| nginx | 80, 443 | 80, 443 |
| postgres | 5432 | — |
| redis | 6379 | — |
| certbot | — | — |

### Stack de administração

| Serviço | Porta interna | Porta exposta (prod) |
|---|---|---|
| portainer | 9443 | 127.0.0.1:9443 (somente SSH tunnel) |
| pgadmin | 80 | 127.0.0.1:8184 (somente SSH tunnel) |

### Host (AlmaLinux)

| Serviço | Porta |
|---|---|
| Cockpit | 127.0.0.1:9090 (somente SSH tunnel) |
