# Relatório de Despesas — Progresso

Última atualização: 2026-10-27. Plano: `implementation-plan.md`.

## Situação das fases

| Fase | Situação | Observação |
|---|---|---|
| 1. Análise | ✅ Concluída | `implementation-plan.md` |
| 2. Banco de dados | ✅ Implementada · ⏳ execução pendente | Migration escrita; **não executada** (sem Postgres no ambiente de desenvolvimento usado). |
| 3. Cadastro complementar | ✅ Implementada | Tela "Meu Perfil de Reembolso"; CPF/conta/Pix cifrados. |
| 4. Relatórios | ✅ Implementada | Criação, listagem com filtros/paginação, edição, exclusão de rascunho, numeração `RD-AAAA-NNNNNN`. |
| 5. Lançamentos e comprovantes | ✅ Implementada | Upload múltiplo com arrastar-e-soltar, validação por assinatura binária, duplicidade por SHA-256 (alerta). |
| 6. Workflow | ✅ Implementada | Máquina de estados central + `FOR UPDATE`; histórico e auditoria. |
| 7. Reembolsos | ✅ Implementada | Pagamento integral único (status + índice único), snapshot bancário cifrado, comprovante. |
| 8. Dashboards | ✅ Implementada | Usuário e gestão, filtro por período, gráficos Recharts. |
| 9. PDF e notificações | ✅ Implementada | PDF (pdfkit), ZIP (PDF + comprovantes), notificações internas + e-mail opcional. |
| 10. Testes e homologação | 🟡 Parcial | 27 testes unitários passando; homologação com banco pendente (roteiro abaixo). |

## Como habilitar

```bash
npm run expenses:enable            # EXPENSES_ENABLED=true no .env (exige REACT_APP_ENABLED=true)
# Recomendado ANTES do primeiro uso: EXPENSES_DATA_KEY=<openssl rand -base64 48> no .env
npm run db:migrate:expenses        # cria o banco "expenses" e aplica 001_init.sql
cd frontend && npm run build       # SPA com as novas telas
```

O card **Relatório de Despesas** aparece no Service Hub e abre `/app/expenses`.

## Arquivos

**Novos — backend (`expenses/`)**
- `migrate.js`, `migrations/001_init.sql`
- `src/app.js`, `src/db.js`, `src/constants.js`, `src/migrations/runner.js`
- `src/lib/` — `money.js`, `cpf.js`, `crypto.js`, `fileSignature.js`, `errors.js`
- `src/policies/expensePolicy.js` — autorização e transições centralizadas
- `src/validators/expenseValidators.js`
- `src/repositories/` — `reportRepository`, `profileRepository`, `categoryRepository`, `paymentRepository`, `auditRepository`, `dashboardRepository`
- `src/services/` — `reportService`, `reviewService`, `paymentService`, `profileService`, `dashboardService`, `notificationService`, `auditService`, `pdfService`
- `src/routes/apiV2.js`
- `tests/rules.test.js`, `tests/policy.test.js`

**Novos — frontend**
- `frontend/src/api/expenses.ts`
- `frontend/src/components/expenses/NotificationBell.tsx`
- `frontend/src/pages/expenses/` — `DashboardPage`, `MyReportsPage`, `NewReportPage`, `ReportDetailPage`, `ReportForm`, `ExpenseItemModal`, `AttachmentViewer`, `ProfilePage`, `HistoryPage`, `NotificationsPage`, `charts`, `shared`
- `frontend/src/pages/expenses/admin/` — `AdminDashboardPage`, `AdminReportsPage`, `PaymentsPage`, `CategoriesPage`, `AuditPage`

**Modificados (aditivos)**
- `specflow/app.js` — gates de capacidade, `registerExpenses`, resolvedor de identidade, gate `/app/expenses`, card do hub
- `specflow/config/env.js`, `specflow/db/migrate.js`, `specflow/services/accessControl.js`
- `views/admin-module-hub.ejs` — ícone do card
- `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/api/session.ts`
- `package.json`, `.env.example`, `scripts/modules-toggle.js`, `scripts/backup-module-database.js`, `scripts/restore-database.js`

## Banco de dados

Banco novo e isolado `expenses` (`EXPENSES_DATABASE_URL`). Nenhuma alteração nos bancos existentes.
Tabelas: `ex_categories` (9 categorias iniciais), `ex_profiles`, `ex_report_sequences`, `ex_reports`, `ex_items`,
`ex_attachments`, `ex_approval_history`, `ex_payments`, `ex_audit_log`, `ex_notifications`, `ex_module_meta`, `ex_schema_migrations`.
Triggers impedem UPDATE/DELETE em histórico, auditoria e pagamentos, e DELETE físico em relatórios.

## Login próprio do módulo (2026-10-27) — substitui o modelo abaixo

O módulo **não usa mais o login do Service Hub**. Contas, senhas e sessão são do próprio módulo (migration `004_auth.sql`).

- **Contas:** tabela `ex_users` (ids `ex:<uuid>`), senha com hash scrypt e salt. Papéis: Colaborador (toda conta ativa),
  Aprovador, Financeiro e **Administrador do módulo** (usuários, configurações, auditoria). Exclusão lógica.
- **Sessão:** cookie `ex_session` (HttpOnly, SameSite=Lax, Secure em HTTPS), assinado com HMAC e revalidado no banco
  a cada requisição. Desativar, excluir, trocar a senha ou o e-mail derruba as sessões abertas.
- **API:** `/api/expenses` (fora de `/admin/api/v2`, que exige o login do hub), com CSRF e rate limit
  (login e recuperação: 30 por IP a cada 15 min).
- **SPA:** `/app/expenses/login`, `forgot-password`, `set-password` e `reset-password` são públicas. As demais telas
  exigem a sessão do módulo. Os estáticos do bundle (`/app/assets/*`, `/app/img/*`, `/app/theme-init.js`) passaram a
  ser públicos para a tela de login carregar: é só código, sem dados. Todas as telas do hub continuam exigindo o login do hub.
- **Recursos:** esqueci minha senha (link de 1 h), convite (link de 72 h, uso único), bloqueio após 5 erros por 15 min
  (desbloqueio pelo administrador), troca de senha, senha provisória com troca obrigatória e card mantido no hub.
- **Primeiro administrador:**
  `docker compose exec app npm run expenses:admin:create -- --username <usuario> --email <email>`
  (sem `--password`, gera uma senha provisória, exibida uma única vez).
- **Começou do zero:** o cadastro anterior (`ex_members`, ligado às contas do hub) fica preservado no banco, sem uso.
  Relatórios antigos, se houver, continuam visíveis para a gestão.
- **Plataforma:** a capacidade `expenses:submit` foi removida. O perfil "Colaborador (Despesas)" do hub ficou sem
  capacidades (contas antigas criadas por ele não acessam nada no hub). Exclua-as em Manutenção do Sistema → Usuários, se quiser.
- **Validação:** 37 testes unitários, mais um E2E de 46 verificações contra um banco descartável (`expenses_e2e`), apagado ao final.

## Usuários e papéis (cadastro próprio do módulo — 2026-10-27) — SUBSTITUÍDO pelo login próprio acima

O acesso ao módulo é definido na tela **Usuários** (`/app/expenses/users`), e não mais pelo perfil da plataforma.
Tabela `ex_members` (migration `002_members.sql`). O login continua sendo a conta da plataforma.

| Papel | Pode |
|---|---|
| Colaborador (todo membro ativo) | Lançar despesas, enviar e acompanhar os próprios relatórios |
| Aprovador | Ver todos os relatórios, iniciar análise, aprovar, rejeitar, devolver, gerenciar categorias |
| Financeiro | Ver todos os relatórios, consultar dados bancários, registrar pagamentos |
| Administrador da plataforma | Tudo acima (implícito) + gerenciar usuários do módulo |

- Sem cadastro (ou desativado) = sem acesso: API responde 403 `EX_NO_ACCESS`, o SPA bloqueia e o card do hub mostra "Sem acesso".
- A migration 002 cadastrou como Colaborador quem já tinha relatório, para ninguém perder o acesso.
- **Nova conta** pela tela Usuários: cria a conta na plataforma com o novo perfil **Colaborador (Despesas)** (`expense_user`,
  só `expenses:submit`, sem outros módulos) e envia o convite de senha pelo mecanismo existente (`sendInvite`).
- A capacidade `expenses:manage` foi removida. Os papéis de gestão vêm do cadastro do módulo.

## Configuração de e-mail do módulo (2026-10-27)

Tela **Configurações** (`/app/expenses/settings`, administrador da plataforma). Tabela `ex_settings` (migration `003_settings.sql`).

- **Servidor:** "SMTP da plataforma" (padrão) ou "SMTP próprio do módulo" (servidor, porta, SSL, usuário, senha, remetente).
  A senha é gravada criptografada com `EXPENSES_DATA_KEY` e nunca volta para a tela.
- **Notificações por e-mail:** liga/desliga salvo no banco. Sem valor salvo, vale `EXPENSES_EMAIL_NOTIFICATIONS`.
- **Uso:** notificações do workflow e convites de novas contas (criar conta e **Reenviar convite** na tela Usuários).
- **Teste:** botão "Enviar teste", que usa a configuração salva e mostra o erro real do servidor.
- **Plataforma:** `sendTransactionalEmail` e `sendInvite` passaram a aceitar `smtp` opcional (compatível; sem ele, nada muda).
  Se o envio do convite falhar, o link segue no erro, para o administrador poder entregá-lo manualmente.
- Alterações e testes de envio ficam na auditoria (sem a senha).

## Rotas e permissões

| Prefixo | Gate no hub | Regra |
|---|---|---|
| `/app/expenses/*` (SPA) | sessão + cadastro no módulo | membro ativo ou admin da plataforma |
| `/app/expenses/admin/*` (SPA) | sessão + cadastro no módulo | Aprovador ou Financeiro |
| `/admin/api/v2/expenses/*` | sessão + CSRF + `expenses:submit` | o módulo revalida o cadastro a cada requisição |
| `/admin/api/v2/expenses/admin/users*` | idem | administrador da plataforma |

Além dos gates, toda operação passa por `expensePolicy` (dono/papel, estado editável, transição válida, autoaprovação).

## Testes

`npm run test:expenses` — 27/27 passando: dinheiro em centavos, CPF, máscaras, criptografia (adulteração/chave errada),
assinatura de arquivos (exe disfarçado, extensão trocada, tamanho), validadores, prontidão de reembolso, indicadores,
matriz completa de transições, escalada de privilégio, autoaprovação, decisões concorrentes.
Também verificados: smoke HTTP da façade (403/404/400), geração de PDF e ZIP, `tsc --noEmit` e `vite build` do frontend.

**Não executado:** testes com banco real (migração, transações, triggers, índice único de pagamento).

## Roteiro de homologação (executar com o Docker de desenvolvimento)

1. Usuário (ex.: Técnico) preenche **Meu Perfil de Reembolso** (CPF + Pix).
2. Cria relatório, adiciona 3 despesas com comprovantes (PDF/JPG); tenta enviar com uma despesa sem comprovante → bloqueio listado.
3. Envia. Confirmar que edição fica bloqueada e que a gestão recebe notificação.
4. Administrador: **Todos os relatórios → Pendentes**, abre, **Iniciar análise**, **Devolver** com justificativa.
5. Usuário corrige um valor, **Reenvia**; total recalculado.
6. Administrador **Aprova**; em **Reembolsos**, **Registrar pagamento** (com comprovante). Tentar pagar de novo → 409.
7. Usuário vê **PAGO**, histórico completo e exporta **PDF** e **ZIP**.
8. Segurança: com outro usuário, abrir `/admin/api/v2/expenses/reports/<id>` alheio → 404; chamar `/admin/...` sem ser administrador → 403;
   enviar `.exe` renomeado para `.pdf` → 415; administrador tentar aprovar o próprio relatório → 403.
9. Conferir **Auditoria** (inclui "Dados bancários consultados").

## Decisões técnicas

Ver `implementation-plan.md` §9. Destaques: total sempre calculado no banco; dinheiro como string/centavos; exclusões lógicas;
dados sensíveis cifrados com AES-256-GCM; pdfkit em vez de Puppeteer; notificações internas próprias (não havia infra genérica).

## Pendências / limitações

- Executar a migração e o roteiro de homologação acima com Postgres.
- `EXPENSES_DATA_KEY` deve ser definida antes do primeiro cadastro; trocá-la depois torna CPF/conta/Pix ilegíveis (não há rotação de chave).
- Projeto e centro de custo são texto livre (sem cadastro); colunas `project_id`/`cost_center_id` reservadas.
- Sem testes automatizados de integração com banco (o repositório não tem infraestrutura para isso).
- O nome da empresa no PDF vem de `EXPENSES_COMPANY_NAME` (sem logotipo).
- Evoluções previstas no modelo: aprovação/pagamento parciais (`approved_amount` por item, `payment_type = 'PARCIAL'`).
