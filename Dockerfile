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

# Development: install devDependencies and run nodemon.
FROM base AS dev
RUN npm ci
COPY . .
CMD ["npx", "nodemon", "src/app.js"]

# React SPA build used by the production Express server at /app.
FROM base AS frontend-build
COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend ci
COPY frontend ./frontend
RUN npm --prefix frontend run build

# Production: install only runtime dependencies and copy deterministic frontend assets.
FROM base AS prod
RUN npm ci --omit=dev
COPY . .
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
RUN rm -rf /app/frontend/node_modules
RUN mkdir -p /app/dados/docs && mkdir -p /app/dados/report-img/logos
RUN chown -R pptruser:pptruser /app
USER pptruser
EXPOSE 3000
CMD ["node", "src/app.js"]
