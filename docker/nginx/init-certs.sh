#!/bin/sh
# Emite o primeiro certificado Let's Encrypt via desafio webroot.
# Pré-requisito: nginx-bootstrap precisa estar rodando (expondo :80).
#
# Variáveis lidas do ambiente (definidas em .env.prod):
#   DOMAIN          — domínio a certificar            ex: app.vextrom.com.br
#   CERTBOT_EMAIL   — e-mail para avisos de renovação  ex: admin@vextrom.com.br
#   CERTBOT_STAGING — "1" para testes (sem rate-limit), "0" para produção real
set -e

: "${DOMAIN:?Defina DOMAIN no .env.prod}"
: "${CERTBOT_EMAIL:?Defina CERTBOT_EMAIL no .env.prod}"
CERTBOT_STAGING="${CERTBOT_STAGING:-0}"

STAGING_FLAG=""
[ "$CERTBOT_STAGING" = "1" ] && STAGING_FLAG="--staging"

echo ""
echo "==> Aguardando nginx-bootstrap ficar pronto..."
sleep 3

echo "==> Emitindo certificado para ${DOMAIN}..."
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "${CERTBOT_EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  ${STAGING_FLAG} \
  -d "${DOMAIN}"

echo ""
echo "==> Certificado emitido com sucesso!"
echo "==> Agora suba o stack de produção completo:"
echo ""
echo "    docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d"
echo ""
