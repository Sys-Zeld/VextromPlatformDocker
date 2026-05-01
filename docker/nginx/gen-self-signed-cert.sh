#!/bin/sh
# Gera um certificado auto-assinado para testes HTTPS no staging.
# Os arquivos ficam em docker/nginx/certs/<dominio>/ e são montados no nginx.
#
# Uso (rodar na raiz do projeto):
#   sh docker/nginx/gen-self-signed-cert.sh <dominio-ou-ip>
#
# Exemplos:
#   sh docker/nginx/gen-self-signed-cert.sh 192.168.1.100
#   sh docker/nginx/gen-self-signed-cert.sh staging.vextrom.com.br

set -e

DOMAIN="${1:?Informe o domínio ou IP como argumento. Ex: sh docker/nginx/gen-self-signed-cert.sh 192.168.1.100}"
CERT_DIR="docker/nginx/certs/${DOMAIN}"

mkdir -p "${CERT_DIR}"

# Detecta se o argumento é um IP ou um hostname
IS_IP=$(echo "${DOMAIN}" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)

if [ -n "${IS_IP}" ]; then
  SAN="IP:${DOMAIN}"
else
  SAN="DNS:${DOMAIN}"
fi

openssl req -x509 \
  -nodes \
  -days 365 \
  -newkey rsa:2048 \
  -keyout "${CERT_DIR}/privkey.pem" \
  -out    "${CERT_DIR}/fullchain.pem" \
  -subj   "/C=BR/ST=SP/L=SaoPaulo/O=Vextrom/CN=${DOMAIN}" \
  -addext "subjectAltName=${SAN}"

echo ""
echo "Certificado auto-assinado gerado em: ${CERT_DIR}/"
echo ""
echo "Próximo passo:"
echo "  docker compose -f docker-compose.yml -f docker-compose.staging-https.yml \\"
echo "    --env-file .env.staging -p vextrom-staging-https up -d --build"
echo ""
echo "Acesse: https://${DOMAIN}"
echo "(O navegador vai alertar sobre certificado auto-assinado — clique em 'Avançar' ou 'Continuar')"
