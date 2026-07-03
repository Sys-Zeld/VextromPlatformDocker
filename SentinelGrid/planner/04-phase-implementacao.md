# 04 — Phase de Implementação (log de contexto vivo)

> **Propósito:** este é o **contexto de memória de implementação** do
> SentinelGrid. Toda nova modificação, decisão técnica ou implementação de
> qualquer fase deve ser **registrada aqui**, em ordem cronológica. Serve como
> fonte única de verdade do "o que já foi feito e por quê", complementando o
> roadmap ([02](02-roadmap-de-implementacao.md), que descreve o *plano*).
>
> Regra de ouro: **antes de encerrar uma fatia de trabalho, adicione/atualize um
> registro abaixo.** O roadmap diz o que fazer; este documento diz o que foi
> feito.

## Como registrar

Cada entrada segue o formato:

```md
### AAAA-MM-DD — <Fase N> · <título curto da fatia>

**Status:** ⬜ planejada · 🚧 em andamento · ✅ concluída · ⏸️ pausada
**Contexto/decisão:** por que foi feito, alternativas descartadas.
**Alterações:**
- `caminho/do/arquivo` — o que mudou.
**Migrations/DB:** tabelas criadas/alteradas (se houver).
**Como validar:** passo de verificação (build, rota, tela).
**Pendências/próximo passo:** o que fica aberto.
```

Convenções:
- Ordem **cronológica** (mais antigo no topo, novo no fim de cada fase).
- Referenciar arquivos por caminho relativo ao repositório.
- Decisões que alteram o plano → atualizar também o doc de roadmap/arquitetura correspondente e citar aqui.
- Nada de segredos/credenciais neste arquivo.

---

## Estado atual (snapshot)

| Fase | Título | Status |
|------|--------|--------|
| 0 | Bootstrap & Service Hub | ✅ concluída |
| 1 | Cadastros base | ✅ concluída |
| 2 | Programas & Planos | ✅ concluída |
| 3 | Ordens de Manutenção | ✅ concluída |
| 4 | Execução técnica | ✅ concluída (MVP operacional) |
| 5 | Relatório associado | ✅ concluída (MVP operacional) |
| 6 | Calendário + Eventos | ✅ concluída (MVP operacional) |
| 7 | Histórico (prontuário) | ✅ concluída (MVP operacional) |
| 8 | Indicadores & risco | ✅ concluída (MVP operacional) |
| 9 | Mobile & integrações | ⬜ |

**Decisões pendentes que bloqueiam fases** (ver [02](02-roadmap-de-implementacao.md)):
1. Equipamentos: reuso do Report Service vs. cadastro próprio (bloqueia Fase 1).
2. Profundidade da integração de relatório (Fase 5).
3. Escopo do MVP (sugestão: Fases 0–3).

---

## Registro cronológico

### 2026-07-02 — Fase 0 · Planners de análise e bootstrap do Service Hub

**Status:** 🚧 em andamento
**Contexto/decisão:** estruturar o contexto do novo módulo antes de codar produto.
Módulo nasce **100% React + Vite**, sem telas legadas EJS nem `routes/web.js` — a
única superfície HTTP é a façade JSON `/admin/api/v2/sentinelgrid` (decisão do
usuário; ver [00 §2.1](00-contexto-e-arquitetura.md)). O card entra como
placeholder "Em desenvolvimento" para dar visibilidade sem habilitar o módulo.

**Alterações:**
- `SentinelGrid/planner/README.md` — índice dos planners.
- `SentinelGrid/planner/00-contexto-e-arquitetura.md` — domínio + encaixe na arquitetura (React-only, façade V2, DB isolada).
- `SentinelGrid/planner/01-modelo-de-dados.md` — 25 entidades → tabelas `sg_*`, enums, integridade.
- `SentinelGrid/planner/02-roadmap-de-implementacao.md` — Fases 0–9.
- `SentinelGrid/planner/03-integracao-plataforma.md` — Service Hub, env, package.json, scripts, roteamento SPA.
- `SentinelGrid/planner/04-phase-implementacao.md` — este log.
- `package.json` — `moduleVersions.sentinelgrid = "0.0.1"`, `moduleStatuses.sentinelgrid = "in_development"`.
- `specflow/config/env.js` — `sentinelgridEnabled` (`SENTINELGRID_ENABLED`, default `false`).
- `specflow/app.js` — em `renderAdminModuleHubPage`: `sentinelGridStatus`, `canAccessSentinelGrid` e card `sentinelgrid` em `moduleCards` (href `/app/sentinelgrid` quando habilitado; CTA "Em breve" desabilitado enquanto off).
- `views/admin-module-hub.ejs` — ícone `bolt` para a chave `sentinelgrid`.

**Migrations/DB:** nenhuma ainda (banco `sentinelgrid` será criado na Fase 0 pós-aprovação).

**Como validar:** abrir o Service Hub (`/admin/module-hub` ou equivalente) e ver o
card **SentinelGrid** com badge amarelo "Em desenvolvimento" e botão "Em breve"
desabilitado. Sintaxe conferida: `node --check specflow/app.js specflow/config/env.js` + `JSON.parse(package.json)`.

**Pendências/próximo passo:** resolver as 3 decisões pendentes; então executar o
restante da Fase 0 (scaffold `sentinelgrid/src/`: `app.js`/`db.js`/`migrations.js`/
`constants.js`, scripts `db:migrate:sentinelgrid` etc., `.env.example`, rota stub
`/app/sentinelgrid` na SPA e client tipado).

### 2026-07-02 — Transversal · Decisões arquiteturais (ADRs) registradas

**Status:** ✅ concluída
**Contexto/decisão:** o usuário definiu **isolamento total** — o SentinelGrid não
reaproveita dado nem lógica de domínio de outro módulo; integração só por
contrato (API). Discussão de segurança/isolamento consolidada em ADRs.

**Alterações:**
- `SentinelGrid/planner/05-decisoes-arquiteturais.md` — novo, 11 ADRs (001 isolamento total; 002 domínio isolado/infra compartilhada; 003 transporte in-process remote-ready vs HTTP [Pendente]; 004 registry próprio + external_ref; 005 integração RS read-only; 006 migrations versionadas; 007 OM≠OS; 008 regras como mecanismo; 009 zod; 010 client-scoping; 011 MVP Fases 0–3).
- `SentinelGrid/planner/README.md` — índice inclui o doc 05.
- `SentinelGrid/planner/02-roadmap-de-implementacao.md` — seção de decisões atualizada: equipamentos e integração de relatório resolvidas via ADR; abertas = topologia de deploy (ADR-003) e escopo do MVP (ADR-011).

**Migrations/DB:** nenhuma.

**Como validar:** revisar `05-decisoes-arquiteturais.md`; conferência de coerência com `02`.

**Pendências/próximo passo:** usuário responder a **topologia de deploy** (ADR-003)
e confirmar **escopo do MVP** (ADR-011); então iniciar o restante da Fase 0.

### 2026-07-02 — Fase 0 · Fatia 0.1: esqueleto backend + DB isolada + migrations versionadas

**Status:** ✅ concluída (validada no backend)
**Contexto/decisão:** primeira fatia de código do módulo. Migrations versionadas
com runner próprio ([ADR-006](05-decisoes-arquiteturais.md)); infra reutilizada
(`ensureDatabaseExists`) por ser plataforma, não domínio ([ADR-002](05-decisoes-arquiteturais.md)).

**Alterações:**
- `sentinelgrid/src/db.js` — pool pg do banco isolado `sentinelgrid`.
- `sentinelgrid/src/constants.js` — enums (criticidade, status OM, tipos, periodicidade…).
- `sentinelgrid/src/migrations/runner.js` — runner versionado + `sg_schema_migrations` (transação por arquivo).
- `sentinelgrid/migrations/001_init.sql` — baseline (`sg_module_meta`).
- `sentinelgrid/migrate.js` — entrypoint (`migrateSentinelGrid`): cria o banco + roda pendentes.
- `sentinelgrid/src/routes/apiV2.js` — façade JSON, `GET /health`.
- `sentinelgrid/src/app.js` — `registerSentinelGrid(app, deps)` (monta `/admin/api/v2/sentinelgrid` sob auth+CSRF).
- `specflow/config/env.js` — `sentinelgridDatabaseUrl` + `env.databases.sentinelgrid`.
- `specflow/app.js` — require lazy + bloco `registerSentinelGrid` (guardado por `env.sentinelgridEnabled`).
- `specflow/db/migrate.js` — SentinelGrid na cadeia (após report-service, guardado pelo toggle).
- `scripts/modules-toggle.js` — target `sentinelgrid`.
- `package.json` — scripts `db:migrate:sentinelgrid`, `sentinelgrid:enable/disable`.
- `.env.example` — `SENTINELGRID_ENABLED`, `SENTINELGRID_DATABASE_URL`, `_SSL`.

**Migrations/DB:** banco `sentinelgrid` criado; tabelas `sg_schema_migrations`, `sg_module_meta`; `001_init.sql` aplicada.

**Como validar (feito):** `node --check` em todos os arquivos ✅; `node sentinelgrid/migrate.js` → aplica 1/1 ✅; 2ª execução → 0/1 (idempotente) ✅; `GET /health` isolado → `200 {"module":"sentinelgrid","status":"ok","migrations":1}` ✅.

**Pendências/próximo passo:** Fatia **0.2** (stub SPA React/Vite em `/app/sentinelgrid` consumindo `/health`). Para validar no navegador o caminho completo com auth: setar `SENTINELGRID_ENABLED=true` no `.env` e reiniciar o app.

### 2026-07-02 — Fase 0 · Fatia 0.2: stub da SPA (React/Vite)

**Status:** ✅ concluída (aguardando validação no navegador pelo usuário)
**Contexto/decisão:** primeira tela React do módulo; consome o `/health` da fatia
0.1 para provar o caminho completo card → página → backend.

**Alterações:**
- `frontend/src/api/sentinelgrid/client.ts` — client tipado (`getSentinelHealth`), reusa o wrapper `api` (base `/admin/api/v2`).
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — placeholder: cabeçalho + selo "Em desenvolvimento", status do módulo (Online/migrations via React Query), teaser das próximas fases.
- `frontend/src/App.tsx` — rota lazy `/sentinelgrid`.

**Migrations/DB:** nenhuma.

**Como validar:** `npm run build` no `frontend/` ✅ (typecheck OK, chunk `SentinelHomePage-*.js` emitido). Ambiente já tem `SENTINELGRID_ENABLED=true` e `REACT_APP_ENABLED=true`. Validação no navegador pendente: Service Hub → card SentinelGrid → `/app/sentinelgrid` deve mostrar "Online" + "Migrations aplicadas: 1".

**Pendências/próximo passo:** **Fase 0 concluída** após o OK do teste online. Depois:
adicionar `sentinelgrid` a `MODULE_ACCESS_KEYS`/`MODULE_KEYS` (`specflow/services/adminUsers.js`)
para liberar acesso a usuários não-admin; então iniciar **Fase 1** (cadastros).

### 2026-07-02 — Fase 1 · Fatia 1.1: Clientes (CRUD vertical completo)

**Status:** ✅ concluída (backend validado; UI aguardando validação no navegador)
**Contexto/decisão:** primeiro slice vertical de produto — fixa o padrão que as
próximas entidades reusam. Adotado **zod** para validação/contrato ([ADR-009](05-decisoes-arquiteturais.md)
promovido a Aceita; `zod@3.25.76` já presente, agora declarado no `package.json`).
Soft delete via `deleted_at`; envelope de erro `{error, errorCode, details}`.

**Alterações (backend):**
- `sentinelgrid/migrations/002_clients.sql` — tabela `sg_clients` (+índices por nome/status).
- `sentinelgrid/src/constants.js` — `CLIENT_STATUS`.
- `sentinelgrid/src/validators/clientValidators.js` — schema zod + `parseClientInput`.
- `sentinelgrid/src/repositories/clientsRepository.js` — list (busca+paginação)/get/create/update/softDelete.
- `sentinelgrid/src/routes/clients.js` — CRUD REST (`GET /`, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id`), 400 com issues do zod.
- `sentinelgrid/src/routes/apiV2.js` — monta `/clients`.
- `package.json` — dependência `zod`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/clients.ts` — client tipado.
- `frontend/src/pages/sentinelgrid/ClientsPage.tsx` — lista+busca, form de criação, modal de edição, exclusão (padrão CustomersPage/IconAction).
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — card "Cadastros" com link para Clientes.
- `frontend/src/App.tsx` — rota `/sentinelgrid/clients`.

**Migrations/DB:** `sg_clients` criada e aplicada (`002_clients.sql`).

**Como validar (feito no backend):** `node --check` ✅; CRUD isolado ✅ — POST 201 (nome trimado, status default `ativo`), POST inválido → 400, GET list (busca) 200, PUT 200, DELETE 204, list pós-delete total=0 (soft delete filtrado). `npm run build` ✅ (chunks `ClientsPage`/`SentinelHomePage`).

**Pendências/próximo passo:** validar a UI no navegador (`/app/sentinelgrid/clients`).
Depois, **Fatia 1.2 — Sites** (sob cliente, com `client_id`, [ADR-010](05-decisoes-arquiteturais.md) client-scoping).

### 2026-07-02 — Fase 1 · Ajuste: menu lateral próprio do SentinelGrid

**Status:** ✅ concluída (aguardando validação no navegador)
**Contexto/decisão:** o SentinelGrid precisa de navegação lateral própria, separada
do Service Report. Em vez de duplicar o `Layout` (tema, recolher, topbar, drawer),
tornei-o **sensível ao módulo**: detecta o prefixo `/sentinelgrid` e troca nav,
branding (subtítulo/crumb), rótulo de seção e link de rodapé.

**Alterações (frontend):**
- `frontend/src/components/Layout.tsx` — `NAV` única virou `SERVICE_REPORT_NAV` + `SENTINELGRID_NAV`; descritores `SERVICE_REPORT_MODULE`/`SENTINELGRID_MODULE` (subtítulo, crumb, seção, footer); `resolveModule(pathname)`; `pageTitle` agora recebe o módulo ativo. Sidebar do SentinelGrid: seção "Manutenção", itens Início + Clientes, rodapé "Service Hub" (`/admin/module-hub`). Service Report inalterado.

**Migrations/DB:** nenhuma.

**Como validar:** `npm run build` ✅ (typecheck). No navegador: sob `/app/sentinelgrid*` a sidebar mostra "SentinelGrid / Manutenção / Início · Clientes / Service Hub"; sob as rotas do Service Report, o menu original.

**Pendências/próximo passo:** seguir a **Fatia 1.2 — Sites** (adiciona item na `SENTINELGRID_NAV`).

### 2026-07-02 — Fase 1 · Fatia 1.2: Sites (CRUD sob cliente)

**Status:** ✅ concluída (backend validado; UI aguardando validação no navegador)
**Contexto/decisão:** Site pertence a um Cliente (`client_id` NOT NULL, FK RESTRICT) —
client-scoping ([ADR-010](05-decisoes-arquiteturais.md)). Extraí `src/routes/httpErrors.js`
(toValidationError + isForeignKeyError) e refatorei `clients.js` para reusá-lo (ADR-002:
infra compartilhada). FK inválida → 400.

**Alterações (backend):**
- `sentinelgrid/migrations/003_sites.sql` — `sg_sites` (client_id FK, índices).
- `sentinelgrid/src/routes/httpErrors.js` — helpers de erro compartilhados; `clients.js` passou a importá-lo.
- `sentinelgrid/src/validators/siteValidators.js` — zod (clientId coerce+positive).
- `sentinelgrid/src/repositories/sitesRepository.js` — list (join client_name, filtro clientId+busca)/get/create/update/softDelete.
- `sentinelgrid/src/routes/sites.js` — CRUD + tratamento de FK (400).
- `sentinelgrid/src/routes/apiV2.js` — monta `/sites`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/sites.ts` — client tipado.
- `frontend/src/pages/sentinelgrid/SitesPage.tsx` — seletor de cliente, filtro por cliente + busca, CRUD.
- `frontend/src/components/Layout.tsx` — item "Sites" na nav do SentinelGrid.
- `frontend/src/App.tsx` — rota `/sentinelgrid/sites`; `SentinelHomePage` link para Sites.

**Migrations/DB:** `sg_sites` criada (`003_sites.sql`).

**Como validar (backend):** `node --check` ✅; CRUD isolado ✅ — POST FK inválida → 400, POST válido (nome trimado, join client_name), GET filtrado por cliente, PUT 200, DELETE 204. `npm run build` ✅ (chunk `SitesPage`).

**Pendências/próximo passo:** **Fatia 1.3 — Áreas** (sob site: `site_id` FK; herda cliente via site). Depois 1.4 (fabricante/tipo/modelo) e 1.5 (equipamento).

### 2026-07-02 — Fase 1 · Fatia 1.3: Áreas (CRUD sob site)

**Status:** ✅ concluída (backend validado; UI aguardando validação no navegador)
**Contexto/decisão:** Área pertence a um Site (`site_id` NOT NULL, FK RESTRICT) e
alcança o cliente via site (join área→site→cliente). Mesmo padrão das fatias anteriores.

**Alterações (backend):** `migrations/004_areas.sql` (`sg_areas`); `validators/areaValidators.js` (zod, siteId); `repositories/areasRepository.js` (join site_name+client_name, filtros siteId/clientId/busca); `routes/areas.js` (CRUD + FK→400); `routes/apiV2.js` monta `/areas`.

**Alterações (frontend):** `api/sentinelgrid/areas.ts`; `pages/sentinelgrid/AreasPage.tsx` (seletor de site "Cliente / Site", filtro por site + busca); `Layout.tsx` item "Áreas"; `App.tsx` rota `/sentinelgrid/areas`; home link.

**Migrations/DB:** `sg_areas` criada (`004_areas.sql`).

**Como validar (backend):** `node --check` ✅; CRUD isolado ✅ — FK inválida→400, POST (nome trimado, join site_name/client_name), GET ?siteId e ?clientId, PUT 200, DELETE 204. `npm run build` ✅ (chunk `AreasPage`).

**Pendências/próximo passo:** **Fatia 1.4 — Fabricantes / Tipos de equipamento / Modelos** (lookups que o Equipamento referencia), depois **1.5 — Equipamento** (entidade central).

### 2026-07-02 — Fase 1 · Fatia 1.4: Catálogo (Fabricantes, Tipos, Modelos)

**Status:** ✅ concluída (backend validado; UI aguardando validação no navegador)
**Contexto/decisão:** lookups que o Equipamento (1.5) referencia. Fabricante e Tipo
têm a mesma forma {name, notes} → fatorei repositório/rota **genéricos de lookup**
(ADR-002). Modelo é bespoke (FK fabricante+tipo). Nome único (case-insensitive):
409 em duplicata; FK inválida: 400.

**Alterações (backend):**
- `migrations/005_equipment_catalog.sql` — `sg_manufacturers`, `sg_equipment_types` (unique lower(name)), `sg_equipment_models` (FKs, unique (manufacturer_id, lower(name))).
- `src/routes/httpErrors.js` — `isUniqueViolation` (23505).
- `src/validators/lookupValidators.js`, `src/repositories/lookupRepository.js` (fábrica), `src/routes/lookup.js` (router genérico).
- `src/validators/equipmentModelValidators.js`, `src/repositories/equipmentModelsRepository.js` (join fabricante/tipo), `src/routes/equipmentModels.js`.
- `src/routes/apiV2.js` — monta `/manufacturers`, `/equipment-types` (lookup) e `/equipment-models`.

**Alterações (frontend):**
- `api/sentinelgrid/catalog.ts` — fabricantes/tipos/modelos.
- `pages/sentinelgrid/CatalogPage.tsx` — página única: `LookupSection` reusável (Fabricantes, Tipos) + `ModelsSection` (selects fabricante/tipo).
- `Layout.tsx` item "Catálogo"; `App.tsx` rota `/sentinelgrid/catalog`; home link.

**Migrations/DB:** `sg_manufacturers`, `sg_equipment_types`, `sg_equipment_models`.

**Como validar (backend):** `node --check` ✅; CRUD isolado ✅ — fabricante dup→409, tipo, modelo FK inválida→400, modelo (join fabricante/tipo), modelo dup→409, PUT/DELETE. `npm run build` ✅ (chunk `CatalogPage`).

**Pendências/próximo passo:** **Fatia 1.5 — Equipamento** (entidade central): FKs cliente/site/área/tipo/fabricante/modelo + specs elétricas + criticidade + status operacional; usa os enums já em `constants.js`.

### 2026-07-02 — Fase 1 · Fatia 1.5: Equipamento (entidade central)

**Status:** ✅ concluída (backend validado; UI aguardando validação no navegador)
**Contexto/decisão:** entidade central que amarra a Fase 1. **Integridade §28.2:**
o input pede só `areaId`; o repositório resolve `site_id`+`client_id` a partir da
área (uma fonte de verdade — impede hierarquia inconsistente). FKs de catálogo
(tipo/fabricante/modelo) opcionais; criticidade/status usam os enums de `constants.js`.

**Alterações (backend):**
- `migrations/006_equipment.sql` — `sg_equipment` (client/site/area NOT NULL, specs elétricas, criticidade, status, índices).
- `src/validators/equipmentValidators.js` — zod com helpers nullable (FK/int/data opcionais → null); confirmado que `preprocess` trata chaves ausentes.
- `src/repositories/equipmentRepository.js` — `resolveAreaScope` (deriva site/cliente da área); list com 6 joins + filtros (cliente/site/área/criticidade/status/busca); create/update por colunas.
- `src/routes/equipment.js` — CRUD; área inválida→400, FK catálogo→400.
- `src/routes/apiV2.js` — monta `/equipment`.

**Alterações (frontend):**
- `api/sentinelgrid/equipment.ts` — tipos + metadados de criticidade/status (label+variant).
- `pages/sentinelgrid/EquipmentsPage.tsx` — lista com filtros (cliente/criticidade/status/busca) + badges; modal grande com cascata Cliente→Site→Área, catálogo, specs, datas.
- `Layout.tsx` item "Equipamentos"; `App.tsx` rota `/sentinelgrid/equipment`; home link.

**Migrations/DB:** `sg_equipment` criada (`006_equipment.sql`).

**Como validar (backend):** `node --check` ✅; CRUD isolado ✅ — área inválida→400, **body mínimo (só areaId) deriva client/site + defaults**, POST completo (specs/data/module_count), FK catálogo→400, filtros+joins, PUT/DELETE. `npm run build` ✅ (chunk `EquipmentsPage`).

**Pendências/próximo passo:** **Fatia 1.6 — Gestores do cliente + Contratos** (fecha a Fase 1). Depois, Fase 2 (Programas & Planos).

### 2026-07-02 — Fase 1 · Fatia 1.6: Gestores + Contratos (FASE 1 CONCLUÍDA)

**Status:** ✅ concluída (backend validado; UI aguardando validação no navegador)
**Contexto/decisão:** fecha a Fase 1. Gestor (§8) e Contrato (§26) pertencem ao
cliente; gestor com escopo opcional de site. Flags booleanas do contrato
(`requiresReport`/`requiresApproval`) via `z.boolean()` (frontend envia boolean).

**Alterações (backend):** `migrations/007_managers_contracts.sql` (`sg_client_managers`, `sg_contracts`); validators + repositories + rotas para ambos (FK→400); `apiV2.js` monta `/client-managers` e `/contracts`.

**Alterações (frontend):** `api/sentinelgrid/managers.ts` + `contracts.ts`; `pages/sentinelgrid/ManagementPage.tsx` (uma página, seções Gestores + Contratos, filtro por cliente, modal de contrato com switches); `Layout.tsx` item "Contratos & Gestores"; `App.tsx` rota `/sentinelgrid/management`; home link.

**Migrations/DB:** `sg_client_managers`, `sg_contracts`.

**Como validar (backend):** `node --check` ✅; CRUD isolado ✅ — gestor FK→400, POST (escopo de site, joins), PUT/DELETE; contrato com flags (requires_report/approval), maint_per_year, PUT/DELETE. `npm run build` ✅ (chunk `ManagementPage`).

---

## ✅ FASE 1 (Cadastros base) CONCLUÍDA

Todas as fatias entregues: 1.1 Clientes, 1.2 Sites, 1.3 Áreas, 1.4 Catálogo
(Fabricantes/Tipos/Modelos), 1.5 Equipamento (central), 1.6 Gestores + Contratos.
Hierarquia `Cliente → Site → Área → Equipamento` completa e navegável; catálogo e
contratos/gestores prontos. Menu lateral do SentinelGrid: Início · Clientes ·
Sites · Áreas · Catálogo · Equipamentos · Contratos & Gestores.

Padrão consolidado (reusável na Fase 2): migration versionada → validator zod →
repository (soft-delete + joins) → rotas CRUD (envelope de erro, FK→400) →
api tipada → página SPA → item no menu. Backend testado isolado antes do build.

**Próximo passo:** **Fase 2 — Programas & Planos de manutenção** (`sg_maintenance_programs`,
`sg_equipment_plans`, `sg_plan_items`, checklists).

### 2026-07-02 — Fase 2 · Fatia 2.1: Programas de manutenção

**Status:** ✅ concluída (backend validado; UI aguardando validação no navegador)
**Contexto/decisão:** início da Fase 2 com a entidade "programa de manutenção"
como modelo padrão. O programa ainda não gera plano de equipamento; ele define
escopo opcional por tipo/fabricante/modelo/criticidade/contrato, tipo de
manutenção e periodicidade para ser aplicado na fatia seguinte.

**Alterações (backend):**
- `sentinelgrid/migrations/008_maintenance_programs.sql` — cria `sg_maintenance_programs`, índices por escopo/status e nome único case-insensitive.
- `sentinelgrid/src/validators/maintenanceProgramValidators.js` — schema zod com enums de `constants.js`.
- `sentinelgrid/src/repositories/maintenanceProgramsRepository.js` — list/get/create/update/softDelete com joins de catálogo/contrato.
- `sentinelgrid/src/routes/maintenancePrograms.js` — CRUD REST, FK inválida→400, duplicidade→409.
- `sentinelgrid/src/routes/apiV2.js` — monta `/maintenance-programs`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/programs.ts` — client tipado + metadados de criticidade/tipo/periodicidade.
- `frontend/src/pages/sentinelgrid/ProgramsPage.tsx` — lista com filtros, modal de criação/edição e exclusão.
- `frontend/src/App.tsx` — rota `/sentinelgrid/programs`.
- `frontend/src/components/Layout.tsx` — item "Programas" no menu SentinelGrid.
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — link para Programas.

**Migrations/DB:** `sg_maintenance_programs` criada (`008_maintenance_programs.sql`).

**Como validar (feito):** `node --check` nos novos arquivos backend ✅; `node sentinelgrid/migrate.js` aplicou 1/8 ✅; CRUD isolado via repository ✅ (create/list/update/delete + soft delete); `npm --prefix frontend run build` ✅.

**Pendências/próximo passo:** validar no navegador `/app/sentinelgrid/programs`.
Depois seguir para **Fatia 2.2 — Planos do equipamento** (`sg_equipment_plans`,
`sg_plan_items`) aplicando um programa a um equipamento e permitindo overrides.

### 2026-07-02 — Fase 2 · Fatia 2.2: Planos do equipamento

**Status:** ✅ concluída (backend e build React validados)
**Contexto/decisão:** plano é a aplicação operacional de um programa a um equipamento.
Foi modelado com overrides leves (`adjustments`) e item padrão (`sg_plan_items`)
para já abrir caminho para checklists/rotinas sem travar a criação inicial.

**Alterações (backend):**
- `sentinelgrid/migrations/009_equipment_plans.sql` — cria `sg_equipment_plans` e `sg_plan_items`, com soft-delete, FKs e índices por equipamento/programa/vencimento.
- `sentinelgrid/src/validators/equipmentPlanValidators.js` — schemas zod para plano e item de plano.
- `sentinelgrid/src/repositories/equipmentPlansRepository.js` — list/get/create/update/softDelete de planos e CRUD de itens.
- `sentinelgrid/src/routes/equipmentPlans.js` — API REST de planos e endpoints de itens, com erros de domínio/FK tratados.
- `sentinelgrid/src/routes/apiV2.js` — monta `/equipment-plans`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/plans.ts` — client tipado para planos e itens.
- `frontend/src/pages/sentinelgrid/PlansPage.tsx` — lista com filtros por cliente/busca, criação/edição/exclusão e seleção de equipamento/programa.
- `frontend/src/App.tsx` — rota `/sentinelgrid/plans`.
- `frontend/src/components/Layout.tsx` — item "Planos" no menu SentinelGrid.
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — link para Planos do equipamento.

**Migrations/DB:** `009_equipment_plans.sql` aplicada no host e no container `app`.

**Como validar (feito):** `node --check` nos novos arquivos backend ✅; `node sentinelgrid/migrate.js` ✅; `docker compose exec app node sentinelgrid/migrate.js` ✅; ciclo repository create/list/softDelete de plano com item padrão no host e no container ✅; `npm --prefix frontend run build` ✅; rota SPA `/app/sentinelgrid/plans` respondeu 200 ✅.

**Pendências/próximo passo:** evoluir itens de plano para checklists detalhados ou iniciar **Fase 3 — Ordens de Manutenção**, conforme prioridade do MVP.

### 2026-07-02 — Fase 2 · Fatia 2.3: Checklists

**Status:** ✅ concluída (backend, migrations e build React validados)
**Contexto/decisão:** checklists foram implementados como templates independentes,
com escopo opcional por tipo/fabricante/modelo/programa e itens ordenados. Isso
mantém o template reutilizável por tipo de manutenção e prepara a execução técnica
da Fase 4 sem acoplar ainda à OM da Fase 3.

**Alterações (backend):**
- `sentinelgrid/migrations/010_checklists.sql` — cria `sg_checklists` e `sg_checklist_items`, com soft-delete, FKs, índice de escopo e nome único ativo.
- `sentinelgrid/src/validators/checklistValidators.js` — schemas zod para checklist e item.
- `sentinelgrid/src/repositories/checklistsRepository.js` — list/get/create/update/softDelete de checklists e CRUD de itens.
- `sentinelgrid/src/routes/checklists.js` — API REST de checklists e endpoints de itens, com validação, FK→400 e duplicidade→409.
- `sentinelgrid/src/routes/apiV2.js` — monta `/checklists`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/checklists.ts` — client tipado para checklists e itens.
- `frontend/src/pages/sentinelgrid/ChecklistsPage.tsx` — lista com filtros, modal de cadastro/edição e editor de itens ordenados.
- `frontend/src/App.tsx` — rota `/sentinelgrid/checklists`.
- `frontend/src/components/Layout.tsx` — item "Checklists" no menu SentinelGrid.
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — link para Checklists.

**Migrations/DB:** `010_checklists.sql` aplicada no host e no container `app`.

**Como validar (feito):** `node --check` nos novos arquivos backend ✅; `node sentinelgrid/migrate.js` ✅; `docker compose exec app node sentinelgrid/migrate.js` ✅; ciclo repository create/get/list/softDelete de checklist com item no host e no container ✅; `npm --prefix frontend run build` ✅; rota SPA `/app/sentinelgrid/checklists` respondeu 200 ✅.

**Pendências/próximo passo:** iniciar **Fase 3 — Ordens de Manutenção** com OM sempre vinculada a equipamento, criação manual e criação futura a partir dos planos/checklists.

### 2026-07-02 — Fase 3 · Fatia 3.1: Ordens de manutenção manuais

**Status:** ✅ concluída (backend, migrations e build React validados)
**Contexto/decisão:** a primeira entrega da Fase 3 cria a base operacional das
OMs: toda ordem nasce vinculada a um equipamento e herda `client/site/area` desse
ativo. Preventiva com parada inicia, por padrão, em `aguardando_aprovacao`; corretiva
inicia em `emergencial` e já persiste detalhes corretivos.

**Alterações (backend):**
- `sentinelgrid/migrations/011_maintenance_orders.sql` — cria `sg_maintenance_orders`, `sg_order_corrective_details`, `sg_client_approvals` e sequência de número de OM.
- `sentinelgrid/src/validators/maintenanceOrderValidators.js` — schema zod da OM e detalhes corretivos.
- `sentinelgrid/src/repositories/maintenanceOrdersRepository.js` — list/get/create/update/softDelete, geração de `order_number`, derivação da hierarquia pelo equipamento e upsert de corretiva.
- `sentinelgrid/src/routes/maintenanceOrders.js` — CRUD REST de OMs, validação e erros de FK/domínio.
- `sentinelgrid/src/routes/apiV2.js` — monta `/maintenance-orders`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/maintenanceOrders.ts` — client tipado, status e classes corretivas.
- `frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx` — lista com filtros, criação/edição/exclusão de OM e campos específicos de corretiva.
- `frontend/src/App.tsx` — rota `/sentinelgrid/maintenance-orders`.
- `frontend/src/components/Layout.tsx` — item "Ordens" no menu SentinelGrid.
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — link para Ordens de manutenção.

**Migrations/DB:** `011_maintenance_orders.sql` aplicada no host e no container `app`.

**Como validar (feito):** `node --check` nos novos arquivos backend ✅; `node sentinelgrid/migrate.js` ✅; `docker compose exec app node sentinelgrid/migrate.js` ✅; ciclo repository no host e no container criando preventiva + corretiva com detalhes, listando e fazendo soft-delete ✅; `npm --prefix frontend run build` ✅; rota SPA `/app/sentinelgrid/maintenance-orders` respondeu 200 ✅.

**Pendências/próximo passo:** implementar transições de status e aprovação de cliente para `preventiva_com_parada`, depois geração de OM a partir dos planos.

### 2026-07-02 — Fase 3 · Fatia 3.2: Transições e aprovação de cliente

**Status:** ✅ concluída (backend e build React validados)
**Contexto/decisão:** a regra crítica da Fase 3 foi aplicada no backend: OM
`preventiva_com_parada` não pode avançar para `aprovada`/execução/conclusão sem
registro prévio em `sg_client_approvals`. O registro da aprovação atualiza a OM
de `aguardando_aprovacao` para `aprovada`.

**Alterações (backend):**
- `sentinelgrid/src/validators/maintenanceOrderValidators.js` — adiciona schemas para aprovação e transição de status.
- `sentinelgrid/src/repositories/maintenanceOrdersRepository.js` — adiciona `createApproval` e `transitionOrderStatus`, com bloqueio para preventiva com parada sem aprovação.
- `sentinelgrid/src/routes/maintenanceOrders.js` — adiciona `POST /:id/approvals` e `POST /:id/status`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/maintenanceOrders.ts` — adiciona tipos/funções de aprovação e transição.
- `frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx` — adiciona ações de alterar status e aprovar parada, com modais dedicados.

**Migrations/DB:** sem nova migration; reutiliza `sg_client_approvals` criada em `011_maintenance_orders.sql`.

**Como validar (feito):** `node --check` nos arquivos backend alterados ✅; ciclo repository no host e no container confirmou bloqueio de `preventiva_com_parada` sem aprovação, registro de aprovação, status `aprovada` e transição para `em_execucao` ✅; `npm --prefix frontend run build` ✅; rota SPA `/app/sentinelgrid/maintenance-orders` respondeu 200 ✅.

**Pendências/próximo passo:** gerar OM a partir dos planos de equipamento e itens do plano, preservando vínculo com checklist quando selecionado.

### 2026-07-02 — Fase 3 · Fatia 3.3: Gerar OM a partir do plano

**Status:** ✅ concluída (backend, migration e build React validados)
**Contexto/decisão:** a OM gerada por plano agora preserva a rastreabilidade do
plano e do item de plano que originaram a ordem. Foi adicionado `plan_item_id` em
`sg_maintenance_orders` para evitar depender apenas do texto do escopo.

**Alterações (backend):**
- `sentinelgrid/migrations/012_order_plan_item.sql` — adiciona `plan_item_id` em `sg_maintenance_orders`.
- `sentinelgrid/src/validators/maintenanceOrderValidators.js` — adiciona schema de geração por plano.
- `sentinelgrid/src/repositories/maintenanceOrdersRepository.js` — adiciona `createOrderFromPlan`, resolve plano ativo + item e gera OM com hierarquia/equipamento/status derivados.
- `sentinelgrid/src/routes/maintenanceOrders.js` — adiciona `POST /from-plan`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/maintenanceOrders.ts` — adiciona tipo/função `createMaintenanceOrderFromPlan`.
- `frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx` — adiciona modal "Gerar por plano", seleção de plano, item, checklist, data planejada e prioridade.

**Migrations/DB:** `012_order_plan_item.sql` aplicada no host e no container `app`.

**Como validar (feito):** `node --check` nos arquivos backend alterados ✅; `node sentinelgrid/migrate.js` ✅; `docker compose exec app node sentinelgrid/migrate.js` ✅; ciclo repository no host e no container criou plano com item e gerou OM com `plan_id`, `plan_item_id`, escopo e data planejada derivados ✅; `npm --prefix frontend run build` ✅; rota SPA `/app/sentinelgrid/maintenance-orders` respondeu 200 ✅.

**Pendências/próximo passo:** fechar regras de conclusão/cancelamento e preparar a Fase 4 de execução técnica (checklist executado, medições, peças e anexos).

### 2026-07-02 — Fase 3 · Fatia 3.4: Regras de conclusão

**Status:** ✅ concluída (backend e build React validados)
**Contexto/decisão:** fechamento da Fase 3 com regras de encerramento no backend.
Conclusão de OM exige `final_condition`; OM corretiva só conclui com sintoma,
alarme, impacto operacional, causa e ação tomada. A UI de transição passou a enviar
condição final e observação quando o status escolhido é de conclusão.

**Alterações (backend):**
- `sentinelgrid/src/validators/maintenanceOrderValidators.js` — transição de status aceita `finalCondition` e `notes`.
- `sentinelgrid/src/repositories/maintenanceOrdersRepository.js` — bloqueia conclusão sem condição final e bloqueia corretiva incompleta.
- `sentinelgrid/src/routes/maintenanceOrders.js` — retorna erro de domínio `SG_ORDER_COMPLETION_INVALID`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/maintenanceOrders.ts` — adiciona `SgOrderStatusInput` no contrato de transição.
- `frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx` — modal de status exibe condição final e observação para conclusão.

**Migrations/DB:** sem nova migration.

**Como validar (feito):** `node --check` nos arquivos backend alterados ✅; ciclo repository no host e no container confirmou bloqueio de conclusão sem condição final, bloqueio de corretiva sem campos obrigatórios e conclusão com dados completos ✅; `npm --prefix frontend run build` ✅; rota SPA `/app/sentinelgrid/maintenance-orders` respondeu 200 ✅.

**Pendências/próximo passo:** iniciar **Fase 4 — Execução técnica** com checklist executado, medições, peças substituídas e anexos.

### 2026-07-02 — Fase 4 · Fatia 4.1: Execução de checklist da OM

**Status:** ✅ concluída (backend, migration e build React validados)
**Contexto/decisão:** início da execução técnica pelo checklist, por ser o vínculo
mais direto com o planejamento já implementado. A OM usa o `checklist_id` vinculado
e os resultados são persistidos por item, permitindo salvar status, valor e notas
sem ainda bloquear o fluxo de medição/peças/anexos.

**Alterações (backend):**
- `sentinelgrid/migrations/013_order_checklist_results.sql` — cria `sg_order_checklist_results`, índice por OM/status e unicidade por `order_id + checklist_item_id`.
- `sentinelgrid/src/validators/orderExecutionValidators.js` — schema zod para resultado de checklist.
- `sentinelgrid/src/repositories/orderExecutionRepository.js` — busca execução de checklist da OM e faz upsert de resultado por item.
- `sentinelgrid/src/routes/orderExecution.js` — adiciona `GET/POST /maintenance-orders/:orderId/checklist-results`.
- `sentinelgrid/src/routes/maintenanceOrders.js` — monta subrotas de execução por OM.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/orderExecution.ts` — client tipado para execução de checklist.
- `frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx` — ação "Executar checklist" e modal para preencher status/valor/notas item a item.

**Migrations/DB:** `013_order_checklist_results.sql` aplicada no host e no container `app`.

**Como validar (feito):** `node --check` nos novos arquivos backend ✅; `node sentinelgrid/migrate.js` ✅; `docker compose exec app node sentinelgrid/migrate.js` ✅; ciclo repository no host e no container criou OM com checklist, carregou itens, salvou resultado e releu status/valor ✅; `npm --prefix frontend run build` ✅; rota SPA `/app/sentinelgrid/maintenance-orders` respondeu 200 ✅.

**Pendências/próximo passo:** implementar medições técnicas da OM (`sg_measurements`) e depois peças substituídas/anexos.

### 2026-07-02 — Fases 4-8 · MVP operacional

**Status:** ✅ concluída (backend, migrations, build React e rotas SPA validados)
**Contexto/decisão:** avanço concentrado das fases 4 a 8 com uma camada operacional
única para preservar rastreabilidade por equipamento e por OM. A implementação
cria o núcleo de execução técnica, relatório associado, calendário, eventos,
histórico e indicadores sem acoplar o módulo ao fluxo legado do Report Service.

**Alterações (backend):**
- `sentinelgrid/migrations/014_operations_reports_calendar_history.sql` — cria `sg_measurements`, `sg_replaced_parts`, `sg_attachments`, `sg_associated_reports`, `sg_events`, `sg_equipment_history` e `sg_calendar_entries`.
- `sentinelgrid/src/validators/operationsValidators.js` — schemas zod para medições, peças, relatórios associados, eventos, anexos e geração de calendário.
- `sentinelgrid/src/repositories/operationsRepository.js` — CRUD/listagens operacionais, geração de calendário anual, prontuário do equipamento e agregações do dashboard.
- `sentinelgrid/src/routes/operations.js` — endpoints `/measurements`, `/parts`, `/reports`, `/attachments`, `/events`, `/history`, `/calendar`, `/calendar/generate` e `/dashboard`.
- `sentinelgrid/src/routes/apiV2.js` — monta o router operacional dentro da façade `/admin/api/v2/sentinelgrid`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/operations.ts` — client tipado para operações, calendário, histórico e dashboard.
- `frontend/src/pages/sentinelgrid/CalendarPage.tsx` — tela de calendário com filtros por ano/mês e ação de gerar ano.
- `frontend/src/pages/sentinelgrid/HistoryPage.tsx` — prontuário por equipamento.
- `frontend/src/pages/sentinelgrid/DashboardPage.tsx` — indicadores de equipamentos, OMs, atrasos, eventos e relatórios.
- `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — rotas e navegação para calendário, histórico e dashboard.

**Migrations/DB:** `014_operations_reports_calendar_history.sql` aplicada no host e no container `app`.

**Como validar (feito):** `node --check` nos novos arquivos backend ✅; `node sentinelgrid/migrate.js` ✅; `docker compose exec app node sentinelgrid/migrate.js` ✅; smoke test repository criou OM, medição, peça substituída, relatório associado, evento, anexo, calendário e histórico ✅; `cmd /c npm --prefix frontend run build` ✅; rotas SPA `/app/sentinelgrid/dashboard`, `/app/sentinelgrid/calendar` e `/app/sentinelgrid/history` responderam 200 ✅.

**Pendências/próximo passo:** aprofundar UX de execução técnica dentro da OM (formularios dedicados para medições/peças/anexos), regras de status do calendário e, depois, iniciar Fase 9 (mobile/integrações).

### 2026-07-02 — Fases 4-8 · Complemento de execução e recomendações

**Status:** ✅ concluída (backend, migration, smoke test, build React e rotas SPA validados)
**Contexto/decisão:** fechamento das lacunas do MVP operacional: recomendações
técnicas deixam de ser texto solto e passam a ser entidade rastreável; a OM passa
a ter uma ação direta de execução técnica para registrar medição, peça, relatório
associado e anexo sem sair da lista de ordens.

**Alterações (backend):**
- `sentinelgrid/migrations/015_recommendations.sql` — cria `sg_recommendations`, com vínculo para equipamento, OM e relatório associado.
- `sentinelgrid/src/validators/operationsValidators.js` — adiciona schemas de criação e mudança de status de recomendação.
- `sentinelgrid/src/repositories/operationsRepository.js` — adiciona `listRecommendations`, `createRecommendation`, `updateRecommendationStatus`, histórico automático e indicadores de recomendações no dashboard.
- `sentinelgrid/src/routes/operations.js` — adiciona `GET/POST /recommendations` e `PUT /recommendations/:id/status`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/operations.ts` — adiciona contratos de recomendações, anexos e KPIs de recomendações.
- `frontend/src/pages/sentinelgrid/RecommendationsPage.tsx` — nova tela de criação, filtro e alteração de status de recomendações.
- `frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx` — adiciona ação "Execução técnica" com formulários de medição, peça substituída, relatório associado e anexo.
- `frontend/src/pages/sentinelgrid/DashboardPage.tsx` — adiciona KPIs de recomendações abertas e críticas.
- `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — rota e navegação para Recomendações.

**Migrations/DB:** `015_recommendations.sql` aplicada no host e no container `app`.

**Como validar (feito):** `node --check` nos arquivos backend alterados ✅; `node sentinelgrid/migrate.js` ✅; `docker compose exec app node sentinelgrid/migrate.js` ✅; smoke test repository criou recomendação vinculada à OM, alterou status, atualizou histórico e dashboard ✅; `cmd /c npm --prefix frontend run build` ✅; rotas SPA `/app/sentinelgrid/recommendations` e `/app/sentinelgrid/maintenance-orders` responderam 200 ✅.

**Pendências/próximo passo:** evoluir regras de calendário (`status`, geração de OM a partir de entrada do calendário e reprogramação) e iniciar integração/mobile da Fase 9 quando a UX web for validada no navegador.

### 2026-07-02 — Verificação (auditoria) das Fases 0–8 + logo animado

**Status:** ✅ auditoria concluída
**Contexto/decisão:** verificação independente de que as fases implementadas estão
de fato concluídas e conectadas (não só presentes).

**Verificado (tudo verde):**
- **15 migrations aplicadas** no banco (`001`–`015`), **28 tabelas `sg_*`**.
- Backend carrega e monta **15 grupos de rotas**; `orderExecution` aninhado em `/maintenance-orders/:orderId` (checklist-results).
- **22 endpoints GET (F1–F8) → 200** (sem 5xx/404).
- **Escritas F4–F8** exercitadas: measurements/parts/attachments (201), reports (201), events (201), calendar/generate (201), recommendation status (200), checklist-results (201 quando o item pertence ao checklist da OM — regra de negócio validada; 400 legítimo caso contrário).
- **Núcleo F3 (máquina de estados)**: transição válida 200; conclusão sem condição final → 409; corretiva sem sintoma/impacto → 400 (§28.8).
- **Frontend compila** (typecheck) — 15 páginas geram chunk; todas roteadas em `App.tsx` e no menu lateral.

**Conclusão:** Fases **0–8 concluídas e funcionais**. Fase 9 (mobile/API keys) não iniciada.

**Não coberto:** clique tela-a-tela no navegador (runtime da UI). Lembrete: no Docker/Windows o nodemon não recarrega sozinho — `docker restart vextromplatform-docker-app-1` após mudanças de backend.

**Extra (UI):** `frontend/src/styles/theme.css` — logo Vextrom ampliado (container 54px, imagem 38px) com animação contínua de tom (`@keyframes vx-logo-hue`, hue-rotate 6s linear infinite) + guarda `prefers-reduced-motion`; tamanhos do modo recolhido ajustados.

<!-- Próximas entradas abaixo desta linha -->
