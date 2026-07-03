# 02 — Roadmap de Implementação

Fases independentes e entregáveis, uma fatia por vez com validação no navegador.
Cada fase declara: **objetivo**, **entidades**, **backend**, **frontend (React/Vite)**
e **critérios de aceite**.

Legenda de status: ⬜ não iniciada · 🚧 em andamento · ✅ concluída.

---

## Fase 0 — Bootstrap & Service Hub ⬜ *(iniciando nesta etapa)*

**Objetivo:** tornar o módulo visível e "esqueletado", sem lógica de produto.

- **Backend:** `sentinelgrid/src/app.js` com `registerSentinelGrid(app, deps)` (no-op/health), `db.js`, `migrations.js` vazio idempotente, `constants.js` (enums da §6 do modelo). Toggle `SENTINELGRID_ENABLED` (default `false`) em `env.js`. Banco `sentinelgrid` + `SENTINELGRID_DATABASE_URL`.
- **Plataforma:** card **SentinelGrid** no Service Hub com selo **"Em desenvolvimento"** (feito já nesta etapa — ver [03](03-integracao-plataforma.md)); entradas em `package.json` (`moduleVersions`/`moduleStatuses`); scripts `db:migrate:sentinelgrid`, `sentinelgrid:enable/disable`; `.env.example`.
- **Frontend:** rota stub `/app/sentinelgrid` (`SentinelHomePage`) com placeholder.
- **Aceite:** Service Hub mostra o card com badge amarelo "Em desenvolvimento"; `npm run db:migrate:sentinelgrid` roda sem erro; com o toggle ligado, `/app/sentinelgrid` abre o placeholder.

---

## Fase 1 — Cadastros base (hierarquia + apoio) ⬜

**Objetivo:** CRUD da espinha dorsal `Cliente → Site → Área → Equipamento` e dos cadastros de apoio.

- **Entidades:** `sg_clients`, `sg_sites`, `sg_areas`, `sg_equipment`, `sg_manufacturers`, `sg_equipment_types`, `sg_equipment_models`, `sg_client_managers`, `sg_contracts`.
- **Backend:** migrations das tabelas; repositories + services CRUD; façade `apiV2.js` (`/admin/api/v2/sentinelgrid/*`) com validação (`validators/`).
- **Frontend:** páginas SPA `ClientsPage`, `SitesPage`, `AreasPage`, `EquipmentsPage` + cadastros de fabricante/modelo/tipo/gestor; seleção em cascata cliente→site→área no form de equipamento; ficha técnica do equipamento.
- **Aceite:** cadastrar cliente→site→área→equipamento ponta a ponta; validações §28.2 impedem equipamento órfão; listagens com filtro/paginação.
- **Risco/decisão:** definir relação com o cadastro de equipamentos do Report Service (reuso via integração vs. cadastro próprio). **Requer decisão antes de iniciar.**

---

## Fase 2 — Programas & Planos de Manutenção ⬜

**Objetivo:** modelo padrão (programa) e sua aplicação por equipamento (plano), com checklists.

- **Entidades:** `sg_maintenance_programs`, `sg_equipment_plans`, `sg_plan_items`, `sg_checklists`, `sg_checklist_items`.
- **Backend:** CRUD de programas por tipo/fabricante/modelo/criticidade; aplicação de programa → plano do equipamento com ajustes; templates de checklist por tipo/modelo/tipo-de-manutenção.
- **Frontend:** `ProgramsPage`, editor de plano do equipamento (herda do programa, permite override de periodicidade), construtor de checklist.
- **Aceite:** aplicar um programa a um equipamento gera plano individual (§28.3); checklist de UPS ≠ checklist de banco de baterias.

---

## Fase 3 — Ordens de Manutenção ⬜

**Objetivo:** ciclo de vida das OMs (preventiva sem/com parada e corretiva) com máquina de status e aprovação do cliente.

- **Entidades:** `sg_maintenance_orders`, `sg_order_corrective_details`, `sg_client_approvals`.
- **Backend:** criação de OM (manual e a partir do plano); transições de status (`planejada`…`concluida`/`cancelada`/`emergencial`); regra §28.7 (com parada exige aprovação); regra §28.8 (corretiva exige sintoma/alarme/impacto/causa/ação).
- **Frontend:** `OrdersPage` (lista + filtros por equipamento/status/tipo), editor de OM por tipo (formulários distintos), painel de aprovação do cliente.
- **Aceite:** OM sempre vinculada a equipamento (§28.1); OM com parada não avança sem aprovação registrada; corretiva bloqueia conclusão sem campos obrigatórios.

---

## Fase 4 — Execução técnica ⬜

**Objetivo:** registrar o trabalho de campo dentro da OM.

- **Entidades:** `sg_order_checklist_results`, `sg_measurements`, `sg_replaced_parts`, `sg_attachments`.
- **Backend:** endpoints de medições, peças substituídas, resultados de checklist e upload de anexos (reusar driver de storage `local`/`s3` da plataforma).
- **Frontend:** abas dentro do editor de OM (Checklist, Medições, Peças, Anexos) — padrão de painéis do Order Editor do Report Service.
- **Aceite:** medições/peças/anexos vinculados a OM+equipamento; anexos polimórficos funcionam para OM, equipamento e recomendação.

---

## Fase 5 — Relatório técnico associado + regras de encerramento ⬜

**Objetivo:** associar (não criar) relatórios técnicos e aplicar regra de bloqueio configurável.

- **Entidades:** `sg_associated_reports`.
- **Backend:** associar por código/PDF/link/ID externo; integração opcional com Report Service (buscar OS/relatório por ID); flag `requires_report` por tipo/contrato bloqueando conclusão da OM (§14).
- **Frontend:** painel "Relatório associado" na OM; indicador no histórico de quais manutenções têm relatório.
- **Aceite:** OM pode ter 0..N relatórios; conclusão respeita a política de exigência.

---

## Fase 6 — Calendário anual + Eventos/Alarmes ⬜

**Objetivo:** gerar o calendário a partir dos planos e registrar eventos que geram manutenção.

- **Entidades:** `sg_calendar_entries`, `sg_events`.
- **Backend:** geração do calendário anual por equipamento a partir de `sg_plan_items` (§28.9); registro de evento/alarme podendo gerar OM corretiva/recomendação/mudança de status.
- **Frontend:** `CalendarPage` (visão ano/mês, filtros por cliente/site/área/tipo/criticidade/técnico/status); timeline de eventos do equipamento.
- **Aceite:** calendário reflete os planos; alertas de vencido e sobreposição de paradas; evento cria OM corretiva vinculada.

---

## Fase 7 — Histórico do equipamento (prontuário) ⬜

**Objetivo:** consolidar todo o ciclo de vida do ativo com rastreabilidade.

- **Entidades:** `sg_equipment_history`.
- **Backend:** gravação automática de histórico ao concluir OMs/recomendações/eventos/mudanças de status (§28.4); rastreabilidade de alterações pós-conclusão (justificativa+usuário+data, §28.11).
- **Frontend:** `EquipmentDetailPage` como prontuário: instalação, comissionamento, manutenções, falhas, peças, recomendações abertas, condição atual, próxima manutenção, risco.
- **Aceite:** ao abrir um equipamento o usuário entende todo o seu histórico numa tela.

---

## Fase 8 — Indicadores, risco e contratos ⬜

**Objetivo:** KPIs de manutenção/confiabilidade/risco e visão contratual.

- **Backend:** agregações: planejadas×realizadas, vencidas, corretivas por equipamento/cliente/fabricante, recomendações abertas/críticas, equipamentos sem plano/sem manutenção prevista, MTBF, MTTR, cumprimento do plano anual (§27); criticidade influenciando prioridade/alertas (§28.10).
- **Frontend:** `DashboardPage` com cards e gráficos (usar a skill de dataviz), filtros por cliente/site/período.
- **Aceite:** indicadores da §27 disponíveis e filtráveis; ativos com falha recorrente destacados.

---

## Fase 9 — Mobile, integrações e polish ⬜

**Objetivo:** acesso mobile do técnico, escopos de API key e refinamentos.

- **Backend:** escopos `sentinelgrid:read/write`; endpoints mobile (execução de OM em campo).
- **Frontend:** ajustes responsivos / app de campo (alinhado à Fase 4 do plano React geral).
- **Aceite:** técnico executa OM em campo; integração de relatório e chaves de API operando.

---

## Ordem de dependências

```text
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5
                     └──────────────→ Fase 6 → Fase 7 → Fase 8 → Fase 9
```

Fases 1–3 são o caminho crítico. Fases 6–8 dependem de dados reais das fases 3–5.

## Decisões (ver [05 — ADRs](05-decisoes-arquiteturais.md))

Resolvidas:
1. ~~Equipamentos: reuso vs. cadastro próprio~~ → **registry próprio** com `external_ref`/snapshot ([ADR-004](05-decisoes-arquiteturais.md)); isolamento total, sem reuso de outro módulo ([ADR-001](05-decisoes-arquiteturais.md)).
2. ~~Integração de relatório~~ → **API read-only, acoplamento fraco, sem escrita compartilhada** ([ADR-005](05-decisoes-arquiteturais.md)).

Ainda abertas:
- **Topologia de deploy** ([ADR-003](05-decisoes-arquiteturais.md), Pendente): módulos deployados separadamente? Define transporte HTTP real vs. contrato in-process remote-ready.
- **Escopo do MVP** ([ADR-011](05-decisoes-arquiteturais.md), Proposta): sugestão Fases 0–3 + sink de histórico — aguarda confirmação.
