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
docker-compose.certbot-init.yml  → emissão inicial do certificado SSL (uso único)
docker-compose.portainer.yml     → Portainer CE (gerenciamento visual de containers)
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

### 9. Portainer

O Portainer já sobe junto com o stack de produção (incluído no `docker-compose.prod.yml`).

Acesse: `https://app.vextrom.com.br/serveradm/`

Crie o usuário admin na primeira abertura. Sem portas extras para abrir no firewall.

---

## pgAdmin 4 — administração do banco de dados

O pgAdmin 4 roda **sem porta exposta** e é acessível via Nginx:

```
https://app.vextrom.com.br/admdatabase/
```

Já incluído no `docker-compose.prod.yml` — sobe automaticamente com o stack de produção.
O servidor PostgreSQL do projeto é pré-configurado via `docker/pgadmin/servers.json`.

### Primeiro acesso

1. Acesse `https://app.vextrom.com.br/admdatabase/`
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

### Configurar senha do pgAdmin

No `.env.prod`, preencha antes de subir o stack:

```
PGADMIN_EMAIL=admin@seu-dominio.com
PGADMIN_PASSWORD=senha-forte-aqui
```

### Atualizar o pgAdmin

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  pull pgadmin

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  up -d pgadmin
```

---

## Portainer — gerenciamento visual de containers

O Portainer CE em produção roda **sem porta exposta** e é acessível exclusivamente via Nginx:

```
https://app.vextrom.com.br/serveradm/
```

Já está incluído no `docker-compose.prod.yml` — sobe automaticamente junto com o stack de produção.

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
Nginx :443  ──  /serveradm/  ──►  portainer:9000  (interno, sem porta exposta)
               /             ──►  app:3000         (interno, sem porta exposta)
```

Nenhum outro serviço tem porta exposta no host. Apenas o Nginx escuta nas portas 80 e 443.

### Reiniciar só o Portainer

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  restart portainer
```

### Atualizar o Portainer para versão mais recente

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  pull portainer

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  up -d portainer
```

### Uso standalone (staging ou sem Nginx)

Para rodar o Portainer com porta exposta fora do contexto de produção:

```bash
docker compose -f docker-compose.portainer.yml -p portainer up -d
```

Acesse: `https://IP-DO-SERVIDOR:9443`

```bash
# Restringir acesso por IP
ufw allow from SEU-IP to any port 9443
ufw deny 9443
```

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

| Volume | Conteúdo |
|---|---|
| `postgres_data` | Dados do PostgreSQL |
| `redis_data` | Dados do Redis (AOF) |
| `dados_volume` | Documentos, backups, arquivos de usuário |
| `vextrom_certbot_www` | Desafios ACME (webroot) |
| `vextrom_certbot_certs` | Certificados Let's Encrypt |
| `vextrom_portainer_data` | Configuração e dados do Portainer |
| `vextrom_pgadmin_data` | Configuração e sessões do pgAdmin 4 |

---

## Serviços e portas

| Serviço | Porta interna | Porta exposta (prod) |
|---|---|---|
| app (Node.js) | 3000 | — (somente via Nginx) |
| nginx | 80, 443 | 80, 443 |
| postgres | 5432 | — |
| redis | 6379 | — |
| certbot | — | — |
| portainer | 9000 | — (somente via Nginx) |
| pgadmin | 80 | — (somente via Nginx) |
