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
| 10 | Mapa Calendário de Manutenção | ✅ concluída (backend validado; UI aguardando navegador) |
| 11 | Integração Service Report (Enviar OM → OS) | ✅ concluída (núcleo; UI aguardando navegador) |
| 12 | Grupos de equipamentos por site | ✅ concluída (backend validado; UI aguardando navegador) |

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

### 2026-07-03 — Fase 1 (ajuste) · Gestor do cliente com escopo de Área

**Status:** ✅ concluída (backend + build validados)
**Contexto/decisão:** cada área pode ter gestor(es) diferente(s), então o gestor ganha um
escopo opcional de **área** (além do site). Aditivo/nullable — não muda gestores existentes.

**Alterações (backend):**
- `sentinelgrid/migrations/021_manager_area.sql` — `area_id` (FK `sg_areas`, ON DELETE SET NULL) + índice.
- `sentinelgrid/src/validators/clientManagerValidators.js` — `areaId` (nullable positivo).
- `sentinelgrid/src/repositories/clientManagersRepository.js` — join `sg_areas` (`area_name`) + `area_id` no insert/update.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/managers.ts` — `area_id`/`area_name` + `areaId`.
- `frontend/src/pages/sentinelgrid/ManagementPage.tsx` — select **Área (opcional)** no form de gestor (filtrado pelo site; reseta ao trocar cliente/site), coluna Área na tabela; `ManagementPage` carrega áreas e passa à seção.

**Migrations/DB:** `021_manager_area.sql`.
**Como validar (feito):** `node --check` ✅; migrate aplicou `021` ✅; `npm --prefix frontend run build` ✅; app reiniciado sobe sem erro.

### 2026-07-03 — Fase 11 (complemento) · TAG filtrada por cliente + autopreenchimento do equipamento

**Status:** ✅ concluída (frontend; build validado)
**Contexto/decisão:** no cadastro de equipamento do SG, as sugestões de TAG passam a ser
**filtradas pelo cliente selecionado** (SG por `client_id`; RS por `customer_name` = nome do
cliente). Ao escolher uma TAG existente, o form é **autopreenchido** a partir do equipamento
correspondente: prioriza o do SG (todos os campos); senão o do RS, mapeando `serial_number`→Nº
de série, `power`→Potência, notas e tipo/fabricante/modelo (nome RS → id do catálogo SG). Não
altera a localização (cliente/site/área) já escolhida. Tudo no frontend — isolamento mantido.

**Alterações (frontend):**
- `frontend/src/pages/sentinelgrid/EquipmentsPage.tsx` — `tagOptions` filtrado pelo cliente do form; `applyTagMatch(tag)` no `onChange` do campo TAG (autofill).

**Migrations/DB:** nenhuma. **Como validar:** `npm --prefix frontend run build` ✅.

### 2026-07-03 — Fase 10 (ajuste) · Reset do silêncio de 24h dos alertas

**Status:** ✅ concluída (backend + build validados)
**Contexto/decisão:** o popup de alertas some por 24h após o "Ciente" (chave Redis
`sg:alert:ack:<user>`). Adicionada a opção de **reset** — limpa o ack e o popup volta.

**Alterações (backend):**
- `sentinelgrid/src/routes/alerts.js` — `DELETE /alerts/ack` (apaga a chave; Redis fora → já é não-ciente).

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/alerts.ts` — `resetAlertAck()`.
- `frontend/src/pages/sentinelgrid/AlertsPage.tsx` — banner "🔕 silenciado por 24h · até <data>" com botão **"Reativar aviso agora"** (só quando está silenciado); usa a mesma query key do popup (`["sentinelgrid","alerts","ack"]`), então reativa na hora.

**Migrations/DB:** nenhuma.

**Como validar (feito):** `node --check` ✅; `npm --prefix frontend run build` ✅; app reiniciado
sobe sem erro. No navegador: após "Ciente" no calendário, a tela de Alertas mostra o banner
com "Reativar aviso agora" → o popup volta a aparecer no calendário.

### 2026-07-03 — Fase 11 (complemento) · Sugestão cruzada de cadastros (cliente/equipamento)

**Status:** ✅ concluída (frontend; build validado)
**Contexto/decisão:** ao cadastrar cliente/equipamento em qualquer módulo, sugerir os já
existentes **nos dois módulos** (evita divergência de grafia; critério de igualdade = nome).
**Isolamento mantido (req. 1):** solução **100% no frontend** — cada módulo continua lendo só
o seu banco pela sua própria API; o browser **junta** as duas listas num `<datalist>` (merge
por nome, case-insensitive). Zero mudança de backend, nenhum join cross-DB. Critério: **nome
do cliente** (itens 2–4) e **TAG do equipamento** (item 5; SG `tag` ↔ RS `tag_number`).

**Alterações (frontend):**
- `frontend/src/utils/suggest.ts` — `mergeNames(...)` (dedup case-insensitive + ordena).
- `frontend/src/pages/sentinelgrid/ClientsPage.tsx` — datalist de nomes (SG clients + RS customers) nos campos Nome (novo/editar).
- `frontend/src/pages/CustomersPage.tsx` (RS) — datalist de nomes (RS customers + SG clients).
- `frontend/src/pages/sentinelgrid/EquipmentsPage.tsx` — datalist de TAGs (SG tag + RS tag_number).
- `frontend/src/pages/EquipmentsPage.tsx` (RS) — datalist de TAGs (RS tag_number + SG tag).

**Migrations/DB:** nenhuma.

**Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck; hooks das novas
queries movidos para antes dos early returns). Validação visual no navegador pendente: ao
digitar no campo Nome (cliente) ou TAG (equipamento), aparece a lista dos dois módulos.

**Nota:** a sugestão é auxílio de digitação (não força a igualdade). Se quiser, um passo
futuro é, ao escolher um nome já existente no outro módulo, vincular via `external_ref`
(reusando a estratégia da Fase 11) para de fato correlacionar os registros.

### 2026-07-03 — Fase 12 · Grupos de equipamentos por site (facilita gerar planos)

**Status:** ✅ concluída (backend validado por smoke test; UI compila, aguardando navegador)
**Contexto/decisão:** grupo de equipamentos **por site** para agilizar a criação de planos
("gerar para todos do grupo"). Decisões do usuário: gestão **na página de Equipamentos**
(seleção → adicionar ao grupo) e geração **pelo "Gerar Planos" do programa** (seletor de
grupo que marca os membros dentro do escopo). Membros restritos ao site do grupo (validado
no repositório — equipamentos de outro site são descartados no add).

**Alterações (backend):**
- `sentinelgrid/migrations/020_equipment_groups.sql` — `sg_equipment_groups` (site_id, nome único por site) + `sg_equipment_group_members` (PK group+equip).
- `sentinelgrid/src/validators/equipmentGroupValidators.js` — schemas de grupo e de membros.
- `sentinelgrid/src/repositories/equipmentGroupsRepository.js` — list/get(+members)/create/update/softDelete; `addMembers` (só equipamentos do mesmo site → retorna `added`/`skippedWrongSite`), `removeMember`; `member_count` por grupo.
- `sentinelgrid/src/routes/equipmentGroups.js` — CRUD + `POST/DELETE /:id/members`; montado em `/equipment-groups`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/equipmentGroups.ts` — client tipado.
- `frontend/src/pages/sentinelgrid/EquipmentGroupsModals.tsx` — `AddToGroupModal` (grupo novo/existente do site) + `GroupsModal` (lista, membros, remover, excluir).
- `frontend/src/pages/sentinelgrid/EquipmentsPage.tsx` — seleção por checkbox, barra "Adicionar ao grupo" (só mesmo site), botão "Grupos".
- `frontend/src/pages/sentinelgrid/GeneratePlansModal.tsx` — seletor "Selecionar por grupo…" que marca os membros **dentro do escopo** do programa (nota dos que ficaram de fora).

**Migrations/DB:** `020_equipment_groups.sql`.

**Como validar (feito):** `node --check` ✅; migrate SG aplicou `020` ✅; smoke test no container ✅
— cria grupo, `addMembers` só entra equipamentos do mesmo site (added=2, skippedWrongSite=0),
`member_count`/`getGroup` corretos, `removeMember` ok, cleanup. `npm --prefix frontend run build` ✅.
App reiniciado sobe sem erro.

**Pendências/próximo passo:** validação visual no navegador (Equipamentos → seleção → "Adicionar
ao grupo"; "Gerar planos" → "Selecionar por grupo"). Futuro opcional: filtrar o dropdown de grupos
do "Gerar Planos" por site, e renomear grupo pela UI.

### 2026-07-03 — Fase 11 · Integração Service Report ↔ SentinelGrid (PLANEJAMENTO)

**Status:** ⬜ planejada
**Contexto/decisão:** "Enviar OM" a partir do Mapa Calendário cria uma **OS no Service
Report** com o equipamento vinculado. **Princípios (não quebrar nada):** integração só
por **contrato/API** — SentinelGrid **não** acessa o banco `reportservice` (ADR-001/005);
reusa o `internalIntegrationService` (HTTP interno para `APP_BASE_URL`) ou uma façade de
integração exportada pelo RS. Mudanças no RS são **aditivas** (colunas nullable + upsert
por referência externa); o ciclo de vida da OM não muda (status `agendada` já existe).

#### Levantamento (o que já existe)
- **RS OS:** `service_report_orders` (cliente+site → `service_order_code`, cria report). Endpoint `POST /api/report-service/orders` (`createOrder`).
- **RS equipamento:** `service_report_equipments` (ligado a cliente/site). Vínculo OS↔equip: `service_report_order_equipments` (único por `(service_order_id, equipment_id)`), via `POST /orders/:id/equipments` (`attachOrderEquipment`).
- **SG OM:** `sg_maintenance_orders` (1 equipamento por OM; `status` inclui `agendada`); o Mapa já expõe eventos `om_manutencao` com `status`.
- **Sem referência externa** entre módulos hoje.

#### A) Regras de negócio (spec)
- **A.1 Gatilho:** no Mapa, eventos `om_manutencao` com `status = agendada` habilitam a ação **"Enviar OM"** no dia.
- **A.2 Confirmação:** modal de confirmação antes de enviar (mostra OM, equipamento, cliente/site, data).
- **A.3 Efeito:** cria **1 OS no RS** com título = `order_number` + escopo da OM; **vincula o equipamento** da OM à OS. Idempotente: se a OM já foi enviada, reabre/retorna a OS existente (não duplica).
- **A.4 Rastreabilidade:** grava na OM o vínculo com a OS (`rs_service_order_id`, `sent_at`); mantém mapeamento de cliente/site/equipamento entre módulos.
- **A.5 Isolamento:** toda escrita no RS passa pela API do RS; SG nunca toca `reportservice` diretamente.

#### B) Item 4 — Estratégia de unicidade de equipamento entre módulos (RECOMENDAÇÃO)
Cada módulo mantém **seu próprio cadastro** (isolamento preservado); a unicidade entre
módulos vem de uma **referência externa** (ADR-004), com "ensure-or-create" idempotente.
- **Master:** SentinelGrid é a fonte de verdade do equipamento no domínio de manutenção.
- **No RS (aditivo):** `service_report_equipments` (e `customers`/`sites`) ganham `external_source TEXT` + `external_id TEXT` e **índice único parcial** `(external_source, external_id)`. "Ensure-or-create by external ref" → 1 equipamento RS por equipamento SG (sem duplicar).
- **No SG:** tabela de mapeamento `sg_rs_links (entity_type, sg_id, rs_id, UNIQUE(entity_type, sg_id))` — evita poluir as tabelas de domínio e guarda os ids do RS para reuso.
- **Unicidade "por módulo":** cada base continua com seu id próprio; o par `external_ref` garante correlação 1:1 e impede duplicação no envio.
- **Alternativas descartadas:** (b) correlacionar por `serial_number`/`tag` (natural key) — frágil/ambíguo; (c) tabela de equipamento compartilhada — **quebra o isolamento** (ADR-001).

#### C) Plano de fatias
- **11.1 — RS: referência externa + upsert idempotente.** Migration RS: `external_source`/`external_id` (+ índice único) em `service_report_equipments`, `service_report_customers`, `service_report_sites`. `serviceReportService`: `ensureCustomerByRef`/`ensureSiteByRef`/`ensureEquipmentByRef` (cria só na 1ª vez). Sem mudança nos fluxos atuais (colunas nullable).
- **11.2 — SG: mapeamento + serviço de envio.** Migrations SG: `sg_rs_links`; colunas `rs_service_order_id`/`sent_at` em `sg_maintenance_orders`. `integrationService.sendOrderToReportService(omId, actor)`: valida OM `agendada`; via HTTP-contrato garante customer/site/equipment no RS; cria OS (title = OM); attach equipment; grava `sg_rs_links` + carimba a OM. Idempotente (reusa mapeamento/OS).
- **11.3 — SG: rota façade.** `POST /maintenance-orders/:id/send-to-report-service` (só `agendada`; já enviada → retorna a OS existente). Erros de integração → mensagem clara, sem efeitos parciais (best-effort transacional no lado SG; no RS, upsert idempotente).
- **11.4 — Frontend.** No Mapa (visão Dia/card do evento): botão **"Enviar OM"** para `om_manutencao`/`agendada`; **modal de confirmação**; ao confirmar chama a rota; sucesso → link para a OS no Service Report; bloqueia/《reabre》se já enviada.

#### D) Transporte (ADR-003, a confirmar)
Reusar `internalIntegrationService` (HTTP para `APP_BASE_URL` + `/api/report-service/...`).
**A definir:** autenticação da chamada interna (sessão admin propagada vs. token/serviço
interno) — o RS apiV2 hoje roda sob a auth do painel.

**Migrations/DB previstas:** RS (external_ref nas 3 tabelas); SG (`sg_rs_links`, colunas na OM). Todas aditivas/nullable.

**Como validar (previsto):** upsert por external ref não duplica (2ª chamada reusa); enviar OM `agendada` cria OS + vincula equipamento; reenvio retorna a mesma OS; regras atuais do RS e da OM intactas.

**Decisões (2026-07-03):**
1. ✅ **Item 4 — Referência externa + mapeamento** (SG master; `external_source`/`external_id` únicos no RS; `sg_rs_links` no SG; ensure-or-create idempotente). Descartadas: natural key por serial/tag e cadastro compartilhado.
2. ✅ **Reenvio — reabrir a OS existente** (não duplica; retorna/abre a OS já criada para a OM).
3. ⏳ **Cliente/Site no RS:** proposto criar automaticamente a partir do nome do SG na 1ª vez (via external_ref) — confirmar na 11.1.
4. ⏳ **Transporte/auth** da chamada interna RS (ADR-003) — validar na 11.1 (sessão admin propagada vs. token interno).
5. ⏳ **Múltiplos equipamentos** (OS por site, juntando OMs do mesmo site+data) — fatia futura; agora 1 OM → 1 OS com 1 equipamento.

**Pendências/próximo passo:** iniciar **11.1** (referência externa + upsert idempotente no RS), aditiva e base da idempotência; depois 11.2 (mapeamento + serviço de envio no SG), 11.3 (rota) e 11.4 (UI "Enviar OM" no Mapa).

### 2026-07-03 — Fase 11 · Fatia 11.1: Referência externa + ensure-or-create no Service Report

**Status:** ✅ concluída (backend RS validado por smoke test; aditivo, não altera fluxos atuais)
**Contexto/decisão:** base idempotente da integração (ADR-004). Colunas `external_source`/
`external_id` (com índice único parcial) em cliente/site/equipamento do RS; funções
`ensure*ByRef` que reusam o registro quando a referência externa já existe e só criam na
1ª vez. Registros manuais existentes ficam com referência vazia — nada muda para eles.

**Alterações (Service Report):**
- `report_service/migrate.js` — `external_source`/`external_id` + `CREATE UNIQUE INDEX … WHERE external_source <> '' AND external_id <> ''` em `service_report_customers`, `service_report_customer_sites`, `service_report_equipments` (aditivo/idempotente).
- `report_service/src/repositories/serviceReportRepository.js` — `getByExternalRef` + `getCustomerByExternalRef`/`getSiteByExternalRef`/`getEquipmentByExternalRef`; `createCustomer`/`createSite`/`createEquipment` passam a gravar `external_source`/`external_id` (default `''`).
- `report_service/src/services/serviceReportService.js` — `ensureCustomerByRef`/`ensureSiteByRef`/`ensureEquipmentByRef` (ensure-or-create idempotente).

**Migrations/DB:** colunas + índices únicos aplicados no banco `reportservice` (via `report_service/migrate.js`).

**Como validar (feito):** `node --check` nos 3 arquivos ✅; migrate RS aplicado ✅; smoke test
no container ✅ — 1ª chamada cria (created=true), 2ª **reusa o mesmo id** (created=false) para
cliente, site e equipamento; `external_source`/`external_id` gravados; cleanup ok. App
reiniciado sobe sem erro.

**Pendências/próximo passo:** **11.2** — SG: `sg_rs_links` + colunas `rs_service_order_id`/`sent_at`
na OM + `integrationService.sendOrderToReportService(omId)` chamando o RS por contrato
(HTTP interno) para ensure entidades → criar OS (title = OM) → vincular equipamento → gravar
mapeamento; reenvio reabre a OS. Validar transporte/auth (ADR-003) aqui.

### 2026-07-03 — Fase 11 · Fatia 11.2: Mapeamento + serviço de envio (SG → OS no RS)

**Status:** ✅ concluída (E2E validado no container)
**Contexto/decisão:** **Transporte (ADR-003 resolvido para já): in-process, remote-ready.**
A apiV2 do RS roda sob `requireAdminAuth` (`/admin/report-service`) e o `internalIntegrationService`
(HTTP) não é usado por ninguém — HTTP interno exigiria propagar sessão admin (frágil). Como
o app é um único processo Node, o SG consome o **contrato de serviço do RS in-process**
(`serviceReportService.*`), **nunca** o banco/repo do RS (ADR-001/005). Tudo isolado atrás do
`reportServiceIntegration` do SG — trocável por HTTP no futuro sem mexer nos chamadores.

**Alterações (Service Report):**
- `report_service/src/services/serviceReportService.js` — `linkOrderEquipment(orderId, equipmentId, notes)` (wrapper de serviço sobre `repo.attachEquipmentToOrder`, idempotente por `(service_order_id, equipment_id)`).

**Alterações (SentinelGrid):**
- `sentinelgrid/migrations/019_report_service_links.sql` — `sg_rs_links (entity_type, sg_id, rs_id, PK)` + `rs_service_order_id`/`rs_service_order_code`/`rs_sent_at` em `sg_maintenance_orders`.
- `sentinelgrid/src/services/reportServiceIntegration.js` — `sendOrderToReportService(orderId, actor)`: valida OM `agendada`; ensure cliente/site/equipamento no RS por referência externa; cria OS (title = `order_number` + escopo); vincula equipamento; grava `sg_rs_links` + carimba a OM (transação SG). **Reenvio → reabre a OS** (via `rs_service_order_id`).

**Migrations/DB:** `019_report_service_links.sql` no SG; sem nova migration no RS.

**Como validar (feito):** `node --check` ✅; migrate SG aplicou `019` ✅; smoke E2E no container ✅
— OM `agendada` → **SEND1 cria OS** (`OS-SBMD-2026-239`, reused=false) com **1 equipamento
vinculado**; **SEND2 reabre a mesma OS** (reused=true, mesmo id); cleanup ok. App reiniciado
sobe sem erro.

**Nota (robustez):** ensure* (cliente/site/equip) são idempotentes; `createOrder` do RS não é.
Há uma janela mínima entre criar a OS e carimbar a OM (bancos distintos, sem transação
cross-DB): num crash exatamente nesse ponto, um novo envio criaria outra OS. Hardening
opcional futuro: referência externa também em `service_report_orders` (`ensureOrderByRef`).

**Pendências/próximo passo:** **11.3** — rota `POST /maintenance-orders/:id/send-to-report-service`
(façade); **11.4** — botão "Enviar OM" + confirmação no Mapa, com link para a OS.

### 2026-07-03 — Fase 11 · Fatias 11.3 + 11.4: Rota + UI "Enviar OM" (FASE 11 — NÚCLEO CONCLUÍDO)

**Status:** ✅ concluída (backend validado; UI compila, aguardando navegador)
**Contexto/decisão:** expõe o envio como rota da façade e adiciona o gatilho no Mapa. A ação
só aparece para eventos `om_manutencao` com `status = agendada` (item 1). Confirmação antes
de enviar (item 2). Ao confirmar, cria/reabre a OS e vincula o equipamento (item 3), com link
para abrir a OS no Service Report.

**Alterações (backend):**
- `sentinelgrid/src/routes/maintenanceOrders.js` — `POST /:id/send-to-report-service` → `reportServiceIntegration.sendOrderToReportService`; erros mapeados: `SG_ORDER_INVALID`→404, `SG_ORDER_NOT_SCHEDULED`→409, `statusCode` do RS repassado.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/maintenanceOrders.ts` — `sendOrderToReportService(orderId)`.
- `frontend/src/pages/sentinelgrid/CalendarPage.tsx` — no `EventCard`: botão **"Enviar OM"** (só `om_manutencao`/`agendada`), passo de **confirmação** inline, feedback com o código da OS e link **"Abrir OS"** (`/orders/:id/editor`). Invalida map-events/alerts após envio.

**Migrations/DB:** nenhuma.

**Como validar (feito):** `node --check` na rota ✅; app reiniciado sobe sem erro ✅;
`npm --prefix frontend run build` ✅. O caminho de serviço já foi validado E2E na 11.2
(cria OS + vincula equipamento; reenvio reabre). Falta o clique tela-a-tela no navegador.

---

## ✅ FASE 11 (Integração Service Report — núcleo) CONCLUÍDA

Entregue: **11.1** referência externa + `ensure*ByRef` idempotente no RS; **11.2** `sg_rs_links`
+ carimbo na OM + `sendOrderToReportService` (in-process, contrato de serviço do RS —
remote-ready, ADR-003); **11.3** rota façade; **11.4** botão "Enviar OM" + confirmação no Mapa.
Itens do pedido cobertos: (1) ação no dia para OM `agendada`; (2) confirmação; (3) cria OS com
título da OM + vincula equipamento; (4) unicidade por módulo via referência externa + `sg_rs_links`
(SG master), sem duplicar. **Isolamento preservado** (SG usa só o contrato de serviço do RS).

**Pendências/futuro:** validação visual no navegador; hardening opcional (`ensureOrderByRef` p/
fechar a janela create-OS↔carimbo); **OS por site** (juntar OMs do mesmo site+data numa OS);
avaliar auth/token se algum dia o transporte virar HTTP entre processos.

### 2026-07-03 — Fase 10 (extensão) · Sistema de alertas (popup + tela + ack no Redis)

**Status:** ✅ concluída (backend validado por smoke test E2E; UI aguardando navegador)
**Contexto/decisão:** alertas das ordens/pendências em prazo de manutenção. Reusa o motor
do Mapa (10.1–10.3): "alerta" = evento com prioridade acima de `informativo` (próxima,
vencida, corretiva, aprovação pendente, recomendação crítica, relatório pendente,
equipamento restrito), ordenado por prioridade. **Popup** ao abrir o Calendário, com
estado de "ciente" **no Redis por 24h** (some por 24h após o usuário confirmar). **Tela**
`/sentinelgrid/alerts` lista tudo por prioridade. Redis é infra compartilhada (ADR-002);
degrada em silêncio se estiver fora (considera não-ciente).

**Alterações (backend):**
- `sentinelgrid/src/redis.js` — client ioredis do módulo (reusa `env.redis.url`).
- `sentinelgrid/src/repositories/calendarMapRepository.js` — `listAlerts(filters)` (filtra prioridade ≠ informativo, ordena por prioridade/atraso/data, conta por prioridade).
- `sentinelgrid/src/routes/alerts.js` — `GET /alerts`, `GET/POST /alerts/ack` (chave `sg:alert:ack:<user>`, TTL 24h; janela de −1 ano a +1 ano).
- `sentinelgrid/src/routes/apiV2.js` — monta `/alerts`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/calendarMap.ts` — `EVENT_KIND_LABEL`.
- `frontend/src/api/sentinelgrid/alerts.ts` — `listAlerts`/`getAlertAck`/`ackAlerts`.
- `frontend/src/pages/sentinelgrid/AlertsPage.tsx` — tela de lista por prioridade (contadores + tabela).
- `frontend/src/pages/sentinelgrid/CalendarPage.tsx` — popup ao abrir (mostra top 10, "Ver todos", "Ciente por 24h" → ack no Redis).
- `frontend/src/App.tsx`, `Layout.tsx`, `SentinelHomePage.tsx` — rota/menu/link "Alertas".

**Migrations/DB:** nenhuma (estado de ciente vive no Redis).

**Como validar (feito):** `node --check` ✅; smoke test no container ✅ — `ttl` do ack = 86400;
E2E: OM criada a +10 dias → `listAlerts` retornou **1 alerta** (`atencao`, `om_manutencao`,
`proxima`); cleanup ok. `npm --prefix frontend run build` ✅. App reiniciado sobe sem erro
(Redis conecta).

**Pendências/próximo passo:** validação visual no navegador (`/app/sentinelgrid/calendar`
dispara o popup quando há alertas; `/app/sentinelgrid/alerts` lista tudo).

### 2026-07-03 — Fase 2 (ajuste) · Gerar Planos a partir do Programa + calendário anual

**Status:** ✅ concluída (backend validado por smoke test; UI aguardando navegador)
**Contexto/decisão:** ação "Gerar Planos" no Programa que cria planos por equipamento
conforme a **frequência da periodicidade**. Decisões do usuário: (1) equipamentos
**selecionados na hora** dentre os que casam com o escopo do programa; (2) as datas do
ano viram **um item de plano por ocorrência** (ex.: trimestral a partir de 01/09 → 4
itens). A tela mostra um **calendário anual** com as datas preenchidas a partir da data
inicial (horizonte de 12 meses rolando). Motor read-only: sem migration; reusa
`sg_equipment_plans`/`sg_plan_items` e o gerador de calendário existente (que cria 1
entrada por item de plano — agora N por ocorrência).

**Alterações (backend):**
- `sentinelgrid/src/repositories/equipmentRepository.js` — `listByProgramScope(program)` (filtra equipamentos pelos campos de escopo não nulos: tipo/fabricante/modelo/criticidade; contrato restringe pelo cliente).
- `sentinelgrid/src/repositories/equipmentPlansRepository.js` — `generatePlansForProgram({ programId, equipmentIds, dates, actor })` (transação: 1 plano por equipamento + 1 item por data).
- `sentinelgrid/src/validators/maintenanceProgramValidators.js` — `parseGeneratePlansInput` (equipmentIds ≥ 1, dates `YYYY-MM-DD` ≥ 1).
- `sentinelgrid/src/routes/maintenancePrograms.js` — `GET /:id/scope-equipment` e `POST /:id/generate-plans` (equipamento inválido→400, FK→400).

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/programs.ts` — `listProgramScopeEquipment`, `generatePlansFromProgram`, `PERIODICITY_MONTHS`, tipo `SgScopeEquipment`.
- `frontend/src/pages/sentinelgrid/GeneratePlansModal.tsx` — novo: data inicial, ocorrências derivadas da periodicidade, **calendário anual editável** (12 mini-meses; clicar num dia inclui/remove a data; chips removíveis; botão "Recalcular pela periodicidade" re-semeia), seleção de equipamentos do escopo, geração + resumo com link para Planos.
- `frontend/src/pages/sentinelgrid/ProgramsPage.tsx` — ação "Gerar planos" (ícone) por programa ativo, abre o modal.

**Migrations/DB:** nenhuma.

**Como validar (feito):** `node --check` nos arquivos backend ✅; smoke test no container ✅
— programa trimestral (escopo tipo=1/criticidade=media) casou 1 equipamento; `generatePlansForProgram`
criou 1 plano com **4 itens** (01/09, 01/12, 01/03, 01/06); `getPlan` confirmou as datas;
cleanup soft-delete ✅. `npm --prefix frontend run build` ✅. App reiniciado sobe sem erro.

**Pendências/próximo passo:** validação visual no navegador (`/app/sentinelgrid/programs`
→ "Gerar planos"). Opcional futuro: gerar OMs direto do calendário/itens em lote.

### 2026-07-03 — Fase 2 (ajuste) · Período do "Gerar Planos" limitado à vigência do contrato

**Status:** ✅ concluída (backend validado; UI aguardando navegador)
**Contexto/decisão:** quando o programa tem **contrato** vinculado, o calendário e a
geração de datas passam a respeitar `valid_from`/`valid_to` do contrato; sem contrato,
mantém o horizonte de 12 meses. As datas fora da janela do contrato aparecem
desabilitadas (não clicáveis) e o input de data inicial ganha `min`/`max` do contrato.

**Alterações (backend):**
- `sentinelgrid/src/repositories/maintenanceProgramsRepository.js` — `SELECT_COLS` inclui `to_char(ct.valid_from/valid_to,'YYYY-MM-DD')` como `contract_valid_from`/`contract_valid_to` (fluem em `listPrograms`/`getProgram`).

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/programs.ts` — `SgMaintenanceProgram` ganha `contract_valid_from`/`contract_valid_to`.
- `frontend/src/pages/sentinelgrid/GeneratePlansModal.tsx` — janela do contrato limita ocorrências (`computeOccurrences` até o fim), o calendário renderiza os meses do contrato inteiro (teto 36) via `monthsBetween`, dias fora da janela desabilitados, `min`/`max` na data inicial e faixa informativa com o período. Sem contrato: fallback de 12 meses.

**Migrations/DB:** nenhuma.

**Como validar (feito):** `node --check` no repositório ✅; `npm --prefix frontend run build` ✅;
app reiniciado, `listPrograms` retorna `contract_valid_from/to` sem erro (programa sem
contrato → `null`, cai no fallback). Path com contrato aguarda dados/validação visual.

### 2026-07-03 — Fase 2 (ajuste) · Programa com vários intervalos → um plano por intervalo

**Status:** ✅ concluída (backend validado por smoke test; UI aguardando navegador)
**Contexto/decisão:** decisão do usuário — o programa passa a suportar **vários intervalos
de manutenção em meses** (ex.: [1, 3, 12]) e o "Gerar Planos" cria **um plano por intervalo**
para cada equipamento, cada um com seu calendário editável de datas. Intervalos livres em
meses (cobre "2 meses" etc.), mapeados à periodicidade do enum (1→mensal, 3→trimestral,
6→semestral, 12→anual, 24→bienal; demais→personalizada). A `periodicity` base do programa
permanece (compat). **Nota:** o agrupamento "OS por site" (2ª parte do pedido) fica para a
próxima fatia — mexe na geração de Ordens de Serviço, não em "Gerar Planos".

**Alterações (backend):**
- `sentinelgrid/migrations/018_program_intervals.sql` — `plan_intervals_months INTEGER[]` em `sg_maintenance_programs` + backfill a partir da periodicidade.
- `sentinelgrid/src/validators/maintenanceProgramValidators.js` — `planIntervalsMonths` no programa; contrato de geração agora é `{ equipmentIds, plans:[{ intervalMonths, dates }] }`.
- `sentinelgrid/src/repositories/maintenanceProgramsRepository.js` — insert/update incluem `plan_intervals_months`.
- `sentinelgrid/src/repositories/equipmentPlansRepository.js` — `generatePlansForProgram` cria 1 plano por (equipamento × intervalo), `intervalToPeriodicity`/`intervalLabel`.
- `sentinelgrid/src/routes/maintenancePrograms.js` — geração usa `input.plans`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/programs.ts` — `plan_intervals_months`/`planIntervalsMonths`, `GeneratePlanSpec`, `periodicityToMonths`; `generatePlansFromProgram` recebe `plans`.
- `frontend/src/pages/sentinelgrid/ProgramsPage.tsx` — campo "Intervalos de manutenção (meses)" (parse de lista) no formulário.
- `frontend/src/pages/sentinelgrid/GeneratePlansModal.tsx` — seletor de intervalos (um por vez), calendário editável por intervalo, resumo `equipamentos × intervalos`, geração via `plans`.

**Migrations/DB:** `018_program_intervals.sql` aplicada no container `app`.

**Como validar (feito):** `node --check` ✅; migrate aplicou `018` (backfill: programa 3 → `[3]`) ✅;
smoke test no container ✅ — geração com 2 intervalos (1 mês/3 datas + 3 meses/2 datas) criou
**2 planos** ("(mensal)" e "(a cada 3 meses)") com periodicidade e itens corretos; cleanup ok.
`npm --prefix frontend run build` ✅. App reiniciado sobe sem erro.

**Pendências/próximo passo:** **OS por site** — Ordem de Serviço que agrupa, por site+data,
os equipamentos atendidos pelo mesmo plano (mantendo plano/OM por equipamento). Requer
desenho da entidade de OS e da geração a partir do calendário/planos.

### 2026-07-03 — Fase 3 (ajuste) · Gerar OMs em lote a partir dos itens do plano

**Status:** ✅ concluída (backend validado por smoke test; UI aguardando navegador)
**Contexto/decisão:** dois gatilhos para gerar OMs a partir dos **itens** do plano: (1) logo
após "Gerar Planos", perguntar ao usuário se quer gerar as ordens dos itens dos planos
recém-criados; (2) no modal "Gerar OM por plano", opção "todos os itens do plano". Ambos
usam o mesmo endpoint de **lote** (`POST /maintenance-orders/from-plans`, aceita `planIds[]`).
Idempotente por padrão: pula itens que já têm OM (`skipExisting`), evitando duplicar. Cada
OM nasce na `next_due_date` do item, com status inicial derivado (preventiva c/parada →
`aguardando_aprovacao`, etc.).

**Alterações (backend):**
- `sentinelgrid/src/repositories/equipmentPlansRepository.js` — `generatePlansForProgram` agora retorna `planIds` dos planos criados.
- `sentinelgrid/src/repositories/maintenanceOrdersRepository.js` — `createOrdersFromPlans({ planIds, checklistId, priority, scheduledDate, technicianId, clientManagerId, notes, skipExisting })` (1 OM por item; planos inválidos/inativos ignorados; retorna `created/skipped/plans/orderIds`).
- `sentinelgrid/src/validators/maintenanceOrderValidators.js` — `orderFromPlansInputSchema`/`parseOrderFromPlansInput`.
- `sentinelgrid/src/routes/maintenanceOrders.js` — `POST /from-plans`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/programs.ts` — `generatePlansFromProgram` retorna `planIds`.
- `frontend/src/api/sentinelgrid/maintenanceOrders.ts` — `createMaintenanceOrdersFromPlans`.
- `frontend/src/pages/sentinelgrid/GeneratePlansModal.tsx` — após gerar, pergunta "Gerar ordens dos itens?" e chama o lote com os `planIds` criados; mostra o resultado.
- `frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx` — switch "Gerar OMs de todos os itens do plano" no modal (oculta item/data/escopo), faixa de sucesso com a contagem.

**Migrations/DB:** nenhuma.

**Como validar (feito):** `node --check` ✅; smoke test no container ✅ — gerou 2 planos (4 itens),
`createOrdersFromPlans` criou **4 OMs** (skipped 0); reexecução criou **0** (skipped 4 — idempotente);
cleanup ok. `npm --prefix frontend run build` ✅. App reiniciado sobe sem erro.

**Pendências/próximo passo:** validação visual no navegador; depois a **OS por site** (agrupar
as OMs de um site+data numa Ordem de Serviço).

### 2026-07-03 — Fase 10 · Mapa Calendário de Manutenção (PLANEJAMENTO)

**Status:** ⬜ planejada
**Contexto/decisão:** o calendário atual (`CalendarPage` + `GET /calendar`) é uma
tabela simples que lê **apenas** `sg_calendar_entries` (manutenções planejadas
geradas a partir dos planos). O **Mapa Calendário de Manutenção** o substitui por
uma **visão de planejamento e risco** que agrega, num só lugar, eventos de várias
fontes já existentes. **Princípio de projeto (ADR-001/002):** o mapa é
**derivado/read-only** — não cria uma nova tabela de eventos nem duplica dado; ele
**agrega e classifica** o que já existe (`sg_calendar_entries`, `sg_plan_items`,
`sg_maintenance_orders`, `sg_recommendations`, `sg_associated_reports`, `sg_events`,
`sg_equipment`). A única persistência nova é a **tabela de regras de vencimento
configuráveis**. Mantém a superfície única façade JSON `/admin/api/v2/sentinelgrid`.

---

#### A) Regras de negócio (spec do Mapa Calendário)

**A.1 — Objetivo.** Visão visual única que identifica rapidamente: manutenções
agendadas, próximas do vencimento, vencidas, corretivas abertas, paradas
aguardando aprovação, recomendações com prazo, recomendações críticas, relatórios
obrigatórios não associados e equipamentos em condição restrita.

**A.2 — Fontes → tipos de evento (o "de-para" da agregação).** Cada evento do mapa
é normalizado para um contrato comum e sempre carrega `ref_table`/`ref_id` (acesso
à origem — regra obrigatória 10):

| Tipo de evento | Fonte (tabela) | Condição de inclusão | Data do evento |
|---|---|---|---|
| Preventiva sem parada (planejada) | `sg_calendar_entries` / `sg_plan_items` | `maintenance_type=preventiva_sem_parada`, sem OM concluída | `planned_date` / `next_due_date` |
| Preventiva com parada (planejada) | `sg_calendar_entries` / `sg_plan_items` | `maintenance_type=preventiva_com_parada` | `planned_date` |
| Manutenção agendada/em execução | `sg_maintenance_orders` | status ∈ {agendada, aprovada, em_execucao} | `scheduled_date`/`planned_date` |
| Manutenção vencida | `sg_calendar_entries`/`sg_maintenance_orders` | `planned_date < hoje` e não concluída | `planned_date` |
| Corretiva aberta | `sg_maintenance_orders` | `maintenance_type=corretiva` e status ∉ {concluida, concluida_com_pendencias, cancelada} | `planned_date`/`created_at` |
| Aprovação pendente | `sg_maintenance_orders` | `status=aguardando_aprovacao` | `planned_date` |
| Recomendação com prazo | `sg_recommendations` | `due_date` não nulo e status ∈ abertos | `due_date` |
| Recomendação crítica | `sg_recommendations` | `criticality ∈ {alta, missao_critica}` e status aberto | `due_date`/`created_at` |
| Relatório obrigatório pendente | `sg_maintenance_orders` + `sg_contracts` + `sg_associated_reports` | OM concluída de equipamento cujo contrato tem `requires_report=true` **sem** relatório associado | data de conclusão da OM |
| Evento crítico/alarme | `sg_events` | `severity ∈ {alta, critica}` | `occurred_at` |
| Equipamento em condição restrita | `sg_equipment` | `operational_status ∈ {operacional_restricao, em_observacao, indisponivel}` | marcador corrente (`updated_at`/hoje) |

**A.3 — Contrato normalizado do evento.** Todo evento expõe: `cliente`, `site`,
`area`, `equipamento` (tag), `tipo`, `data`, `status`, `criticidade`, `responsável`,
`ação necessária`, além de `prioridade`, `cor`, `ref_table`, `ref_id`.

**A.4 — Modos de visualização.**
- **Por Cliente:** agrupamento `Cliente → Site → Área → Equipamento`, com resumo por
  cliente: total no período, vencidas, próximas, recomendações críticas, aprovações
  pendentes, equipamentos em restrição e **status geral** (A.10).
- **Por Equipamento:** foco num equipamento — próxima manutenção, última manutenção,
  vencidas, recomendações abertas/críticas, relatório pendente, aprovação pendente e
  status operacional.

**A.5 — Visões de período.** `ano | mês | semana | dia`.
- **Anual:** 12 meses, cada um com contadores (planejadas, vencidas, corretivas
  abertas, recomendações críticas, aprovações pendentes, relatórios pendentes).
- **Mensal:** eventos por dia; cada dia indica **quantidade + maior criticidade**.
- **Semanal:** programação operacional da semana.
- **Diária:** detalhe das atividades do dia.

**A.6 — Alertas visuais (mínimos):** próxima do vencimento, vencida, corretiva
aberta, recomendação crítica aberta, aprovação pendente, relatório obrigatório não
associado, equipamento em restrição e **conflito de agenda** (2+ atividades no mesmo
equipamento — ou mesmo responsável — na mesma data/janela).

**A.7 — Cores (§6):** Verde=concluído/normal · Azul=planejado/agendado ·
Amarelo=próximo do vencimento · Laranja=atenção/aprovação pendente ·
Vermelho=vencido/crítico/corretiva · Roxo=recomendação técnica · Cinza=cancelado/desativado.

**A.8 — Prioridade (§7):** `Informativo < Atenção < Importante < Crítico < Emergencial`.
Ladder sugerida (configurável) que considera criticidade do equipamento, tipo de
manutenção, atraso, recomendação crítica, status operacional, impacto e aprovação:
- **Emergencial:** corretiva emergencial aberta · OM `emergencial` · equipamento
  `indisponivel` com pendência.
- **Crítico:** manutenção vencida em equipamento `alta`/`missao_critica` ·
  recomendação crítica aberta · equipamento em restrição com manutenção vencida.
- **Importante:** manutenção vencida (demais criticidades) · dentro da janela de
  **alerta crítico** (A.9) · aprovação de parada pendente com data próxima.
- **Atenção:** dentro do **primeiro alerta** (próxima) · recomendação aberta com
  prazo · aprovação pendente · relatório obrigatório pendente.
- **Informativo:** planejado no futuro, fora das janelas de alerta.

**A.9 — Regras de vencimento (configuráveis).** Janela por criticidade do equipamento
(default = tabela do prompt), persistida em `sg_calendar_alert_rules`:

| Criticidade | 1º alerta (dias antes) | Alerta crítico |
|---|---:|---:|
| baixa | 15 | após vencimento |
| media | 30 | 7 dias antes |
| alta | 45 | 15 dias antes |
| missao_critica | 60 | 30 dias antes |

Classificação da manutenção: `hoje < data − 1ºalerta` ⇒ planejada;
`data − 1ºalerta ≤ hoje < data − crítico` ⇒ **próxima (amarelo)**;
`data − crítico ≤ hoje < data` ⇒ **próxima crítica (laranja/vermelho)**;
`hoje ≥ data` sem conclusão ⇒ **vencida (vermelho)**.

**A.10 — Status geral (§11, pior condição no escopo filtrado):**
`Normal` (sem pendências) → `Atenção` (manutenção próxima / aprovação pendente /
recomendação aberta) → `Crítico` (vencida / recomendação crítica / equipamento em
restrição) → `Emergencial` (corretiva emergencial). Vale para cliente, site, área e
equipamento — sempre a **pior** condição encontrada.

**A.11 — Filtros (§9):** cliente, site, área, equipamento, tipo de equipamento, tipo
de manutenção, status, criticidade, responsável, recomendação crítica, aprovação
pendente, relatório pendente e período. Atualizam o mapa dinamicamente (regra 9).

**A.12 — Card do evento (§10):** título, cliente, site, área, equipamento, data, tipo,
status, criticidade, responsável, pendências, recomendações vinculadas, relatório
associado/pendente, ação recomendada e **link para a origem** (OM/recomendação/evento).

**A.13 — Regras obrigatórias (§12):** todas mapeadas — planejada (A.2/A.5), vencida em
destaque (A.9), recomendação com prazo e crítica (A.2), aprovação pendente (A.2),
relatório obrigatório pendente gera alerta (A.2/A.6), equipamento restrito em destaque
(A.2), visão por cliente e por equipamento (A.4), filtros dinâmicos (A.11), acesso à
origem (A.3), status por criticidade/pior pendência (A.10), mapa como visão de
planejamento/vencimento/risco (A.1).

---

#### B) Plano de implementação (fatias)

Segue o padrão consolidado da Fase 1: migration → validator zod → repository →
rota façade → api tipada → página SPA. Backend testado isolado antes do build.

**Fatia 10.1 — Motor de agregação (backend, read-only, sem migration).**
- `sentinelgrid/src/repositories/calendarMapRepository.js` — `listMapEvents({ from, to, view, clientId, siteId, areaId, equipmentId, equipmentTypeId, maintenanceType, status, criticality, responsible, onlyCriticalRec, onlyPendingApproval, onlyPendingReport })`: consultas às 10 fontes de A.2, normalizadas para o contrato A.3 via `UNION ALL`/montagem em JS. Deriva `atraso` e `is_overdue`.
- `sentinelgrid/src/routes/calendarMap.js` — `GET /calendar/map` (lista de eventos) e `GET /calendar/map/summary` (rollup por cliente/site/área + status geral A.10).
- `sentinelgrid/src/routes/apiV2.js` — monta `/calendar/map` (mantém `/calendar` legado durante a transição).

**Fatia 10.2 — Regras de vencimento configuráveis (migration + CRUD).**
- `sentinelgrid/migrations/017_calendar_alert_rules.sql` — `sg_calendar_alert_rules (criticality PK/unique, first_alert_days INT, critical_alert_days INT, critical_after_due BOOLEAN)`; **seed** com os defaults de A.9.
- `sentinelgrid/src/validators/calendarAlertRuleValidators.js`, `.../repositories/calendarAlertRulesRepository.js`, `.../routes/calendarAlertRules.js` — CRUD (`GET`/`PUT`).
- Motor (10.1) passa a ler as regras para classificar planejada/próxima/crítica/vencida (A.9).

**Fatia 10.3 — Classificação: prioridade, cor e status geral.**
- `sentinelgrid/src/services/calendarClassifier.js` — funções puras `deriveColor(evento)` (A.7), `derivePriority(evento, regras)` (A.8) e `worstStatus(eventos)` (A.10). Testável isolado.
- `sentinelgrid/src/constants.js` — `ALERT_PRIORITY` e `CALENDAR_EVENT_KIND` (enums novos).
- Motor injeta `prioridade`/`cor` em cada evento e o summary usa `worstStatus`.

**Fatia 10.4 — Frontend: Mapa (visões + modos).**
- `frontend/src/api/sentinelgrid/calendarMap.ts` — client tipado (`SgMapEvent`, `SgMapSummary`, `listMapEvents`, `getMapSummary`).
- `frontend/src/pages/sentinelgrid/CalendarPage.tsx` — reescrita para o Mapa: alternância **período** (ano/mês/semana/dia) e **modo** (por cliente / por equipamento); grade colorida (A.7) com contadores por dia/mês; agrupamento `Cliente → Site → Área → Equipamento`.
- Legenda de cores (§6) e prioridades (§7).

**Fatia 10.5 — Filtros dinâmicos + card do evento + acesso à origem.**
- Barra de filtros (A.11) que reconsulta o mapa (React Query keys por filtro).
- `EventCard` (modal) com todos os campos de A.12 e **link para a origem** (rota da OM/recomendação/evento correspondente).
- Realces de alerta (A.6), incluindo **conflito de agenda**.

**Fatia 10.6 — Ajuste de página de configuração (regras de vencimento).**
- UI simples (na Config do módulo ou aba do Mapa) para editar `sg_calendar_alert_rules` (A.9), atendendo "essas regras devem ser configuráveis".

---

**Migrations/DB (previstas):** `017_calendar_alert_rules.sql` (única persistência nova;
o restante é derivado). Sem alteração destrutiva nas tabelas existentes.

**Como validar (previsto):** `node --check` nos novos arquivos; `node sentinelgrid/migrate.js`
aplica `017`; smoke test do motor cobrindo cada fonte de A.2 e a classificação de
A.8/A.9/A.10; `npm --prefix frontend run build`; rota SPA `/app/sentinelgrid/calendar`
(mapa) 200 nos 4 modos de período e nos 2 modos de escopo.

**Decisões a confirmar antes de codar:**
1. Substituir o `/calendar` atual pelo mapa ou manter os dois lado a lado durante a transição.
2. "Relatório obrigatório pendente": basear em `contract.requires_report` do equipamento (proposto) — confirmar a origem do "obrigatório".
3. "Conflito de agenda": conflito por **equipamento** e/ou por **responsável/técnico** (proposto: ambos).
4. Onde expor a edição das regras de vencimento (Config do módulo vs. aba do Mapa).

**Pendências/próximo passo:** aprovação do plano; então iniciar **Fatia 10.1** (motor de
agregação), que não exige migration e já entrega valor consultável pela façade.

### 2026-07-03 — Fase 10 · Fatia 10.1: Motor de agregação do Mapa Calendário

**Status:** ✅ concluída (backend validado; sem migration)
**Contexto/decisão:** primeira entrega da Fase 10. Motor **read-only** que agrega e
normaliza as 10 fontes de A.2 num contrato único (A.3), via `WITH ev AS (UNION ALL …)`
sobre as tabelas existentes — **sem** nova tabela de eventos (ADR-001/002). Decisões
adotadas dos itens em aberto: (1) `/calendar/map` **coexiste** com o `/calendar` legado
durante a transição; (2) "relatório obrigatório pendente" = OM concluída de cliente com
`sg_contracts.requires_report=TRUE` **sem** `sg_associated_reports`. "Vencida" não é
fonte separada: é o flag derivado `is_overdue` sobre manutenções (evita duplicidade).
Entradas de calendário já materializadas em OM (`generated_order_id` não nulo) são
suprimidas para não duplicar com a OM. Classificação de prioridade/cor/status geral
fica na 10.3; aqui já saem `is_overdue` e `days_to_due`.

**Alterações (backend):**
- `sentinelgrid/src/repositories/calendarMapRepository.js` — `listMapEvents(filters)` (UNION das fontes + filtros dinâmicos A.11 na query externa; `event_date` normalizada como texto `YYYY-MM-DD`; ordenação por data/criticidade) e `mapSummary(filters)` (rollup por cliente + totais).
- `sentinelgrid/src/routes/calendarMap.js` — `GET /calendar/map` (eventos) e `GET /calendar/map/summary`; `resolveRange` deriva janela de `from/to` ou `year/month` (default = ano corrente).
- `sentinelgrid/src/routes/apiV2.js` — monta `/calendar/map` **antes** do router de operations (`/`) para não ser sombreado.

**Migrations/DB:** nenhuma (motor derivado; a persistência nova — `sg_calendar_alert_rules` — entra na Fatia 10.2).

**Como validar (feito):** `node --check` nos 3 arquivos ✅; smoke test do repositório no
container `app` contra o banco real ✅ — `listMapEvents({})` agrega OM + planejada
(`om_manutencao`, `planejada_sem_parada`) com `event_date` `YYYY-MM-DD`, `is_overdue`
e `days_to_due` corretos; filtros `onlyPendingApproval`/`onlyCriticalRec` retornam
subconjunto; `mapSummary` consolida totais por cliente. App reinicializado sobe sem
erro (`Server running …`, façade registra o módulo).

**Pendências/próximo passo:** **Fatia 10.2** — `sg_calendar_alert_rules` (migration `017`
+ seed dos defaults A.9) e CRUD; o motor passa a classificar próxima/crítica/vencida
pelas regras configuráveis. Depois 10.3 (classificador cor/prioridade/status geral) e
10.4 (frontend do mapa).

### 2026-07-03 — Fase 10 · Fatia 10.2: Regras de vencimento configuráveis + classificação

**Status:** ✅ concluída (backend, migration e smoke test validados)
**Contexto/decisão:** persiste as janelas de alerta por criticidade (§8/A.9) e liga o
motor (10.1) a elas. Modelagem: 1 linha por criticidade com `first_alert_days`
(janela do 1º alerta/próxima) e `critical_alert_days` (janela do alerta crítico);
`critical_after_due` cobre o caso "após vencimento" da criticidade baixa. Seed com os
defaults do prompt via `ON CONFLICT DO NOTHING` (preserva ajustes do usuário). O motor
ganhou `LEFT JOIN sg_calendar_alert_rules` e a coluna derivada `alert_level`
(`planejada`/`proxima`/`critica`/`vencida`), calculada só para eventos de manutenção.

**Alterações (backend):**
- `sentinelgrid/migrations/017_calendar_alert_rules.sql` — `sg_calendar_alert_rules` + seed (baixa/media/alta/missao_critica).
- `sentinelgrid/src/validators/calendarAlertRuleValidators.js` — schema zod (dias ≥ 0) + `isValidCriticality`.
- `sentinelgrid/src/repositories/calendarAlertRulesRepository.js` — `listRules`/`getRule`/`upsertRule` (upsert idempotente).
- `sentinelgrid/src/routes/calendarAlertRules.js` — `GET /calendar/alert-rules`, `PUT /calendar/alert-rules/:criticality` (criticidade inválida→400, zod→400).
- `sentinelgrid/src/repositories/calendarMapRepository.js` — coluna `alert_level` (CASE por regra) e contador `upcoming` no `mapSummary`.
- `sentinelgrid/src/routes/apiV2.js` — monta `/calendar/alert-rules`.

**Migrations/DB:** `017_calendar_alert_rules.sql` aplicada no container `app` (1/17).

**Como validar (feito):** `node --check` nos novos arquivos ✅; migrate aplicou `017` ✅;
smoke test no container ✅ — `listRules` retorna as 4 criticidades com os defaults; os
eventos a +13 e +29 dias (criticidade `media`, first=30) saem `alert_level='proxima'`;
após `upsertRule('media', first=10)` os mesmos eventos viram `planejada` (configuração
aplicada ponta a ponta), defaults restaurados em seguida; `mapSummary` inclui
`upcoming`. App reiniciado sobe sem erro.

**Pendências/próximo passo:** **Fatia 10.3** — classificador puro (`calendarClassifier`)
para `cor` (A.7), `prioridade` (A.8) e `worstStatus`/status geral (A.10), consumido
pelo motor e pelo summary. Depois **10.4** (frontend do mapa: visões ano/mês/semana/dia
e modos por cliente/equipamento).

### 2026-07-03 — Fase 10 · Fatia 10.3: Classificador (cor, prioridade, status geral)

**Status:** ✅ concluída (backend + smoke test validados)
**Contexto/decisão:** camada de **classificação pura** (sem I/O), separada do motor,
para ser testável isolada e reusável no summary. Deriva a partir do evento já
normalizado (event_kind, alert_level, criticality, status, is_overdue): **cor** (A.7),
**prioridade** (A.8 — escada Informativo→Emergencial via maior nível aplicável) e
**status geral** (A.10 — pior condição). O motor passou a anexar `color`/`priority` a
cada evento; o summary calcula `general_status` por cliente e global (pior condição).

**Alterações (backend):**
- `sentinelgrid/src/services/calendarClassifier.js` — `deriveColor`, `derivePriority`, `eventGeneralStatus`, `worstStatus`, `classifyEvent`, `highestPriority`.
- `sentinelgrid/src/constants.js` — enums `ALERT_PRIORITY`, `GENERAL_STATUS`, `CALENDAR_COLOR`.
- `sentinelgrid/src/repositories/calendarMapRepository.js` — `listMapEvents` mapeia via `classifyEvent`; `mapSummary` acumula `general_status` por cliente (pior) e global.

**Migrations/DB:** nenhuma.

**Como validar (feito):** `node --check` nos arquivos ✅; smoke test no container ✅ —
**14/14** asserts sintéticos do classificador (corretiva emergencial→vermelho/emergencial;
vencida alta→vermelho/crítico; próxima média→amarelo/atenção; recomendação
crítica→roxo/crítico; aprovação→laranja/atenção; planejada futura→azul/informativo;
`worstStatus`→emergencial); motor real devolve `color`/`priority` por evento e o summary
devolve `general_status` (cliente e global). App reiniciado sobe sem erro.

**Pendências/próximo passo:** **Fatia 10.4** — frontend do Mapa: `api/sentinelgrid/calendarMap.ts`
(tipos + `listMapEvents`/`getMapSummary`) e reescrita da `CalendarPage` com alternância de
período (ano/mês/semana/dia) e modo (por cliente / por equipamento), grade colorida (A.7)
e legenda. Depois 10.5 (filtros + card do evento + acesso à origem) e 10.6 (UI das regras).

### 2026-07-03 — Fase 10 · Fatia 10.4: Frontend do Mapa (visões + modos)

**Status:** ✅ concluída (build React validado)
**Contexto/decisão:** substitui a `CalendarPage` legada (tabela simples de
`sg_calendar_entries`) pela tela do **Mapa Calendário**, consumindo o motor
`/calendar/map` + `/calendar/map/summary`. A rota `/sentinelgrid/calendar` e o item de
menu foram preservados (mesma URL, nova experiência). O endpoint `/calendar` legado
continua no backend para não quebrar nada durante a transição (decisão da 10.1).

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/calendarMap.ts` — tipos (`SgMapEvent`, `SgMapSummary`, níveis/cores/prioridades), `listMapEvents`/`getMapSummary`, metadados de apresentação (`COLOR_HEX`/`COLOR_LABEL`/`PRIORITY_META`/`GENERAL_STATUS_META`) e `highestPriority`.
- `frontend/src/pages/sentinelgrid/CalendarPage.tsx` — reescrita: alternância de **período** (ano/mês/semana/dia) com navegação ‹ hoje ›; **modo** por cliente / por equipamento; faixa de **status geral** + totais; **Visão Anual** (12 meses × contadores), **Mensal** (grade de dias com contagem e realce por prioridade), **Semanal** (7 colunas com chips), **Diária** (lista detalhada); **Resumo por cliente** (status geral + contadores) no modo cliente; **legenda** de cores (A.7). Chips coloridos por evento (A.7) com tooltip (cliente/site/equip/status/prioridade/ação).

**Migrations/DB:** nenhuma.

**Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck OK; chunk
`CalendarPage-*.js` ~15 kB). Validação visual no navegador (`/app/sentinelgrid/calendar`)
pendente com o usuário.

**Pendências/próximo passo:** **Fatia 10.5** — barra de filtros completa (A.11: site,
área, tipo de equipamento, tipo de manutenção, status, criticidade, responsável,
recomendação crítica, aprovação pendente, relatório pendente) + **card do evento** (modal
A.12) com **acesso à origem** (link para OM/recomendação/evento) e realce de conflito de
agenda. Depois **10.6** — UI de edição das regras de vencimento (`/calendar/alert-rules`).

### 2026-07-03 — Fase 10 · Fatia 10.5: Filtros completos + card do evento + conflito

**Status:** ✅ concluída (build React validado)
**Contexto/decisão:** completa a UX do Mapa. Filtros A.11 encadeados (cliente→site→área,
tipo de equipamento, tipo de manutenção, status, criticidade, responsável) + 3 toggles
(rec. crítica, aprovação pendente, relatório pendente), todos repassados ao motor via
React Query (atualização dinâmica — regra 9). Card do evento (A.12) como modal com acesso
à origem (regra 10): mapeia `ref_table` → rota SPA (`sg_maintenance_orders`→Ordens,
`sg_recommendations`→Recomendações, `sg_equipment`→Equipamento; calendar/eventos exibem a
origem sem rota própria). Conflito de agenda (A.6) calculado no cliente: 2+ atividades de
manutenção no mesmo equipamento/data → realce (borda + ⚠) nos chips/linhas e aviso no card.

**Alterações (frontend):**
- `frontend/src/pages/sentinelgrid/CalendarPage.tsx` — barra de filtros (Collapse "Filtros"); `buildConflicts` + realce; `EventCard` (modal A.12) com `originOf` (acesso à origem); chips/linhas clicáveis abrem o card; clique no resumo por cliente aplica o filtro de cliente.
- Reuso de `listSites`/`listAreas`/`listEquipmentTypes`, `MAINTENANCE_TYPE_OPTIONS` e `CRITICALITY` para popular os selects; `MapFilters` estendido no client.

**Migrations/DB:** nenhuma.

**Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck OK). Validação
visual no navegador pendente com o usuário.

**Pendências/próximo passo:** **Fatia 10.6** — UI de edição das regras de vencimento
(`GET`/`PUT /calendar/alert-rules`) para atender "essas regras devem ser configuráveis"
(A.9), fechando a Fase 10.

### 2026-07-03 — Fase 10 · Fatia 10.6: UI das regras de vencimento (FASE 10 CONCLUÍDA)

**Status:** ✅ concluída (build React validado)
**Contexto/decisão:** fecha a Fase 10 tornando as janelas de alerta editáveis pela UI
(A.9 "configuráveis"). Decisão do item em aberto: a edição fica **na própria tela do Mapa**
(botão "Regras de vencimento" → modal), evitando uma página de config separada. Salvar
uma regra **invalida** as queries do mapa (`map-events`/`map-summary`), então a
reclassificação (cor/prioridade/nível) reflete na hora.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/calendarMap.ts` — `SgAlertRule`/`SgAlertRuleInput`, `listAlertRules`, `updateAlertRule`.
- `frontend/src/pages/sentinelgrid/CalendarPage.tsx` — `AlertRulesModal` (edição por criticidade: 1º alerta, alerta crítico, "crítico só após vencimento"; salvar por linha) + botão de abertura; `CRIT_LABEL` reusa os rótulos de criticidade.

**Migrations/DB:** nenhuma (usa `sg_calendar_alert_rules` da Fatia 10.2).

**Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck OK). Validação
visual no navegador pendente com o usuário.

---

## ✅ FASE 10 (Mapa Calendário de Manutenção) CONCLUÍDA

Entregue ponta a ponta: motor de agregação read-only de 10 fontes (10.1) → regras de
vencimento configuráveis + classificação por nível (10.2) → classificador de cor,
prioridade e status geral/pior condição (10.3) → frontend com visões ano/mês/semana/dia e
modos por cliente/equipamento (10.4) → filtros completos, card do evento com acesso à
origem e conflito de agenda (10.5) → UI das regras de vencimento (10.6).

Backend validado por smoke tests no container (agregação, filtros, classificação,
configurabilidade das regras) e 14/14 asserts do classificador; frontend com typecheck/build
OK. **Superfície nova na façade:** `GET /calendar/map`, `GET /calendar/map/summary`,
`GET`/`PUT /calendar/alert-rules`. Persistência nova: `sg_calendar_alert_rules` (migration
`017`). O `/calendar` legado permanece durante a transição.

**Pendências:** validação visual no navegador (`/app/sentinelgrid/calendar`); depois avaliar
aposentar o endpoint/uso do `/calendar` legado. Regras obrigatórias §12 do prompt todas
cobertas (ver spec A.13 na entrada de planejamento da Fase 10).

### 2026-07-04 — Transversal (UI) · Paginação 20/página nas listas de cadastro

**Status:** ✅ concluída (build/typecheck validado)
**Contexto/decisão:** todas as listas de cadastro passam a paginar de **20 em 20**. O backend
**já suportava** `page`/`pageSize` (retorno `{ total, page, pageSize }`) em todos os módulos —
o trabalho foi **100% frontend**. Componente único reutilizável `Pager` (react-bootstrap
`Pagination` + "X–Y de Z", some quando cabe numa página). Paginação **server-side** com
`placeholderData: keepPreviousData` (não pisca ao trocar de página) nas 8 telas com filtro/busca;
qualquer mudança de filtro/busca **reseta para a página 1**. Exceção: **Catálogo** pagina
**client-side** (fatia 20/página sobre o conjunto completo buscado com `pageSize: 500`), porque
`listManufacturers`/`listEquipmentTypes` também alimentam **dropdowns** de outras telas e não
podiam ter o comportamento alterado. Gestores (mesma página de Contratos) ficou **fora** do
pedido explícito e não foi paginado.

**Alterações (frontend):**
- `frontend/src/components/sentinelgrid/Pager.tsx` — novo componente de paginação compacta.
- `frontend/src/api/sentinelgrid/{contracts,programs,plans,checklists,maintenanceOrders}.ts` — `page`/`pageSize` nos params e no tipo de retorno das funções de list.
- `frontend/src/api/sentinelgrid/catalog.ts` — `pageSize` opcional em `listManufacturers`/`listEquipmentTypes`/`listModels` (não-quebra dropdowns; default inalterado).
- `frontend/src/pages/sentinelgrid/ClientsPage.tsx`, `SitesPage.tsx`, `EquipmentsPage.tsx`, `ProgramsPage.tsx`, `PlansPage.tsx`, `ChecklistsPage.tsx`, `MaintenanceOrdersPage.tsx` — estado `page`, query com `page/pageSize=20` + `keepPreviousData`, reset ao filtrar/buscar, `<Pager>` no rodapé da lista.
- `frontend/src/pages/sentinelgrid/CatalogPage.tsx` — paginação client-side (20/página) nas seções Fabricantes, Tipos e Modelos.
- `frontend/src/pages/sentinelgrid/ManagementPage.tsx` — paginação na seção **Contratos**.

**Migrations/DB:** nenhuma (backend já paginava).

**Como validar (feito):** `npm --prefix frontend run build` ✅ (tsc `--noEmit` + vite build, todos os chunks emitidos). Validação visual no navegador pendente: listar >20 registros em cada tela e conferir os controles + reset ao filtrar.

### 2026-07-06 — Fase 11 (extensão) · Troca de cadastros SG ↔ RS (Cliente → Sites → Equipamentos)

**Status:** ✅ concluída (backend validado por smoke E2E no container; UI compila, aguardando navegador)
**Contexto/decisão:** evolução da "sugestão cruzada" (que era só datalist de nomes) para
**importação/exportação real e vinculada** do cadastro entre os módulos, nos **dois sentidos**,
com **hierarquia completa** (decisões do usuário: cópia vinculada idempotente + Cliente+Sites+
Equipamentos). **Isolamento preservado (ADR-001/002/005):** o SentinelGrid é o **dono do contrato
de integração** — consome o RS só pelo contrato de serviço in-process (`serviceReportService`),
nunca o banco/repo do RS, e escreve apenas nas tabelas `sg_*`; ao exportar, usa o `ensure*ByRef`
do RS. **Sem migration nova:** dedupe/idempotência reusam `sg_rs_links` (por `rs_id`) no SG e
`external_source`/`external_id` no RS (Fase 11.1). Assimetrias tratadas: RS não tem "Área" →
cria/reusa **Área "Geral"** por site; tipo/fabricante/modelo do RS (texto) viram **ensure-or-create**
no catálogo do SG. Toda a lógica cross-módulo fica num único serviço (`registrySync`), sem novo
`require` RS→SG (sem risco de ciclo).

**Alterações (Service Report):**
- `report_service/src/services/serviceReportService.js` — leituras de contrato para integração:
  `getCustomer`, `listCustomers`, `listSitesByCustomer`, `listEquipmentsByCustomer` (read-only, exportadas).

**Alterações (SentinelGrid — backend):**
- `sentinelgrid/src/repositories/rsLinksRepository.js` — novo: `getSgIdByRs`/`getRsIdBySg`/`upsertLink` sobre `sg_rs_links`.
- `sentinelgrid/src/repositories/lookupRepository.js` — `ensureByName` (fabricante/tipo por nome, case-insensitive).
- `sentinelgrid/src/repositories/equipmentModelsRepository.js` — `ensureModelByName` (modelo por fabricante+nome).
- `sentinelgrid/src/services/registrySync.js` — novo, núcleo: `importCustomerFromReportService` (RS→SG),
  `exportClientToReportService` (SG→RS), `listReportServiceImportable`/`listReportServiceExportable` (com flag de vínculo).
  Helpers `ensureDefaultArea`/`ensureFallbackSite`/`upsertLinked`. Idempotente nos dois sentidos.
- `sentinelgrid/src/routes/integration.js` — novo router: `GET/POST /report-service/importable|import|exportable|export`.
- `sentinelgrid/src/routes/apiV2.js` — monta `/integration`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/integration.ts` — client tipado (importable/import/exportable/export + tipos de resultado).
- `frontend/src/components/sentinelgrid/RegistrySyncModal.tsx` — novo modal genérico (seleção + opções sites/equipamentos + resumo), reusado pelos dois lados.
- `frontend/src/pages/sentinelgrid/ClientsPage.tsx` — botão **"Buscar do Service Report"** (importa RS→SG).
- `frontend/src/pages/CustomersPage.tsx` (RS) — botão **"Buscar do SentinelGrid"** (importa SG→RS via façade do SG).

**Migrations/DB:** **nenhuma** (reusa `sg_rs_links` e as colunas `external_*` do RS da Fase 11.1).

**Como validar (feito):** `node --check` em todos os arquivos backend ✅; **smoke E2E no container** ✅
— cria cliente+site+equipamento no RS, importa p/ SG (área "Geral" + tipo/fabricante/modelo ensure-by-name,
vínculos criados), **reimport idempotente** (mesmo cliente, sem duplicar equipamento/vínculo),
**exporta** cliente novo SG→RS (customer com `external_ref` do SG, reexport reusa o mesmo id), listagens
marcam `sg_linked`/`rs_linked`; cleanup completo. `npm --prefix frontend run build` ✅ (chunk `integration-*.js`).
App reiniciado sobe sem erro.

**Pendências/próximo passo:** validação visual no navegador (SG Clientes → "Buscar do Service Report";
RS Clientes → "Buscar do SentinelGrid"). Futuro opcional: reaproveitar o mesmo `registrySync` para
sincronizar em lote (todos os clientes) e estender às telas de Sites/Equipamentos além do Cliente.

### 2026-07-06 — Fase 11 (extensão) · Caixa de sugestão rotulada por módulo no campo Nome

**Status:** ✅ concluída (build/typecheck validado; UI aguardando navegador)
**Contexto/decisão:** a pedido do usuário, o campo **Nome** do cadastro de Cliente (SG) e Cliente (RS)
ganha uma **caixa de sugestão (autocomplete)** que lista os cadastros dos **dois módulos**, cada item
rotulado com a origem — `Service-Report: CLIENTE X` / `SentinelGrid: CLIENTE Y`. **Ação ao escolher
(decisão do usuário):** item do **próprio módulo** → só preenche o nome; item do **outro módulo** →
dispara a **importação** (abre o modal de troca já pré-selecionado no item, para confirmar sites/
equipamentos). O `<datalist>` nativo não serve (não permite rótulo por origem nem ação ao selecionar),
então foi criado um autocomplete próprio. **Os botões/modal "Buscar do…" foram mantidos** (decisão do
usuário: os dois caminhos coexistem); a caixa é um atalho que reaproveita o mesmo modal/backend.

**Alterações (frontend):**
- `frontend/src/components/sentinelgrid/RegistrySuggestField.tsx` — novo autocomplete: filtra por texto,
  ordena o outro módulo primeiro, rótulo `Módulo: Nome`, badge "importar" nos itens do outro módulo;
  `pick()` decide entre preencher o nome ou chamar `onImportPick`.
- `frontend/src/components/sentinelgrid/RegistrySyncModal.tsx` — prop `preselectId` (seleciona o item ao abrir).
- `frontend/src/pages/sentinelgrid/ClientsPage.tsx` — campo Nome (criação) usa `RegistrySuggestField`
  (`currentModule="sg"`); itens do RS abrem o modal pré-selecionado; `<datalist>`/`mergeNames` removidos.
- `frontend/src/pages/CustomersPage.tsx` (RS) — idem com `currentModule="rs"`; itens do SG abrem o modal
  de exportação pré-selecionado.

**Migrations/DB:** nenhuma (só UI; reusa o backend de troca da entrada anterior).

**Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck; chunks `ClientsPage`/`CustomersPage`
recompilados). Validação visual no navegador pendente: digitar no campo Nome mostra a lista rotulada dos
dois módulos; escolher um item do outro módulo abre o modal de importação já no item escolhido.

### 2026-07-06 — Fase 11 (extensão) · Troca de Equipamento + caixa de sugestão na TAG

**Status:** ✅ concluída (backend validado por smoke E2E no container; build/typecheck OK; UI aguardando navegador)
**Contexto/decisão:** replica a lógica de troca de cadastro (caixa de sugestão rotulada por módulo +
importar ao escolher) para **Equipamento**. Importar **um** equipamento **garante o cliente e o site**
dele (e, no SG, a área "Geral" + catálogo por nome) antes do equipamento — reusa os mesmos "ensure"
idempotentes (refatorados p/ `ensureSgClientFromRs`/`ensureSgSiteFromRs`/`ensureRs*FromSg`). Como o
form de equipamento é um **modal**, escolher um item do outro módulo na caixa da TAG **importa direto**
(confirm + feedback), evitando empilhar modais; o botão de página **"Buscar do…"** abre o modal de lista
(sem opções de hierarquia — equipamento sempre traz cliente+site). Mantidos os dois caminhos, como no cliente.

**Alterações (Service Report):**
- `report_service/src/services/serviceReportService.js` — leituras `getSite`, `getEquipment`, `listEquipments`.

**Alterações (SentinelGrid — backend):**
- `sentinelgrid/src/services/registrySync.js` — refatorado (helpers `ensure*`); novos
  `importEquipmentFromReportService`/`exportEquipmentToReportService` e listagens
  `listReportServiceImportableEquipment`/`listReportServiceExportableEquipment`.
- `sentinelgrid/src/routes/integration.js` — 4 rotas de equipamento (`importable-equipment`/`import-equipment`/
  `exportable-equipment`/`export-equipment`) + códigos de erro `SG_RS_EQUIPMENT_INVALID`/`SG_EQUIPMENT_INVALID`.

**Alterações (frontend):**
- `frontend/src/api/sentinelgrid/integration.ts` — tipos + funções de equipamento; `SyncResult` ganha `equipment*`.
- `frontend/src/components/sentinelgrid/RegistrySyncModal.tsx` — props `showHierarchyOptions` (esconde sites/equip)
  e `successMessage` (mensagem custom p/ equipamento).
- `frontend/src/pages/sentinelgrid/EquipmentsPage.tsx` — botão "Buscar do Service Report" + `RegistrySuggestField`
  na TAG (`currentModule="sg"`; item do RS importa direto); `<datalist>`/`mergeNames` removidos.
- `frontend/src/pages/EquipmentsPage.tsx` (RS) — botão "Buscar do SentinelGrid" + caixa na TAG (`currentModule="rs"`;
  item do SG exporta direto).

**Migrations/DB:** nenhuma nova. **Nota de ambiente:** o banco `reportservice` deste ambiente estava **sem** as
colunas `external_source`/`external_id` (Fase 11.1); reaplicado `node report_service/migrate.js` (idempotente) —
necessário para a integração funcionar em runtime.

**Como validar (feito):** `node --check` em todos os arquivos backend ✅; **smoke E2E no container** ✅ — importa 1
equipamento do RS (cria cliente+site+área "Geral"+catálogo ensure-by-name, tag preservada), reimport idempotente
(sem duplicar), exporta 1 equipamento SG→RS (external_ref + tag), reexport reusa o mesmo id, listagens marcam
`sg_linked`/`rs_linked`; cleanup completo. `npm --prefix frontend run build` ✅. App reiniciado sobe sem erro.

**Pendências/próximo passo:** validação visual no navegador (Equipamentos SG/RS → caixa da TAG e botão "Buscar do…").

### 2026-07-08 — Transversal (UI) · Ícones de contexto (app-icons) tema-aware

**Status:** ✅ concluída (build/typecheck OK; UI aguardando navegador)
**Contexto/decisão:** aplicar os app-icons (UPS + símbolo por contexto) que o usuário
colocou em `frontend/public/img` nas telas correspondentes, mapeados pelo **nome do
arquivo**. Decisões do usuário: aplicar **nos dois lugares** (cards da Home + cabeçalho/
topbar de cada página) e usar o mapeamento proposto. Cada ícone tem a arte "clara" (quadrado
escuro embutido) e, para 4 deles, a variante **`-dark`** (fundo transparente) — a troca é por
**CSS** sob `:root[data-theme="darkvextrom"]` (único tema escuro), sem estado no React.
**Cabeçalho via topbar do `Layout`** (uma edição cobre todas as páginas, em vez de mexer em 6
telas). Mapa arquivo→contexto: `SentinelGrid-icone→Início`, `UPS-Icone-Manut→Equipamentos`,
`ups-agendamento→Ordens`, `ups-calendario→Calendário`, `ups-checklist→Checklists`,
`ups-em-manutencao→Programas`, `ups-corretiva→Alertas`.

**Alterações (frontend):**
- `frontend/public/img/` — renomeado `ups-em-manutenção[-dark].png` → `ups-em-manutencao[-dark].png` (URL com acento dá 404 em prod/Linux).
- `frontend/src/components/sentinelgrid/SgContextIcon.tsx` — novo: componente tema-aware (`SgContext`, mapa de ícones, `contextForPath(pathname)`), URLs via `import.meta.env.BASE_URL` (`/app/img/...`).
- `frontend/src/styles/theme.css` — `.sg-ctx-icon*` (swap por tema), `.vx-topbar__icon`, `.sg-home-hero/-grid/-card`.
- `frontend/src/components/Layout.tsx` — ícone de contexto na topbar ao lado do título (só rotas `/sentinelgrid`).
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — hero com a marca + grade de cards de acesso rápido com ícones.
- `.gitignore` — exceção `!frontend/public/img/*.png` (o `*.png` global ignorava os assets; sem isso, clone/CI limpo ficaria sem os ícones).

**Migrations/DB:** nenhuma.

**Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck OK); `dist/img/` contém os 11 PNG (servidos em `/app/img/...`); `git add -n` confirma os 11 ícones versionados. Validação visual no navegador pendente: topbar mostra o ícone por página; Home mostra hero + grade; trocar para o tema **DarkVextrom** troca para a arte `-dark` (agendamento/calendário/checklist/em-manutenção).

**Pendências/próximo passo:** validação visual nos 4 temas; opcional: otimizar peso dos PNG (~1 MB cada) e gerar `-dark` para corretiva/marca se quiser transparência no tema escuro.

### 2026-07-08 — Transversal (UI) · Conjunto de ícones SVG (SgIcon) no lugar dos PNG/material-symbols

**Status:** ✅ concluída (build/typecheck OK; folha visual publicada p/ revisão; UI aguardando navegador)
**Contexto/decisão:** a pedido do usuário (com folha de marca de referência), recriar todo o conjunto
de ícones do SentinelGrid e **aplicar ao módulo** (menu + topbar + cards). Decisões: **formato SVG na
interface** (não dá para gerar PNG raster aqui; SVG é o formato certo — nítido, leve, e o traço em
`currentColor` **adapta ao tema**, resolvendo o contraste que os PNG `-dark` tinham no tema claro);
**abrangência** = menu lateral + topbar + cards do SentinelGrid (Service Report intacto). Destaque
verde da marca (`#5fb52e`) fixo via classes `.sg-i-accent`/`.sg-i-accent-fill`. Substitui os glifos
`material-symbols` (nav) e os app-icons PNG (topbar/cards) do módulo.

**Alterações (frontend):**
- `frontend/src/components/sentinelgrid/SgIcon.tsx` — novo: 21 ícones SVG (viewBox 24, traço `currentColor` + acento verde), `SgIconName`, `SG_ICON_NAMES`, `isSgIconName`.
- `frontend/src/components/sentinelgrid/SgContextIcon.tsx` — **removido** (superseded pelos SVG).
- `frontend/src/components/Layout.tsx` — `SENTINELGRID_NAV.icon` agora são `SgIconName`; render da nav usa `<SgIcon>` no SentinelGrid (material-symbols só no Service Report); `activeSgIcon(pathname)` alimenta topbar e toggle mobile.
- `frontend/src/pages/sentinelgrid/SentinelHomePage.tsx` — cards usam `<SgIcon>`; hero volta ao logo real (`SentinelGrid-icone.png`).
- `frontend/src/styles/theme.css` — bloco `.sg-ctx-icon` (PNG) trocado por `.sg-icon` (+ `--sg-icon-accent`, acento verde, opacidade na nav); `.sg-home-card__icon` (chip verde) e `.sg-home-brand`.

**Migrations/DB:** nenhuma. **Assets:** os PNG em `public/img` permanecem (usados só no hero da marca; demais ficam de reserva).

**Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck; bundle principal +~5 kB inline, vs ~1 MB/PNG). Folha visual dos 21 ícones (tema claro/escuro) publicada como Artifact para aprovação. Validação no navegador pendente: menu/topbar/cards do SentinelGrid com o novo traço, adaptando cor por tema.

**Pendências/próximo passo:** aprovação visual do conjunto; ajustar ícones específicos se necessário (ex.: `orders`, `program`, `contract`). Extras (`wrench`/`battery`/`rectifier`/`settings`/`export`/`profile`) já no registry para uso futuro (ex.: tipos de equipamento, config, perfil).

### 2026-07-08 — Service Hub · Card do SentinelGrid usa o logo da marca

**Status:** ✅ concluída (EJS/CSS; sem build; UI aguardando navegador)
**Contexto/decisão:** trocar o glifo `material-symbols` "bolt" do card do SentinelGrid no Service Hub
pelo **logo da marca** (`SentinelGrid-icone.png`). O hub é server-rendered (EJS/Express), então o asset
vai pelo `/public` (sempre servido pelo Express — igual ao logo da sidebar), não pelo `/app` (gated por
`reactAppEnabled`+auth). O "tile" gradiente/borda do `.module-hub-icon` é removido só para esse card
(o PNG já traz o próprio fundo).

**Alterações:**
- `specflow/public/img/SentinelGrid-icone.png` — cópia do logo (servido em `/public/img/`).
- `views/admin-module-hub.ejs` — card `sentinelgrid` renderiza `<img class="module-hub-icon module-hub-icon--img" src="/public/img/SentinelGrid-icone.png">` em vez do glifo; ternário de ícone dos demais módulos mantido.
- `specflow/public/css/app.css` — `.module-hub-card--sentinelgrid .module-hub-icon--img` (reset de fundo/borda por tema, `object-fit: cover`).
- `.gitignore` — exceção `!specflow/public/img/*.png` (versiona o logo apesar do `*.png` global).

**Migrations/DB:** nenhuma. **Como validar:** abrir o Service Hub (`/admin/hub`) e ver o card SentinelGrid com o logo. Sem build; hard-refresh. Se em produção (view cache do EJS ligado), reiniciar o app.

### 2026-07-08 — UI · +14 ícones SVG (ações + calendário/severidade)

**Status:** ✅ concluída (build/typecheck OK; folha visual atualizada; **ainda não fiados nos botões**)
**Contexto/decisão:** a partir de 2 folhas de referência do usuário, ampliar o `SgIcon` com ícones de
**ação** e de **calendário/severidade**, na mesma paleta (traço `currentColor` + acento verde). Só
**criados no registry** por ora; a fiação nos botões de ação das telas (hoje `IconAction`/material) é
passo separado, a combinar.

**Alterações (frontend):**
- `frontend/src/components/sentinelgrid/SgIcon.tsx` — +14 nomes/desenhos: `include` (Incluir), `trash` (Excluir), `edit-plan` (Editar Plano), `delete-plan` (Excluir Plano), `add-circle` (Adicionar), `new-doc` (Novo), `groups` (Grupos), `month` (Mês), `year` (Ano), `today` (Hoje), `emergency` (Emergencial), `critical` (Crítico), `important` (Importante), `attention` (Atenção). Total do conjunto: **35**.

**Migrations/DB:** nenhuma. **Como validar:** `npm --prefix frontend run build` ✅ (o `Record<SgIconName>` garante que todos têm desenho). Folha visual (Artifact) atualizada com as seções "Ações" e "Calendário & severidade".

**Pendências/próximo passo:** aprovar/ajustar os desenhos (ex.: `new-doc`/`important`/`critical` são mais interpretativos); depois **fiar nos botões**: Incluir/Novo/Adicionar, Excluir/Excluir Plano, Editar Plano nas telas CRUD; severidade nos badges de Alertas/Calendário; Mês/Ano/Hoje no seletor de período do Mapa.

### 2026-07-08 — UI · Fiação dos ícones SVG (ações, severidade, período) + `pencil`

**Status:** ✅ concluída (build/typecheck OK; UI aguardando navegador)
**Contexto/decisão:** aplicar os ícones do conjunto nos lugares reais. Adicionado `pencil` (edição
genérica, 36 no total). Ícones de **botão** usam a variante **`sg-icon--mono`** (acento segue a cor do
botão, não o verde), enquanto **severidade/menu/topbar** mantêm o acento verde.

**Alterações (frontend):**
- `frontend/src/components/IconAction.tsx` — **dual-mode**: renderiza `<SgIcon>` quando o `icon` é um nome do conjunto (via `isSgIconName`), senão o glifo material. Não afeta o Service Report (usa chaves material).
- `frontend/src/components/sentinelgrid/PriorityBadge.tsx` — novo: ícone de severidade + chip colorido (mapa `atencao→attention`, `importante→important`, `critico→critical`, `emergencial→emergency`).
- `frontend/src/components/sentinelgrid/SgIcon.tsx` — +`pencil`.
- `frontend/src/styles/theme.css` — `.sg-icon--mono` (acento = currentColor).
- **Ações (linhas)** — todas as telas SG: `edit→pencil`, `delete→trash`; **Planos**: `edit-plan`/`delete-plan`.
- **Botões de criar** — `new-doc` em Equipamentos/Checklists/Ordens/Contratos&Gestores/Planos; `add-circle` em Catálogo (fabricante/tipo/modelo) e "Adicionar ao grupo"/modal de grupo; `groups` no botão **Grupos** (Equipamentos).
- **Severidade** — `PriorityBadge` em `CalendarPage` (linha/OM/card) e `AlertsPage` (legenda + tabela).
- **Período do Mapa** — `CalendarPage`: ícones `year/month/calendar/today` no seletor ano/mês/semana/dia + `today` no botão "Hoje".

**Migrations/DB:** nenhuma. **Como validar (feito):** `npm --prefix frontend run build` ✅ (typecheck limpo). Folha visual (Artifact) atualizada (36 ícones). Validação no navegador pendente: linhas com pencil/trash, Planos com edit-plan/delete-plan, botões Novo/Adicionar/Grupos, badges de severidade em Alertas/Calendário e o seletor de período.

**Pendências/próximo passo:** validação visual; refinar desenhos se necessário. `include` fica de reserva (não fiado — os "criar" usaram `new-doc`/`add-circle`).

### 2026-07-08 — UI · Remoção dos ícones material antigos dos botões de ação SG

**Status:** ✅ concluída (build/typecheck OK)
**Contexto/decisão:** as linhas de ação ainda misturavam ícones novos (pencil/trash/checklist) com
glifos **material antigos** (`engineering`, `calendar_month`, `published_with_changes`, `check_circle`,
`save`, `playlist_add_check`). Convertidos para o novo conjunto SVG. Adicionados 3 ícones
(`check`, `status`, `save` — total **39**); nomes distintos dos usados pelo Service Report (sem colisão
no `IconAction` dual-mode).

**Alterações (frontend):**
- `frontend/src/components/sentinelgrid/SgIcon.tsx` — +`check` (aprovar), +`status` (alterar status/refresh), +`save` (salvar).
- Conversões de `icon=`: `calendar_month→calendar` (ProgramsPage · Gerar planos); `engineering→wrench`, `published_with_changes→status`, `check_circle→check`, `save`→SVG (MaintenanceOrdersPage); `published_with_changes→status` (RecommendationsPage); `playlist_add_check→checklist` (ChecklistsPage). `checklist` já era do conjunto.

**Migrations/DB:** nenhuma. **Como validar (feito):** `grep` confirma **0** glifos material em `icon=` nas telas SG; `npm --prefix frontend run build` ✅. Folha visual (Artifact) atualizada (39).
