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
docker-compose.staging.yml       → overrides de staging (teste no servidor, sem SSL)
docker-compose.staging-https.yml → overrides de staging com HTTPS e cert auto-assinado
docker-compose.prod.yml          → overrides de produção
docker-compose.certbot-init.yml  → emissão inicial do certificado SSL (uso único)
docker-compose.portainer.yml     → Portainer CE (gerenciamento visual de containers)
Dockerfile                       → multi-stage: target dev | target prod
.env                             → variáveis de desenvolvimento local
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

O ambiente de staging roda a **imagem de produção** (`target: prod`) diretamente na porta `8080`, sem Nginx nem SSL.
Isso permite validar a build e as regras de negócio no servidor real antes de liberar o tráfego em produção.

Os dados ficam **completamente isolados** da produção — volumes separados via `--project-name vextrom-staging`.

### 1. Configurar o .env.staging

```bash
nano .env.staging
```

Ajuste apenas estes campos:

| Variável | O que colocar |
|---|---|
| `APP_BASE_URL` | `http://IP-DO-SERVIDOR` |
| `POSTGRES_PASSWORD` | Qualquer senha (só para staging) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Chave real se quiser testar IA, senão deixe vazio |

> SMTP fica desabilitado no `.env.staging` por padrão para não disparar e-mails reais.

### 2. Subir o staging

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  up -d --build
```

### 3. Rodar as migrations

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  exec app npm run db:migrate
```

### 4. Verificar status

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  ps
```

Acesse: `http://IP-DO-SERVIDOR`

> Certifique-se de que a porta **80** está liberada no firewall do servidor.
> ```bash
> # Ubuntu/Debian com ufw
> ufw allow 80/tcp
> ```

### 5. Ver logs do staging

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  logs -f app
```

### 6. Derrubar o staging após validação

```bash
# Para os containers e remove os volumes de staging
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  -p vextrom-staging \
  down -v
```

> O `-v` remove apenas os volumes do projeto `vextrom-staging`. Os volumes de produção não são afetados.

### Staging com HTTPS (certificado auto-assinado)

Testa o stack completo com Nginx e HTTPS antes de emitir o certificado real.
O certificado é gerado automaticamente pelo próprio compose — não requer script externo nem OpenSSL instalado localmente.
Funciona com IP ou domínio.

**Passo 1 — Definir `DOMAIN` no `.env.staging`:**

```bash
# Adicione ou edite no .env.staging
DOMAIN=192.168.1.100
APP_BASE_URL=https://192.168.1.100
```

**Passo 2 — Subir o stack:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging-https.yml \
  --env-file .env.staging \
  -p vextrom-staging-https \
  up -d --build
```

Na primeira execução, o serviço `cert-gen` gera o certificado automaticamente antes do Nginx subir.
Nas execuções seguintes, o certificado já existe e o `cert-gen` encerra imediatamente.

**Passo 3 — Rodar migrations:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.staging-https.yml \
  --env-file .env.staging \
  -p vextrom-staging-https \
  exec app npm run db:migrate
```

Acesse: `https://192.168.1.100`

> O navegador vai exibir aviso de certificado não confiável — clique em **Avançar** ou **Continuar assim mesmo**. Isso é esperado com cert auto-assinado.

**Derrubar:**

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

Copie o template e edite com os valores reais:

```bash
cp .env.prod .env.prod.local  # opcional — mantenha o template limpo
```

Edite `.env.prod` preenchendo **todos** os campos marcados com `TROQUE_`:

```bash
nano .env.prod
```

Campos obrigatórios antes de continuar:

| Variável | Descrição | Como gerar |
|---|---|---|
| `DOMAIN` | Domínio do servidor | ex: `app.vextrom.com.br` |
| `CERTBOT_EMAIL` | E-mail para avisos SSL | ex: `admin@vextrom.com.br` |
| `POSTGRES_PASSWORD` | Senha do banco | `openssl rand -hex 16` |
| `ADMIN_SESSION_SECRET` | Segredo das sessões admin | `openssl rand -hex 32` |
| `API_KEY_PEPPER` | Pepper das API keys | `openssl rand -hex 32` |
| `ADMIN_PASS` | Senha do usuário admin | Senha forte manual |
| `APP_BASE_URL` | URL pública da aplicação | `https://seu-dominio.com` |

> **Atenção:** `POSTGRES_PASSWORD` deve ser idêntico no campo `POSTGRES_PASSWORD=` e embutido em todas as `DATABASE_URL` do arquivo.

### 4. Testar o certificado SSL (recomendado)

Antes de usar o Let's Encrypt real, valide o fluxo com o ambiente de staging (sem consumir o rate-limit):

```bash
# No .env.prod, defina temporariamente:
CERTBOT_STAGING=1
```

```bash
docker compose -f docker-compose.certbot-init.yml --env-file .env.prod up
```

Aguarde a mensagem `Certificado emitido com sucesso!` e pressione **Ctrl+C**.

### 5. Emitir o certificado real

Mude para produção no `.env.prod`:

```
CERTBOT_STAGING=0
```

Remova os volumes de staging e emita o certificado real:

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

---

## Portainer — gerenciamento visual de containers

Interface web para gerenciar todos os containers, logs, volumes e imagens do servidor.

### Subir o Portainer

```bash
docker compose -f docker-compose.portainer.yml -p portainer up -d
```

Acesse: `https://IP-DO-SERVIDOR:9443`

Na primeira abertura crie o usuário admin. O Portainer detecta automaticamente todos os containers rodando no servidor.

### Segurança — restringir acesso por IP

```bash
# Libera a porta 9443 apenas para o seu IP (substitua pelo IP real)
ufw allow from SEU-IP to any port 9443
# Bloqueia acesso público
ufw deny 9443
```

### Derrubar o Portainer

```bash
docker compose -f docker-compose.portainer.yml -p portainer down
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

Após renovar, recarregue o Nginx para aplicar os novos certificados:

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

---

## Serviços e portas

| Serviço | Porta interna | Porta exposta (prod) |
|---|---|---|
| app (Node.js) | 3000 | — (somente via Nginx) |
| nginx | 80, 443 | 80, 443 |
| postgres | 5432 | — |
| redis | 6379 | — |
| certbot | — | — |
