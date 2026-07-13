# VextromPlatform — contexto de segurança

## Stack e fronteiras

- Backend Node.js/Express compartilhado, com módulos em `report_service/`, `sentinelgrid/`, `specflow/` e `module_spec/`.
- SPA React/Vite em `frontend/`, publicada sob `/app`; páginas administrativas legadas usam EJS em `views/` e módulos.
- PostgreSQL separado por contexto lógico, Redis/sessões e serviços auxiliares em Docker Compose.
- Integrações SentinelGrid ↔ Service Report cruzam fronteira de módulo e exigem idempotência e autorização administrativa.
- Superfícies especiais: upload e geração de PDF, Puppeteer, editor de relatório/HTML, importação de checklist por IA, anexos e arquivos técnicos.

## Ordem recomendada de inspeção

1. `src/app.js`, configuração de sessão/auth/CSRF, `helmet`, CORS, proxies e tratamento global de erro.
2. Routers e controllers de `/admin/api/v2`, Report Service, SentinelGrid, SpecFlow e Module Spec.
3. Repositórios SQL e qualquer interpolação de query.
4. Uploads, armazenamento, download, PDF/Puppeteer e subprocessos.
5. Renderização EJS/React, `dangerouslySetInnerHTML`, `srcDoc`, URLs externas e redirects.
6. Integrações internas, segredos, logs, backups, Docker e dependências.

## Comandos seguros iniciais

```powershell
rg -n "child_process|exec\(|spawn\(|dangerouslySetInnerHTML|srcDoc|res\.redirect|res\.sendFile" . -g "*.js" -g "*.ts" -g "*.tsx"
rg -n "SELECT|INSERT|UPDATE|DELETE|ORDER BY" report_service sentinelgrid specflow module_spec src -g "*.js"
cmd /c npm audit --omit=dev
cmd /c npm --prefix frontend audit --omit=dev
node --check <arquivos-js-alterados>
cmd /c npm --prefix frontend run build
git diff --check
```

Não imprimir `.env`, tokens, cookies, chaves ou conteúdo de relatórios durante a auditoria.
