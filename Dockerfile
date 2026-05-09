FROM ghcr.io/puppeteer/puppeteer:24.43.0 AS base
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
     | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
     > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-16 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true \
  REPORT_PDF_RENDERER=puppeteer

# --- desenvolvimento: instala devDependencies (nodemon) e monta código via volume ---
FROM base AS dev
RUN npm ci
COPY . .
CMD ["npx", "nodemon", "src/app.js"]

# --- produção: sem devDependencies, código copiado na imagem ---
FROM base AS prod
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/dados/docs && mkdir -p /app/dados/report-img/logos
RUN chown -R pptruser:pptruser /app
USER pptruser
EXPOSE 3000
CMD ["node", "src/app.js"]
