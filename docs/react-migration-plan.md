# Plano de Migração do Frontend para React.js

> **Status:** Proposta / planejamento. Nenhum código de migração foi escrito ainda.
> **Última atualização:** 2026-06-27 (inclui Seção 10 — coexistência paralela; Seção 11 — Fase 0 detalhada)
> **Escopo:** Refatorar o frontend renderizado em EJS para uma SPA em React, de forma incremental.

---

## 1. Diagnóstico do estado atual

A plataforma é um monólito Node.js/Express multi-módulo com frontend **100% renderizado no servidor** com EJS + Bootstrap 5 (via CDN) + JavaScript vanilla embutido em `<script>` inline em quase todas as views.

| Métrica | Valor |
|---|---|
| Views EJS | ~55 arquivos, **~24.600 linhas** |
| Páginas renderizadas (`res.render`) | ~36 telas distintas |
| JS client-side externo | ~1.900 linhas (3 arquivos em `specflow/public/js/`) |
| Endpoints JSON já existentes (`res.json`) | ~60 |
| Views que já usam `fetch()` | 19 |
| Monólito principal | `specflow/app.js` com **5.436 linhas** (roteia + renderiza + regra de negócio) |

### Telas mais pesadas (candidatas críticas)

| Tela | Linhas |
|---|---|
| `specflow/views/report-service/order-editor.ejs` | 2.029 |
| `specflow/views/report-service/report-editor.ejs` | 1.919 |
| `specflow/views/report-service/spare-parts.ejs` | 1.825 |
| `specflow/views/report-service/discharge-editor.ejs` | 1.314 |
| `specflow/views/report-service/mobile/order-edit.ejs` | 1.277 |
| `specflow/views/report-service/alber-editor.ejs` | 1.044 |

### Características que impactam a migração

- **Autenticação:** sessão por cookie no admin + CSRF (`csurf`) em todo POST + API keys com escopo (`report-service:read/write`) no `/api` + tokens hash para assinatura pública.
- **Duas camadas de API já separadas:** controllers *web* (renderizam EJS, sessão/CSRF) e controllers *api* (JSON, API-key) em `report_service/src/routes/api.js`. A camada web ainda mistura render + `fetch`.
- **i18n server-side:** PT (padrão) / EN / ES via helper `t()` e sessão.
- **Temas:** `data-theme` + `localStorage` (3 temas: soft, vextrom, xvextrom), aplicado inline no `views/partials/head.ejs`.
- **UI mobile separada:** pasta `specflow/views/report-service/mobile/` com views próprias.
- **CSP (helmet):** `scriptSrc: 'self' 'unsafe-inline' cdn.jsdelivr.net` — o `'unsafe-inline'` hoje viabiliza os scripts embutidos; um bundle React limpo permite endurecer isso.

---

## 2. O que NÃO deve ser migrado para React

Estes são renderizados no servidor **de propósito** e devem permanecer EJS/HTML:

- **Templates de PDF:** `report_service/templates/report/document-template.ejs`, `document-template-classic.ejs`, `analytics-report.ejs` — consumidos pelo Puppeteer/Playwright. PDF precisa de HTML estático server-side, não DOM React.
- **Templates de e-mail:** `report_service/templates/email/`.
- **Sistema de tags de relatório** (`@img`, `@equip`, `@timesheet`, `@tblcmpr`, etc.) processado em `report_service/src/services/reportPreviewService.js` — pertence à geração de PDF, não à UI.
- **Páginas públicas de assinatura por token** (`/r`, `client-sign`) — podem migrar depois; baixa prioridade e requisitos de CSP diferentes.

---

## 3. Decisão estratégica

**Abordagem: Strangler incremental (SPA por módulo), não big-bang.** Dado o tamanho do monólito (5.4k linhas em um único `app.js`) e 36 telas com lógica embutida, uma reescrita total de uma vez é alto risco. Migrar **tela a tela**, mantendo EJS e React coexistindo atrás do mesmo Express.

| Decisão | Recomendação | Por quê |
|---|---|---|
| Framework | **React + Vite (SPA)**, servido pelo Express | Sem necessidade de SSR/SEO (é painel admin autenticado); Vite é o build mais simples de integrar |
| Linguagem | **TypeScript** | Tipar os ~60 endpoints reduz risco na migração |
| Roteamento | React Router | Espelha as rotas atuais `/admin/report-service/...` |
| Estado de servidor | **TanStack Query (React Query)** | A maior parte das telas é CRUD sobre os endpoints existentes |
| UI | **React-Bootstrap** | Reaproveita o visual Bootstrap 5 atual com menor reescrita de CSS |
| Auth | **Manter cookie de sessão** (não trocar para JWT agora) | Evita reescrever a camada de auth; React chama as APIs com `credentials: include` |
| CSRF | Expor token via endpoint/meta e enviar em header | `csurf` continua protegendo os POSTs |

---

## 4. Arquitetura alvo

```
VextromPlatform/
├── specflow/ (Express - vira API-first)
│   ├── app.js          → continua servindo, mas /admin/* migrado entrega o index.html do SPA
│   └── routes/api/*    → controllers web refatorados p/ retornar JSON
├── frontend/ (NOVO - app React + Vite + TS)
│   ├── src/
│   │   ├── pages/      → 1 por tela EJS migrada
│   │   ├── components/ → tabelas, modais, editores
│   │   ├── api/        → client tipado dos ~60 endpoints
│   │   ├── i18n/       → PT/EN/ES (migra os t() para react-i18next)
│   │   └── theme/      → 3 temas atuais
│   └── dist/           → buildado e servido por express.static
└── report_service/templates/ (INALTERADO - PDF/email)
```

Express passa a ter dois modos: rotas legadas continuam renderizando EJS; rotas migradas servem o `index.html` do React (catch-all) e os dados vêm das APIs JSON.

---

## 5. Fases do plano

### Fase 0 — Fundação
- Criar `frontend/` com Vite + TS + React Router + React Query.
- Integrar build ao Express (`express.static` em `frontend/dist`, catch-all para rotas React).
- Resolver CSRF (endpoint `GET /admin/csrf-token` + interceptor) e auth por cookie (`credentials: include`).
- Endurecer CSP para o bundle (remover dependência de `'unsafe-inline'` nas telas migradas).
- Portar tema (`data-theme`/`localStorage`) e i18n (react-i18next com os JSONs PT/EN/ES).

### Fase 1 — API-first (paralelo)
- Para cada tela a migrar, garantir que existe endpoint JSON equivalente. Hoje as ações web retornam redirect/HTML — refatorar os controllers web para um par JSON, reaproveitando os *services* (a regra de negócio já está fora das views).

### Fase 2 — Telas simples primeiro (validar a abordagem)
- Migrar listagens CRUD de baixo risco: `customers`, `equipments`, `orders`, `analytics-dashboard`.

### Fase 3 — Editores complexos (o grosso do esforço)
- `order-editor`, `report-editor`, `spare-parts`, `discharge-editor`, `alber-editor`, `measurements`/`ups-measures`/`event-log`. Cada um vira um módulo de componentes (tabela editável + modais + import de arquivos + chamadas de IA).

### Fase 4 — Mobile
- Decidir entre responsividade do SPA (eliminando a pasta `mobile/`) ou manter views mobile dedicadas. **Recomendado:** unificar no SPA responsivo.

### Fase 5 — Admin/config + limpeza
- `admin-fields`, `admin-profiles`, `config`, `table-styles`, `technician-tools`.
- Remover EJS órfãos e reduzir `specflow/app.js`.

---

## 6. Mapeamento de telas → módulos React (referência)

| Área | Telas EJS | Prioridade |
|---|---|---|
| Listagens CRUD | customers, equipments, orders, sites | Fase 2 |
| Dashboard | analytics-dashboard | Fase 2 |
| Editores OS | order-editor, report-editor, sign-report, assets-editor | Fase 3 |
| Editores de dados | discharge-editor, alber-editor, measurements-editor, ups-measures-editor, event-log-editor | Fase 3 |
| Peças | spare-parts | Fase 3 |
| Mobile | mobile/orders, mobile/order-edit, mobile/preview, mobile/sign | Fase 4 |
| Admin/config | admin-fields, admin-profiles, admin-tokens, admin-api-keys, config, table-styles, technician-tools | Fase 5 |
| **Não migrar** | document-template*, analytics-report, email/*, client-sign | — |

---

## 7. Riscos e pontos de atenção

1. **CSRF + cookie auth com SPA** — precisa de cuidado (SameSite, header `X-CSRF-Token`). Primeiro ponto a validar na Fase 0.
2. **Monólito `app.js` (5.4k linhas)** mistura render e lógica — extrair JSON sem quebrar rotas EJS legadas exige cobertura/testes manuais por tela.
3. **Templates de PDF ficam em EJS** — não confundir a migração da UI com o sistema de tags do `reportPreviewService`.
4. **i18n e temas** estão acoplados ao SSR — precisam de reimplementação client-side equivalente.
5. **Coexistência EJS+React** durante meses: navegação entre telas legadas e novas (full reload vs SPA) precisa ser transparente.
6. **CSP** — só dá para endurecer quando todas as telas de uma área saírem do inline script.

---

## 8. Esforço estimado (ordem de grandeza)

| Bloco | Telas | Esforço relativo |
|---|---|---|
| Fundação + auth/CSRF/i18n/tema | — | Alto (habilitador) |
| Listagens CRUD | ~8 | Médio |
| Editores complexos | ~10 | **Muito alto** (60–70% do total) |
| Mobile | ~4 | Médio |
| Admin/config | ~8 | Médio |

Os 6 editores pesados concentram a maior parte do risco e do trabalho. Recomenda-se provar a arquitetura completa em **uma** tela CRUD simples (ex.: `customers`) antes de comprometer com os editores.

---

## 9. Próximos passos sugeridos

1. Validar/ajustar as decisões da seção 3 (framework, UI lib, estratégia de auth).
2. Detalhar a **Fase 0** a nível de arquivos/código (setup Vite + integração Express + solução de CSRF).
3. Implementar a Fase 0 e migrar `customers` como piloto.

---

## 10. Estratégia de coexistência paralela (legado + React lado a lado)

**Objetivo:** construir a nova implementação em React **sem tocar** no Express/EJS atual, mantendo o sistema antigo 100% funcional em produção, e **reaproveitando** (não copiando) o backend.

### 10.1. Princípio: compartilhar o backend, não copiar

- **Copiar** o backend cria duas cópias que divergem — todo bug-fix/feature precisaria ser feito em dois lugares. Evitar.
- **Compartilhar:** o React vira apenas uma **nova camada de apresentação** sobre o **mesmo** Express/services, atrás de um novo namespace de rotas. O legado permanece intacto.

### 10.2. Descoberta que viabiliza o reuso

- `report_service/src/controllers/createReportWebController.js` (~5.568 linhas) já responde **~55x com `res.json`** e apenas **~20x com `res.render`**. As *ações* (salvar, deletar, importar, IA) **já são endpoints JSON** — o React as consome direto.
- A lógica de negócio mora em `services/` e `repositories/`; os controllers só orquestram. É isso que torna o reuso viável.

### 10.3. Mapa de reuso

| Categoria | Componentes | Ação |
|---|---|---|
| ♻️ Compartilhar sem tocar | `services/`, `repositories/`, `validators/`, `utils/`, `db/`, migrations, middleware de auth/sessão/CSRF, `i18n/` (dados), geração de PDF, object storage | Reusar como está |
| 🔌 Já é JSON (consumir direto) | os ~55 handlers `res.json` do web controller (CRUD/IA/import) | React consome via `fetch` |
| 🆕 Criar (fino) | *façade* JSON para os ~20 page-loads (hoje `res.render`) → devolver os mesmos dados como JSON | Novo, pequeno — reusa os services |
| 🆕 Criar | o app React (`frontend/`) | Novo |
| 🚫 Intocado | todas as views EJS, rotas `res.render`, templates de PDF/e-mail | Não mexer |

### 10.4. Como a coexistência funciona (mesmo processo Express)

```
Express (mesmo processo, mesmo backend/services)
│
├── LEGADO (intacto)
│   ├── /admin/report-service/orders        → res.render EJS  ✅ continua
│   └── /admin/...                           → todas as telas atuais
│
├── NOVO — React SPA
│   ├── /app/*                               → serve frontend/dist/index.html (catch-all)
│   └── /admin/api/v2/*                      → JSON façade (reusa os mesmos services)
│
└── report_service/templates/  → PDF/e-mail (intacto)
```

Acessa-se `/admin/...` para o sistema atual e `/app/...` para o novo, **lado a lado**, migrando tela por tela sem prazo forçado e sem risco para produção. Quando uma tela do React for validada, basta apontar o link do menu legado para ela.

### 10.5. Modelos de isolamento

1. **Mesmo processo Express, namespace `/app` + `/admin/api/v2`** ✅ **Recomendado** — zero duplicação, backend compartilhado, deploy único.
2. Segundo processo Node dedicado ao SPA (proxy reverso) — mais isolamento, mais complexidade de ops.
3. Cópia integral do projeto — **evitar** (divergência de backend).

### 10.6. Esboço a nível de arquivos (modelo recomendado)

Novos arquivos (nada sobrescreve o legado):

```
frontend/                              # NOVO app React (Vite + TS)
├── index.html
├── vite.config.ts                     # base: '/app/', proxy p/ /admin/api/v2 em dev
├── package.json                       # deps do front isoladas do backend
└── src/
    ├── main.tsx, App.tsx
    ├── api/client.ts                  # fetch com credentials:'include' + header CSRF
    ├── pages/                         # 1 por tela migrada
    └── i18n/, theme/

report_service/src/routes/
└── apiV2.js                           # NOVO router: /admin/api/v2 (sessão+CSRF, reusa services)

report_service/src/controllers/
└── createReportV2Controller.js        # NOVO: page-loads como JSON, chamando os MESMOS services
```

Pontos de enganche no Express (aditivos, em `specflow/app.js`):

```js
// 1) Router JSON novo — mesma auth de sessão/CSRF do admin, reusa services existentes
app.use("/admin/api/v2", requireAdminAuth, csrfProtection, createReportServiceV2Router(deps));

// 2) Servir o build do SPA sob /app (catch-all que NÃO intercepta /admin nem /api)
app.use("/app", express.static(path.join(__dirname, "../frontend/dist")));
app.get("/app/*", (req, res) => res.sendFile(path.join(__dirname, "../frontend/dist/index.html")));
```

Regras para não quebrar o legado:
- Nenhuma rota legada (`/admin/*` EJS, `/api/*` API-key) é alterada ou removida.
- O SPA vive sob `/app`; o façade JSON sob `/admin/api/v2` (reaproveita a sessão de admin já existente).
- CSP: o `'unsafe-inline'` atual permanece para o legado; o bundle React usa `'self'` e pode receber um nonce/origem própria quando o `/app` amadurecer.
- i18n e temas: o façade pode expor os mesmos dados de `specflow/i18n/`; o tema reaproveita `data-theme`/`localStorage`.

### 10.7. Fluxo de migração por tela (incremental)

1. Escolher uma tela (piloto: `customers`).
2. Adicionar no `createReportV2Controller.js` um endpoint JSON que devolve os dados do page-load (reusando o service que já alimenta o EJS).
3. Construir a página React em `frontend/src/pages/` consumindo esse endpoint + os handlers `res.json` já existentes para as ações.
4. Validar em `/app/customers` com o legado ainda ativo em `/admin/.../customers`.
5. Quando aprovado, apontar o link do menu para a versão `/app`.
6. Repetir. O EJS antigo só é removido (Fase 5) quando todas as telas equivalentes existirem.

---

## 11. Fase 0 detalhada — Fundação (passo a passo)

Objetivo da Fase 0: ter o esqueleto React rodando sob `/app`, autenticado pela sessão existente, com CSRF, i18n e tema funcionando — **sem migrar nenhuma tela de negócio ainda** e **sem tocar no legado**.

### 11.1. Passo 1 — Scaffold do app React

```bash
# na raiz do projeto
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom @tanstack/react-query react-bootstrap bootstrap react-i18next i18next
```

`frontend/` tem o **seu próprio** `package.json` (deps do front isoladas do backend). O `node_modules` do front não se mistura com o do Express.

### 11.2. Passo 2 — `vite.config.ts` (base `/app` + proxy em dev)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/app/",                         // assets servidos sob /app
  build: { outDir: "dist" },
  server: {
    proxy: {
      // em dev (vite na 5173), encaminha as APIs ao Express (3000)
      "/admin/api": { target: "http://localhost:3000", changeOrigin: true },
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
```

Em desenvolvimento: `npm run dev` (Express na 3000) + `cd frontend && npm run dev` (Vite na 5173). Em produção: `cd frontend && npm run build` gera `frontend/dist`, servido pelo Express.

### 11.3. Passo 3 — Enganche no Express (aditivo, em `specflow/app.js`)

Inserir **depois** das rotas legadas, para não interceptá-las:

```js
const path = require("path");
const frontendDist = path.join(__dirname, "..", "frontend", "dist");

// SPA estático sob /app (não intercepta /admin nem /api)
app.use("/app", express.static(frontendDist));
app.get("/app/*", (req, res) => res.sendFile(path.join(frontendDist, "index.html")));
```

> Enquanto o `frontend/dist` não existir, esse trecho fica atrás de uma flag de ambiente (`REACT_APP_ENABLED`) para não quebrar o boot.

### 11.4. Passo 4 — Façade JSON `/admin/api/v2` (reusa services existentes)

`report_service/src/routes/apiV2.js` (novo) — mesma auth de sessão/CSRF do admin:

```js
const express = require("express");
const { createReportServiceV2Controller } = require("../controllers/createReportV2Controller");

function createReportServiceV2Router(deps) {
  const router = express.Router();
  const c = createReportServiceV2Controller(deps); // reusa deps.services/repositories
  router.get("/session", deps.asyncHandler(c.session));     // quem sou eu + flags
  router.get("/customers", deps.asyncHandler(c.listCustomers)); // page-load como JSON
  // ... demais page-loads conforme telas forem migrando
  return router;
}
module.exports = { createReportServiceV2Router };
```

Montagem em `specflow/app.js`:

```js
app.use(
  "/admin/api/v2",
  requireAdminAuth,            // mesma sessão de admin já existente
  csrfProtection,             // mantém proteção CSRF
  createReportServiceV2Router(deps)
);
```

O controller v2 **não** reimplementa regra de negócio: chama os mesmos `services/`/`repositories/` que o web controller já usa, só que devolvendo `res.json` em vez de `res.render`.

### 11.5. Passo 5 — Cliente HTTP + CSRF + cookie (no React)

O CSRF (`csurf`) hoje injeta o token no EJS. No SPA, expor o token e enviá-lo em header:

```js
// backend: endpoint leve que devolve o token da sessão atual
app.get("/admin/api/v2/csrf-token", requireAdminAuth, csrfProtection, (req, res) =>
  res.json({ csrfToken: req.csrfToken() })
);
```

```ts
// frontend/src/api/client.ts
let csrf: string | null = null;
async function getCsrf() {
  if (csrf) return csrf;
  const r = await fetch("/admin/api/v2/csrf-token", { credentials: "include" });
  csrf = (await r.json()).csrfToken;
  return csrf!;
}
export async function api(path: string, init: RequestInit = {}) {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET") headers.set("X-CSRF-Token", await getCsrf());
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  if (res.status === 401) window.location.href = "/admin/login"; // cai no login legado
  return res;
}
```

Confirmar no `csurf`/sessão que o token é aceito via header `X-CSRF-Token` (padrão do `csurf`) e que o cookie de sessão é `SameSite=Lax` (mesmo host, então funciona sem CORS).

### 11.6. Passo 6 — i18n (PT/EN/ES) no React

- Reaproveitar os dicionários de `specflow/i18n/` exportando-os como JSON via um endpoint (`GET /admin/api/v2/i18n/:lang`) ou copiando os arquivos para `frontend/src/i18n/`.
- Configurar `react-i18next` com PT como fallback; idioma inicial vindo da sessão (`/admin/api/v2/session`).

### 11.7. Passo 7 — Tema (3 temas) no React

- Replicar o bootstrap de tema do `views/partials/head.ejs`: ler `localStorage["app_theme"]` (valores `soft|vextrom|xvextrom`), aplicar `data-theme` no `<html>`.
- Reaproveitar o `specflow/public/css/app.css` (importar no `main.tsx`) para manter a identidade visual.

### 11.8. Passo 8 — CSP

- O `'unsafe-inline'` atual permanece para o legado.
- O bundle React não usa inline script, então sob `/app` pode-se servir com CSP mais restrita (origem `'self'`). Avaliar nonce quando `/app` amadurecer.

### 11.9. Passo 9 — Build no Docker

- Adicionar etapa `npm --prefix frontend ci && npm --prefix frontend run build` no `Dockerfile` (estágio de build), copiando `frontend/dist` para a imagem final.
- Garantir que o `.dockerignore`/`.gitignore` ignore `frontend/node_modules` e `frontend/dist` (build artifact).

### 11.10. Critérios de aceite da Fase 0

- [ ] `GET /app` carrega o React com layout/tema/i18n, sem afetar `/admin/...` nem `/api/...`.
- [ ] `GET /admin/api/v2/session` retorna o admin logado usando a **mesma** sessão do legado.
- [ ] Uma chamada `POST` de teste passa pela validação CSRF via header.
- [ ] `npm run build` do front gera `dist` e o Express o serve em produção.
- [ ] Nenhuma rota/arquivo legado foi alterado além dos enganches aditivos em `specflow/app.js`.
