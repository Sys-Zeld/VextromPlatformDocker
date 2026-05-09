# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VextromPlatform** is a Node.js/Express application for managing dynamic technical forms, service orders, and equipment specifications. It is a multi-module monorepo where each module owns its own database, routes, and services.

## Common Commands

### Development

```bash
npm run dev          # Start with hot-reload (nodemon)
npm run start        # Production start
```

### Docker

```bash
# Development (with hot-reload volume mount)
docker compose up --build
docker compose logs -f app

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d

# Staging (HTTP)
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging -p vextrom-staging up -d

# Admin tools (Portainer + pgAdmin)
docker compose -f docker-compose.admin.yml up -d
```

### Database Migrations

```bash
npm run db:migrate                  # Run all migrations (SpecFlow → ConfigDB → ReportService → ModuleSpec)
npm run db:migrate:specflow
npm run db:migrate:report-service
npm run db:migrate:config
npm run db:migrate:module-spec
npm run db:seed                     # Populate test data
npm run db:reset                    # Drop and recreate schemas
```

### Testing

```bash
npm run test:module-spec            # Unit tests for module_spec only
npm run stress:specflow             # Load test SpecFlow
npm run stress:module-spec          # Load test ModuleSpec
npm run stress:report-service       # Load test ReportService
```

### Module Toggles (runtime enable/disable)

```bash
npm run modules:enable:all
npm run report-service:enable       # or :disable
npm run module-spec:enable          # or :disable
```

### API Key Management

```bash
npm run api:key:create -- --name "..." --scopes "fields:read,report-service:write" --ttl-days 90
npm run api:key:list
npm run api:key:revoke -- <ID>
npm run api:key:delete -- <ID>
```

### Admin Operations

```bash
npm run admin:sessions:clear
npm run admin:auth:reset
npm run db:backup:all               # or :specflow / :report-service / :config / :module-spec
npm run db:restore:specflow         # and similar per-module
npm run assets:backup / :restore
```

## Architecture

### Entry Point & Initialization

`src/app.js` → calls `initializeSpecflow()` → `specflow/app.js`

`specflow/app.js` is the central Express setup: it registers all global middleware (Helmet CSP, CSRF, session/admin auth, i18n, themes) and mounts every sub-module's router. This is where to add new routes or middleware.

### Four Core Modules

Each module is self-contained with its own DB client, migrations, services, routes, and (where applicable) EJS views.

| Module | Path | Database | Routes |
|---|---|---|---|
| **SpecFlow** | `specflow/` | `dbspeflow` | `/admin`, `/api/specflow`, public forms |
| **Report Service** | `report_service/src/` | `reportservice` | `/api/report-service`, `/admin/report-service`, `/r` (public token signing) |
| **Module Spec** | `module_spec/src/` | `dbmodulespec` | `/api/module-spec` (in development, disabled by default) |
| **ConfigDB** | `configdb/` | `configdb` | shared (admin users, sessions, preferences) |

**SpecFlow** is the hub. It bootstraps all other modules and manages the shared authentication layer.

**Report Service** handles the full lifecycle of service orders (OS): creation, field data collection, PDF generation (via Puppeteer or Playwright), digital signatures with public token URLs, email dispatch, and analytics.

**Module Spec** is a simple equipment filter module — no ML/ranking. It matches equipment variants to profile attribute mappings via strict operators (`equals`, `contains`, `gte`, `lte`).

**ConfigDB** manages admin users, UI preferences, and session state. Session state is persisted both as browser cookies and as `dados/admin-session-state.json`.

### Database Isolation

Each module resolves its own database connection. The primary env vars are:

- `SPECFLOW_DATABASE_URL`
- `REPORT_SERVICE_DATABASE_URL`
- `CONFIG_DATABASE_URL`
- `MODULE_SPEC_DATABASE_URL`

Backup/restore enforces per-module table signature validation — a backup from one module cannot be restored into another.

### Authentication & API Keys

- **Admin panel:** Cookie-based session authenticated against `configdb.admin_users`. Session state is also mirrored to `dados/admin-session-state.json`.
- **API access:** Scoped API keys (`fields:read`, `spec:read`, `report-service:read`, `report-service:write`). Managed via `npm run api:key:*` scripts.
- **Public report signing:** Hash-based token in URL, no login required.

### File Storage

Controlled by `STORAGE_DRIVER` env var:
- `local` — files written to `./dados/docs/`
- `s3` — MinIO or S3 (configured via `S3_ENDPOINT`, `S3_BUCKET`, credentials). Local `./dados/` acts as cache.

### PDF Rendering

Configured via `REPORT_PDF_RENDERER`. In development, a dedicated `puppeteer` Docker container runs on port 4000 (`PUPPETEER_SERVER_URL`). Reports use a custom tag system parsed in `report_service/src/services/reportPreviewService.js`: `@img`, `@equip`, `@timesheet`, `@tblcmpr`, etc.

### AI Integration

Used for report translation/review. Provider selected via `AI_PROVIDER` env var (`openai` or `anthropic`). Models configured separately via `OPENAI_MODEL` / `ANTHROPIC_MODEL`.

### i18n

Three languages: PT (default), EN, ES. Language selection is stored in session. Templates are in `specflow/views/` (EJS) and `report_service/templates/`.

## Key Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `APP_BASE_URL` | Used for absolute URLs in emails and PDFs |
| `ADMIN_USER` / `ADMIN_PASS` | Admin login credentials |
| `ADMIN_SESSION_SECRET` | Cookie signing secret |
| `STORAGE_DRIVER` | `local` or `s3` |
| `REPORT_PDF_RENDERER` | `puppeteer` (only supported renderer) |
| `AI_PROVIDER` | `openai` or `anthropic` |
| `MODULE_SPEC_ENABLED` | `true` / `false` (module is in development) |

## Docker Services

In development (`docker-compose.override.yml`), exposed ports:

| Service | Port |
|---|---|
| App | 3000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| Puppeteer | 4000 |

Production adds Nginx (80/443) with Let's Encrypt via Certbot.

## Module Spec Development Notes

`module_spec/` is under active development and disabled by default. It has its own unit test suite (`npm run test:module-spec`) and examples under `module_spec/examples/`. See `module_spec/migrations/README.md` for the full REST API spec and filter payload format.
