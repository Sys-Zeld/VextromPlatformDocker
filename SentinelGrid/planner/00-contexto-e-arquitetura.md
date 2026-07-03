# 00 — Contexto e Arquitetura

## 1. Domínio (resumo)

O SentinelGrid controla o **ciclo de vida de manutenção de equipamentos
críticos de energia**. O sistema é **orientado ao equipamento**: todo
planejamento, histórico, ordem, medição, recomendação e relatório está vinculado
a um ativo físico dentro da hierarquia obrigatória:

```text
Cliente → Site → Área → Equipamento
```

Regras estruturais inegociáveis (ver Regras de Negócio §28):

- Nenhuma Ordem de Manutenção existe sem Equipamento.
- Nenhum Equipamento existe fora de `Cliente → Site → Área`.
- Cada Equipamento tem um **plano de manutenção próprio** (mesmo derivado de um programa padrão).
- Toda manutenção concluída **atualiza o histórico** do equipamento.
- Relatório técnico é apenas **associado/anexado** — o módulo não cria relatório (isso é do Report Service).
- Recomendações técnicas são **rastreáveis** (status, criticidade, prazo, responsável).
- Manutenção com parada exige **aprovação do cliente**.
- Criticidade **altera prioridade** de alertas, vencimentos e planejamento.

## 2. Como o módulo encaixa na VextromPlatform

O SentinelGrid segue o **mesmo contrato dos módulos existentes** (Report
Service, Module Spec). Cada módulo é autocontido: banco próprio, migrations,
services, repositories e um `register<Módulo>(app, deps)` montado pelo hub
central `specflow/app.js`.

### 2.1. Backend — padrão de módulo

Referência: `report_service/src/`.

```text
sentinelgrid/
  migrate.js                  # entrypoint de migração (db:migrate:sentinelgrid)
  seed.js                     # dados de teste
  src/
    app.js                    # exporta registerSentinelGrid(app, deps)
    db.js                     # pool pg próprio (SENTINELGRID_DATABASE_URL)
    migrations.js             # DDL idempotente das tabelas
    constants.js              # enums (criticidade, status, tipos)
    routes/
      apiV2.js                # única superfície HTTP: façade JSON consumida pelo SPA React
    controllers/
    services/
    repositories/
    validators/
```

Registro em `specflow/app.js` (espelhando `registerReportService`, hoje em
`specflow/app.js:5304`):

```js
if (env.sentinelgridEnabled && registerSentinelGrid) {
  registerSentinelGrid(app, {
    asyncHandler,
    sanitizeInput,
    sanitizeRichTextInput,
    requireApiScope,
    requireAdminAuth,
    csrfProtection
  });
}
```

A façade JSON monta em `/admin/api/v2/sentinelgrid` sob `requireAdminAuth` +
`csrfProtection`, exatamente como o Report Service faz para o SPA
(`report_service/src/app.js:19`).

> **Sem telas legadas.** Ao contrário do Report Service (que ainda mantém views
> EJS em `/admin/report-service`), o SentinelGrid **não** terá camada de views
> server-rendered nem `routes/web.js`: a **única** interface é a SPA React/Vite
> consumindo a façade JSON. Isso simplifica o módulo e evita dívida técnica de
> migração futura — nascemos já no padrão-alvo.

### 2.2. Isolamento de banco

Novo banco `sentinelgrid` com sua própria connection string, seguindo o padrão
de `specflow/config/env.js`:

- `SENTINELGRID_DATABASE_URL` (fallback: `withDatabaseName(baseDatabaseUrl, "sentinelgrid")`)
- `SENTINELGRID_DATABASE_SSL`
- Entrada em `env.databases.sentinelgrid = { url, ssl }`

Backup/restore por módulo valida assinatura de tabelas — as tabelas do
SentinelGrid recebem prefixo/escopo próprios para não colidir com outros
módulos.

### 2.3. Frontend — React + Vite (mesma SPA de `/app`)

A plataforma já tem **uma** SPA React/Vite em `frontend/` servida sob `/app`
(`specflow/app.js:234`, ativada por `REACT_APP_ENABLED`). O SentinelGrid **não**
cria um segundo bundle: adiciona uma **área de rotas** dentro dessa SPA, sob o
prefixo `/app/sentinelgrid/...`, reutilizando:

- `Layout`, React Router e o `Suspense`/lazy de `frontend/src/App.tsx`;
- React Query (`@tanstack/react-query`) para data-fetching;
- `react-bootstrap` + `frontend/src/styles/theme.css` para UI e temas;
- um client tipado novo em `frontend/src/api/sentinelgrid/` apontando para
  `/admin/api/v2/sentinelgrid`.

Estrutura frontend proposta:

```text
frontend/src/
  pages/sentinelgrid/
    SentinelHomePage.tsx      # dashboard/entrada do módulo
    ClientsPage.tsx, SitesPage.tsx, AreasPage.tsx, EquipmentsPage.tsx, ...
  components/sentinelgrid/
  api/sentinelgrid/
    client.ts                 # wrappers tipados da façade V2
```

Rotas em `frontend/src/App.tsx`:

```tsx
const SentinelHomePage = lazy(() => import("./pages/sentinelgrid/SentinelHomePage"));
// ...
<Route path="/sentinelgrid" element={<SentinelHomePage />} />
<Route path="/sentinelgrid/equipments/:id" element={<EquipmentDetailPage />} />
```

> O proxy do Vite (`frontend/vite.config.ts`) já cobre `/admin/api`, então o dev
> server enxerga a façade V2 sem ajuste adicional.

### 2.4. Autenticação e acesso

- **Admin/SPA:** reutiliza a sessão cookie de admin da plataforma + CSRF (mesma camada de auth compartilhada; não é uma tela nova, apenas o mecanismo de sessão).
- **Controle de acesso por módulo:** a chave `sentinelgrid` entra em
  `MODULE_ACCESS_KEYS`/`MODULE_KEYS` (`specflow/services/adminUsers.js:10`) quando
  o módulo passar a ser acessível (fase de bootstrap). Enquanto `in_development`,
  o card do Service Hub aparece com CTA desabilitado.
- **API externa (futuro):** escopos de API key `sentinelgrid:read`/`:write`,
  seguindo o padrão de `report-service:read/write`.

## 3. Fronteiras explícitas

- **Não** implementa geração de relatório técnico completo — apenas associa
  (código, PDF, link externo, ID de integração) ao Report Service ou externo.
- **Não** duplica o cadastro de equipamentos do Report Service: a relação entre
  os dois módulos (reuso vs. espelhamento) é decidida na Fase 1 (ver riscos em
  [02](02-roadmap-de-implementacao.md)).

## 4. Convenções técnicas herdadas

- Idioma da UI: PT (padrão), EN, ES (i18n de sessão).
- SPA servida do `dist` — mudanças no frontend só aparecem após `npm run build`.
- PostgreSQL, migrations idempotentes (`CREATE TABLE IF NOT EXISTS`).
- Nomes de tabela em `snake_case`, prefixadas por escopo do módulo.
