# Módulo Relatório de Despesas — Plano de Implementação

> Fase 1 (diagnóstico) do plano em `.claude/relatoriodepesas.md/relatoriodespeas.md`.
> Regras de negócio: `.claude/relatoriodepesas.md/plannerrelatoriodepeas.md`.

## 1. Diagnóstico da arquitetura

| Item | Encontrado | Consequência para o módulo |
|---|---|---|
| Estrutura | Monólito Express multi-módulo; hub em `specflow/app.js`. Cada módulo tem banco, migrations, repositórios e rotas próprios. | Novo módulo `expenses/` na raiz, no mesmo formato do `sentinelgrid/`. |
| Frontend | SPA React 18 + Vite + TS em `frontend/`, servida em `/app` (React Router, TanStack Query, React-Bootstrap, Recharts). | Telas em `frontend/src/pages/expenses/`, API tipada em `frontend/src/api/expenses.ts`. |
| Autenticação | Sessão por cookie assinada (`admin_session`) para **todos** os usuários (`configdb.admin_users`) + CSRF (`csurf`, header `X-CSRF-Token`). | Reutilizada sem alterações. Nada de auth paralela. |
| Perfis | `specflow/services/accessControl.js`: Administrador, Coordenador, Técnico, Gestor; autorização por **capacidade**. | Novas capacidades `expenses:submit` (todos os perfis) e `expenses:manage` (Administrador). |
| Identidade | `admin_users.id` (texto/uuid); `username` pode ser renomeado; o admin do `.env` não tem linha na tabela. | `user_id` = `admin_users.id`; admin do `.env` = `env:<username>`. Username gravado como snapshot. |
| Banco | PostgreSQL 16, um banco por módulo (`*_DATABASE_URL`), `ensureDatabaseExists` cria o banco. | Banco isolado `expenses` (`EXPENSES_DATABASE_URL`). FK para usuário não é possível (bancos distintos) — documentado. |
| Migrations | SentinelGrid: runner de `.sql` versionados com tabela de controle e transação por arquivo. | Mesmo runner (`ex_schema_migrations`). Plugado em `specflow/db/migrate.js` atrás de `EXPENSES_ENABLED`. |
| Rotas | Façade JSON `/admin/api/v2/<módulo>` com gates de capacidade em `specflow/app.js` + router do módulo. Rate-limit e `no-store` já aplicados a `/admin/api/v2`. | `/admin/api/v2/expenses` (usuário) e `/admin/api/v2/expenses/admin` (gestão). |
| Validação | zod (`validators/*`), envelope `{ error, errorCode, details }`. | Mesmo padrão. |
| Upload | `express.raw` + headers `X-File-Name` (Report Service). Sem multer. | Mesmo padrão; validação por assinatura binária (magic bytes) + tamanho. |
| Armazenamento | `specflow/services/objectStorage.js` (local `./dados` ou S3/MinIO). | Chaves `dados/expenses/<relatório>/<item>/<uuid>.<ext>` — não servidas por rota pública. |
| PDF | `pdfkit` (SpecFlow) e Puppeteer (Report Service, HTML pesado). | `pdfkit`: documento tabular simples, sem depender do container Puppeteer. |
| Notificações | Não há sistema genérico (só alertas do SentinelGrid e e-mail transacional). | Tabela interna `ex_notifications` + e-mail opcional via `sendTransactionalEmail`. |
| Interface | Layout `vx-*`, `Layout.tsx` com nav por módulo, `ConfirmDialog`, `IconAction`, `Pager`, KPIs `vx-kpi`, Recharts. | Reutilizados; novo bloco de navegação "Despesas" no `Layout`. |
| Testes | `node --test` (module_spec). Sem testes de integração com banco. | `expenses/tests/*.test.js` para regras puras; `npm run test:expenses`. |

## 2. Pontos de integração (alterações aditivas)

- `specflow/config/env.js` — flag `EXPENSES_ENABLED`, `databases.expenses`, bloco `expenses` (chave de dados, limites, política).
- `specflow/services/accessControl.js` — capacidades `EXPENSES_SUBMIT`/`EXPENSES_MANAGE`.
- `specflow/db/migrate.js` — `migrateExpenses()` quando habilitado.
- `specflow/app.js` — gates de capacidade, `registerExpenses(...)`, resolvedor de identidade, gate do SPA `/app/expenses`, card no Service Hub.
- `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/api/session.ts`.
- Scripts: `package.json`, `scripts/modules-toggle.js`, `scripts/backup-module-database.js`, `scripts/restore-database.js`, `.env.example`.

## 3. Componentes reutilizados

Sessão/CSRF/rate-limit, `accessControl`, `objectStorage`, `sendTransactionalEmail`, `ensureDatabaseExists`, zod, `pdfkit`, `archiver`; no front: `api()`/`downloadFile()`, `Layout`, `ConfirmDialog`, `IconAction`, `Pager`, `formatDate`, classes `vx-*`, Recharts.

## 4. Entidades (banco `expenses`, prefixo `ex_`)

`ex_profiles`, `ex_reports`, `ex_report_sequences`, `ex_items`, `ex_categories`, `ex_attachments`, `ex_approval_history`, `ex_payments`, `ex_audit_log`, `ex_notifications`. Detalhe em `expenses/migrations/001_init.sql`.

Decisões de modelagem:
- Dinheiro em `NUMERIC(14,2)`; no Node os valores trafegam como string e são somados em centavos inteiros (`BigInt`).
- `total_amount` é recalculado no banco (`SUM`) na mesma transação de cada alteração de lançamento; o cliente nunca envia total.
- Número `RD-AAAA-NNNNNN` gerado por `ex_report_sequences` (linha por ano, `UPDATE … RETURNING`) + `UNIQUE`.
- Exclusões lógicas (`deleted_at`) para relatórios, lançamentos e anexos; `ex_audit_log`, `ex_approval_history` e `ex_payments` imutáveis via trigger.
- Pagamento integral único por relatório: índice único parcial `WHERE payment_type = 'INTEGRAL'`. Coluna `payment_type` e `approved_amount` por item preparam pagamento/aprovação parciais.
- CPF, número da conta e chave Pix cifrados (AES-256-GCM) com chave `EXPENSES_DATA_KEY` (fallback derivado de `ADMIN_SESSION_SECRET`).

## 5. Arquivos previstos

```
expenses/
  migrate.js
  migrations/001_init.sql
  src/app.js, db.js, constants.js
  src/migrations/runner.js
  src/lib/        money.js, cpf.js, crypto.js, fileSignature.js, errors.js
  src/policies/   expensePolicy.js       (autorização centralizada)
  src/services/   workflow.js, profileService.js, reportService.js, attachmentService.js,
                  reviewService.js, paymentService.js, dashboardService.js,
                  notificationService.js, auditService.js, pdfService.js
  src/repositories/ (consultas SQL por agregado)
  src/validators/ expenseValidators.js
  src/routes/     apiV2.js, userRoutes.js, adminRoutes.js
  tests/*.test.js
frontend/src/api/expenses.ts
frontend/src/pages/expenses/*.tsx
```

## 6. Riscos técnicos

1. **Bancos separados** — sem FK para `admin_users`. Mitigação: `user_id` estável (id) + snapshot de username.
2. **Chave de criptografia** — trocar `EXPENSES_DATA_KEY` (ou `ADMIN_SESSION_SECRET`, se for o fallback) torna os dados cifrados ilegíveis. Mitigação: documentar e recomendar chave dedicada.
3. **Visualização de PDF em iframe** — o Helmet envia `X-Frame-Options: DENY`; a rota de conteúdo do anexo sobrescreve para `SAMEORIGIN` com CSP restrita.
4. **Concorrência** — transições com `SELECT … FOR UPDATE` + checagem do status de origem; pagamento duplicado barrado também pelo índice único.
5. **Sem banco no ambiente de desenvolvimento atual** — testes automatizados cobrem regras puras; o fluxo de homologação deve ser executado com o Postgres do Docker.

## 7. Dependências internas

`specflow/config/env`, `specflow/db/ensure-database`, `specflow/services/objectStorage`, `specflow/services/email` (via deps), `specflow/services/adminUsers` (via deps, para identidade e contatos de gestores).

## 8. Estratégia

Fases 2→10 do plano, nesta ordem: modelo de dados → perfil → relatórios → lançamentos/anexos → workflow → pagamentos → dashboards → PDF/notificações → testes. Progresso em `docs/expense-management/progress.md`.

## 9. Decisões de negócio não especificadas (alternativa mais simples e segura)

| Tema | Decisão |
|---|---|
| Quem é "usuário" | Todo usuário autenticado (todos os perfis). |
| Quem é "administrador" | Perfil Administrador (`expenses:manage`). Novo perfil financeiro = só mais uma linha na matriz. |
| Autoaprovação | Proibida (aprovar e pagar o próprio relatório). Liberável com `EXPENSES_ALLOW_SELF_APPROVAL=true`. |
| Projeto / centro de custo | Texto livre na v1 (`project_name`, `cost_center`); colunas `project_id`/`cost_center_id` reservadas. |
| Meio de reembolso válido | Nome + CPF válido + (chave Pix **ou** banco+agência+conta+tipo). |
| Exclusão de relatório | Só rascunho nunca enviado; exclusão lógica. |
| Exclusão de anexo | Lógica (o arquivo é mantido no storage). |
| Duplicidade de comprovante | Hash SHA-256; alerta, nunca bloqueio. |
| E-mail | Desligado por padrão (`EXPENSES_EMAIL_NOTIFICATIONS=true` liga). Notificação interna sempre. |
| Dados bancários completos | Só na tela de registro de pagamento (gestão), com evento de auditoria; listagens e PDF mascarados. |
