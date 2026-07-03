# 03 — Integração com a Plataforma (Fase 0)

Detalha os pontos de integração do SentinelGrid com a VextromPlatform. Os itens
marcados **[FEITO NESTA ETAPA]** já foram aplicados como bootstrap visível; os
demais são executados na Fase 0 após aprovação do roadmap.

## 1. Service Hub — card do módulo **[FEITO NESTA ETAPA]**

`renderAdminModuleHubPage` em `specflow/app.js` monta `moduleCards`. Foi
adicionado o card `sentinelgrid`, resolvendo status via `resolveModuleStatus`
(`in_development` → badge amarelo "Em desenvolvimento"):

```js
const sentinelGridStatus = resolveModuleStatus(moduleStatuses.sentinelgrid, "Em desenvolvimento", "warning");
const canAccessSentinelGrid = hasModuleAccess(req.adminRole, req.adminModuleAccess, "sentinelgrid");
// ...
{
  key: "sentinelgrid",
  name: "SentinelGrid",
  description: "Gestao de manutencao de equipamentos criticos de energia (UPS, baterias, BMS).",
  status: sentinelGridStatus.label,
  statusVariant: sentinelGridStatus.variant,
  moduleVersion: String(moduleVersions.sentinelgrid || "0.0.1"),
  href: env.sentinelgridEnabled && canAccessSentinelGrid ? "/app/sentinelgrid" : "",
  cta: env.sentinelgridEnabled ? (canAccessSentinelGrid ? "Acessar" : "Sem acesso") : "Em breve"
}
```

Ícone no `views/admin-module-hub.ejs`: adicionado o caso `sentinelgrid → "bolt"`.
Enquanto `SENTINELGRID_ENABLED=false`, o card mostra badge "Em desenvolvimento"
com botão **"Em breve"** desabilitado.

## 2. `package.json` — metadados de módulo **[FEITO NESTA ETAPA]**

```jsonc
"moduleVersions": { "…": "…", "sentinelgrid": "0.0.1" },
"moduleStatuses": { "…": "…", "sentinelgrid": "in_development" }
```

Scripts a adicionar na Fase 0 (após aprovação):

```jsonc
"db:migrate:sentinelgrid": "node sentinelgrid/migrate.js",
"db:seed:sentinelgrid": "node sentinelgrid/seed.js",
"db:backup:sentinelgrid": "node scripts/backup-module-database.js sentinelgrid",
"db:restore:sentinelgrid": "node scripts/restore-database.js --module=sentinelgrid",
"sentinelgrid:enable": "node scripts/modules-toggle.js enable sentinelgrid",
"sentinelgrid:disable": "node scripts/modules-toggle.js disable sentinelgrid"
```

E incluir o SentinelGrid na cadeia de `scripts/migrate.js` (SpecFlow → ConfigDB →
ReportService → ModuleSpec → **SentinelGrid**).

## 3. Toggle de ambiente (`specflow/config/env.js`)

```js
sentinelgridEnabled: String(process.env.SENTINELGRID_ENABLED || "false").toLowerCase() === "true",
```

E o banco isolado:

```js
const sentinelgridDatabaseUrl =
  process.env.SENTINELGRID_DATABASE_URL || withDatabaseName(baseDatabaseUrl, "sentinelgrid");
// ...
databases: {
  // …
  sentinelgrid: {
    url: sentinelgridDatabaseUrl,
    ssl: parseBooleanFlag(process.env.SENTINELGRID_DATABASE_SSL, defaultDatabaseSsl)
  }
}
```

## 4. `.env.example`

```dotenv
# SentinelGrid (gestao de manutencao de equipamentos criticos) — em desenvolvimento
SENTINELGRID_ENABLED=false
SENTINELGRID_DATABASE_URL=postgres://postgres:postgres@localhost:5432/sentinelgrid
SENTINELGRID_DATABASE_SSL=false
```

## 5. Registro do router (`specflow/app.js`)

Import no topo (junto aos demais módulos, ~`specflow/app.js:163`):

```js
let registerSentinelGrid = null;
if (env.sentinelgridEnabled) {
  ({ registerSentinelGrid } = require("../sentinelgrid/src/app"));
}
```

Montagem (junto ao bloco `registerReportService`, ~`specflow/app.js:5304`):

```js
if (env.sentinelgridEnabled && registerSentinelGrid) {
  registerSentinelGrid(app, {
    asyncHandler, sanitizeInput, sanitizeRichTextInput,
    requireApiScope, requireAdminAuth, csrfProtection
  });
}
```

`registerSentinelGrid` monta a façade JSON do SPA:

```js
app.use("/admin/api/v2/sentinelgrid",
  deps.requireAdminAuth, deps.csrfProtection,
  createSentinelGridV2Router(deps));
```

## 6. Roteamento SPA (React + Vite)

- Rotas sob `/app/sentinelgrid/...` em `frontend/src/App.tsx` (lazy + Suspense).
- Client tipado em `frontend/src/api/sentinelgrid/client.ts` → `/admin/api/v2/sentinelgrid`.
- Proxy do Vite já cobre `/admin/api` (sem ajuste).
- Lembrar: **SPA servida do `dist`** — rodar `npm run build` no `frontend/` para ver mudanças.

## 7. Controle de acesso por módulo

Adicionar `"sentinelgrid"` a `MODULE_KEYS`/`MODULE_ACCESS_KEYS`
(`specflow/services/adminUsers.js:10`) **quando o módulo passar a ser acessível**
(fim da Fase 0 / início da Fase 1). Enquanto `in_development` com toggle off, não
é necessário — o card fica com CTA desabilitado e `hasModuleAccess` retorna
`false` para não-admins com segurança.

## 8. Checklist de aceite da Fase 0

- [ ] Card SentinelGrid aparece no Service Hub com badge "Em desenvolvimento". **[FEITO]**
- [ ] `package.json` com `moduleVersions`/`moduleStatuses` do sentinelgrid. **[FEITO]**
- [ ] `SENTINELGRID_ENABLED` e `SENTINELGRID_DATABASE_URL` em `env.js` + `.env.example`.
- [ ] `sentinelgrid/src/app.js` (`registerSentinelGrid`) + `db.js` + `migrations.js` idempotente.
- [ ] `npm run db:migrate:sentinelgrid` executa sem erro (cria banco/schema base).
- [ ] Com toggle on, `/app/sentinelgrid` abre placeholder da SPA.
