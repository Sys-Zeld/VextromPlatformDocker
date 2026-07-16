# 07 — Gerar Demanda

> **Esboço de implementação.** Define o item **Gerar Demanda** dentro de *Programa de manutenção*,
> com os subitens **Agendado** e **Agenda técnica**. Depende de
> [06 — Modelo Conceitual](06-modelo-conceitual.md) (camadas 2 e 5) e da integração com o Report
> Service descrita em [03 — Integração Plataforma](03-integracao-plataforma.md).

## A tese

Hoje a ponte SentinelGrid → Report Service é **1 OM = 1 OS**
(`sendOrderToReportService`, [`reportServiceIntegration.js:131`](../src/services/reportServiceIntegration.js)).
Isso é errado no campo: o técnico que vai ao **Site Alpha do cliente ACME no dia 20/07** para
atender três UPS não abre três Ordens de Serviço — ele abre **uma**, com três equipamentos.

**Gerar Demanda** é o passo que faltava entre *planejar* e *executar*:

```text
Plano → OM (agendada) → [ Gerar Demanda ] → OS no Report Service → Execução
                              ↑
                  agrupa por Cliente + Site + Dia
```

| Subitem | Pergunta que responde | Estado |
|---------|----------------------|--------|
| **Agenda técnica** | *Quem* faz? Aloca técnico na OM. | Existe ([`TechnicianAgendaPage.tsx`](../../frontend/src/pages/sentinelgrid/TechnicianAgendaPage.tsx)) — apenas **movida** para cá |
| **Agendado** | *O que vira OS?* Agrupa OMs e dispara a geração. | **Novo** |

---

## Regra de agrupamento

### A chave

```text
grupo = (client_id, site_id, data_inicio)
data_inicio = COALESCE(scheduled_date::date, planned_date)
```

Dia **exato**, não janela. Uma OM com `execution_days > 1` agrupa apenas com quem **começa no
mesmo dia** — a OS herda a maior data-fim do grupo. Isso mantém o grupo legível na tela: o usuário
vê uma data e entende o grupo sem raciocinar sobre sobreposição de intervalos.

O **técnico não entra na chave**. A OS recebe a **união** dos técnicos das OMs do grupo
(`sg_order_technicians`), porque uma mobilização de campo com dois técnicos no mesmo site continua
sendo uma OS só.

### Elegibilidade

Uma OM entra em *Agendado* quando:

| Condição | Motivo |
|----------|--------|
| `status = 'agendada'` | Já é o gate atual de `sendOrderToReportService`. Antes disso a OM não tem data firme. |
| `rs_service_order_id IS NULL` | Ainda não virou OS. |
| `deleted_at IS NULL` | — |
| tem data (`scheduled_date` ou `planned_date`) | Sem data não há chave de grupo. |

OMs do mesmo cliente/site/dia que **já** têm `rs_service_order_id` aparecem no grupo como
**"já em OS #X"** (linha travada, não selecionável para nova geração) — mas habilitam a ação
*anexar à OS existente* em vez de criar uma segunda.

### O grupo não é uma entidade

Nada de tabela `sg_demands`. O agrupamento é uma **leitura derivada** das OMs, exatamente como o
calendário anual (§28.9 — *derivado, nunca digitado à mão*). A persistência do fato é a própria OS:
`rs_service_order_id` já é uma coluna comum na OM, **não um índice único**, então N OMs apontando
para a mesma OS já é representável **sem migration**.

> **Regra dura §28.12 (nova)** — a demanda é derivada. Se o usuário mudar a data ou o site de uma
> OM, o grupo se desfaz sozinho na próxima leitura. Não existe grupo "salvo" para ficar obsoleto.

---

## Contrato de API

Novo router `sentinelgrid/src/routes/demands.js`, montado em `/api/sentinelgrid/demands`.

### `GET /api/sentinelgrid/demands/scheduled`

Query: `from`, `to`, `clientId?`, `siteId?`, `search?`.

```jsonc
{
  "groups": [
    {
      "groupKey": "12:34:2026-07-20",          // client:site:data — id estável p/ o React
      "clientId": 12, "clientName": "ACME",
      "siteId": 34,   "siteName": "Site Alpha",
      "date": "2026-07-20",
      "endDate": "2026-07-22",                 // maior fim do grupo (execution_days)
      "status": "pendente",                    // pendente | parcial | gerada
      "rsServiceOrderId": null,                // preenchido se status != pendente
      "rsServiceOrderCode": "",
      "technicians": [{ "id": 5, "name": "João" }],   // união
      "orders": [
        {
          "orderId": 1041, "orderNumber": "OM-1041",
          "equipmentId": 88, "equipmentTag": "UPS-01",
          "maintenanceType": "preventiva_com_parada",
          "executionDays": 1,
          "technicians": [{ "id": 5, "name": "João" }],
          "rsServiceOrderId": null             // != null → já em OS, linha travada
        }
      ]
    }
  ]
}
```

`status` do grupo: `pendente` (nenhuma OM enviada) · `parcial` (algumas) · `gerada` (todas).

### `POST /api/sentinelgrid/demands/generate`

```jsonc
{ "groups": [ { "clientId": 12, "siteId": 34, "date": "2026-07-20", "orderIds": [1041, 1042, 1055] } ] }
```

Resposta por grupo: `{ groupKey, rsServiceOrderId, rsServiceOrderCode, orderIds, reused, skipped[] }`.

**Guardas do servidor** (nunca confiar no `orderIds` do cliente):

1. Recarrega cada OM e **revalida a chave** — toda OM do payload precisa bater com
   `(clientId, siteId, date)` do grupo. Divergência → `SG_DEMAND_GROUP_MISMATCH`.
2. Toda OM precisa estar `agendada`. Reusa a mensagem existente `SG_ORDER_NOT_SCHEDULED`.
3. OM já com `rs_service_order_id` → vai para `skipped[]` com o código da OS, não aborta o grupo.
4. `pg_advisory_xact_lock` por OM (namespace `71001`, o mesmo do envio individual) **+** um lock de
   lote — impede duas OSs concorrentes para o mesmo grupo. O namespace do lote é **`71004`**:
   `71002` e `71003` já estão ocupados por `importReportServiceTechnician` e
   `exportTechnicianToReportService`.

---

## A geração da OS

O serviço atual já faz 90% do trabalho. O refactor é **extrair o que é por-OM do que é por-OS**:

```text
sendOrderGroupToReportService(orderIds[], actor)     ← novo, transacional
  ├─ ensureCustomerByRef(cliente)                    ] 1× por grupo
  ├─ ensureSiteByRef(site)                           ]
  ├─ createOrder({ customerId, siteId, title, ... }) ] 1× por grupo  ← era 1× por OM
  ├─ para cada OM:
  │    ├─ ensureEquipmentByRef(equipamento)
  │    └─ linkOrderEquipment(rsOrderId, equipmentId)
  ├─ para cada técnico da união:
  │    └─ exportTechnicianToReportService + linkTechnicianToOrder
  └─ UPDATE sg_maintenance_orders SET rs_service_order_id=..., rs_sent_at=NOW()
       WHERE id = ANY(orderIds)                      ← carimba TODAS as OMs do grupo
```

`sendOrderToReportService(orderId)` passa a ser **`sendOrderGroupToReportService([orderId])`** —
o botão "Enviar para OS" que já existe na tela de Ordens continua funcionando, sem lógica duplicada
de `ensureCustomer/Site/Equipment`.

O cliente e o site da OS vêm do **equipamento** (`equipmentRepository.getEquipment`), não das
colunas da OM — é a fonte que `sendOrderToReportService` já usava, e mantê-la evita divergência
entre o que a OM diz e o que o cadastro do ativo diz.

### Título e descrição da OS

Hoje: `"OM-1041 - trocar baterias"`. Com N OMs isso não serve. Novo formato:

| Campo | Conteúdo |
|-------|----------|
| `title` | `Site Alpha — 20/07/2026` (site + data do grupo) |
| `description` | Uma linha por OM: `OM-1041 · UPS-01 · preventiva com parada — trocar baterias` |

Grupo de **uma** OM mantém o título antigo (`OM-1041 - escopo`), para não regredir o fluxo atual.

---

## Equipe da OS — alocação no grupo

O técnico chega na OS pela união dos técnicos das OMs. Alocar OM a OM (na *Agenda técnica*) é o
caminho do planejamento; na tela *Agendado* a equipe é editada **no grupo**, porque quem vai a
campo vai à mobilização inteira, não a um equipamento.

`PUT /api/sentinelgrid/demands/technicians` com `{ orderIds, technicianIds }`:

- A lista enviada é a **final** (semântica de *replace*, não de *append*): quem sai dela é
  desvinculado de **todas** as OMs do grupo.
- Vale para todas as OMs do grupo, inclusive as já enviadas — e, se a OS já existe, a equipe dela é
  sincronizada no Report Service (vincula quem entrou, **desvincula quem saiu**). Só adicionar
  deixaria técnico removido preso na OS.
- O conflito de agenda continua valendo, e **não atrapalha**: `validateTechnicianSchedule` só acusa
  quando o técnico está em **outro** cliente/site no período
  (`o.client_id<>$6 OR o.site_id IS DISTINCT FROM $7`). Como o grupo é, por definição, um único
  cliente/site/dia, alocar o técnico no grupo inteiro nunca conflita consigo mesmo.

> **Contrato de serviço (ADR-001/005)** — o SentinelGrid não toca o repo do Report Service.
> `unlinkTechnicianFromOrder` e `listOrderTechnicians` existiam no repo mas **não** no serviço;
> foram expostos em `serviceReportService.js` para que a sincronização passe pelo contrato.

## Duração — da OS, aplicada a todas as OMs do grupo

`execution_days` (migration 022) é uma coluna **por OM** — é ela que ocupa a agenda do técnico.
Mas o que dura não é o equipamento, é a **mobilização**: se a equipe fica três dias no Site Alpha,
as três OMs daquela OS duram três dias. Então a duração é editada **no grupo** e gravada em
`execution_days` de todas as OMs dele. Mesma tese da equipe (Camada 7, passo 4).

`PUT /api/sentinelgrid/demands/duration` com `{ orderIds, executionDays }`:

- Grava o mesmo `execution_days` em **todas** as OMs do grupo, com `FOR UPDATE` e a mesma
  revalidação de chave (cliente/site/dia) do resto do módulo.
- Só mexe em `execution_days`. **Não** é o `rescheduleOrder` da Agenda técnica: aquele reescreve
  `planned_date` junto (efeito colateral correto para o *arrastar* no calendário, errado para mudar
  só a duração).
- Esticar a mobilização passa pelo `validateTechnicianSchedule` **por OM**: se a nova duração fizer
  o técnico invadir uma frente em **outro** cliente/site, o backend recusa com
  `SG_TECHNICIAN_SCHEDULE_CONFLICT` e o card mostra o conflito.
- O campo do card mostra a **maior** duração do grupo — OMs criadas antes podem ter durações
  divergentes, e é a maior que define o fim da mobilização. Gravar iguala todas.

## Consistência — quando a OS é apagada no Report Service

`repo.deleteOrder` no RS é **DELETE físico** (`DELETE FROM service_report_orders`) e as três rotas de
exclusão (api, apiV2, web) passam por `deleteOrderFull`. Como **não há FK entre os bancos**, o
carimbo `rs_service_order_id` na OM vira um ponteiro para o nada.

> **Regra dura §28.13 (nova)** — o carimbo é **hipótese, não verdade**. Um vínculo entre módulos só
> vale enquanto as duas pontas concordam. É a mesma filosofia de
> `registrySync.reconcileMutualLink`, aplicada agora à OS.

O estrago tem duas caras, e a segunda é a grave:

| Sintoma | Efeito |
|---------|--------|
| Visível | Grupo aparece como `gerada`, com link quebrado para uma OS que não existe. |
| **Invisível** | `sendOrderGroupToReportService` **reusava** o id morto e devolvia `reused: true` — o grupo travava para sempre e **nunca** criava OS nova. |

### Três camadas

| # | Camada | Onde |
|---|--------|------|
| 1 | **Cura na escrita** — antes de reusar um carimbo, confirma no RS que a OS existe; se sumiu, desfaz o vínculo *dentro da mesma transação* e a OM volta a contar como pendente. Destrava o botão. | `sendOrderGroupToReportService` |
| 2 | **Detecção na leitura** — `GET /demands/scheduled` confirma em lote os carimbos do período; se algum for órfão, desfaz e relê. A tela se autocorrige. | `routes/demands.js` |
| 3 | **Reconciliação** — `POST /demands/reconcile` e `npm run sentinelgrid:reconcile-orders [-- --dry-run]` varrem **todas** as OMs carimbadas, não só as do período em tela. | `scripts/sentinelgrid-reconcile-orders.js` |

Todas as três chamam a mesma `clearOrphanServiceOrderLinks()` — uma consulta de existência em lote
(`rs.listExistingOrderIds`), nunca uma OS por vez.

### O que a OM vira

Volta a ser **pendente** (`rs_service_order_id`, `rs_service_order_code`, `rs_sent_at` limpos) e
**continua `agendada`** — o trabalho de campo não deixou de existir só porque alguém apagou a OS.
A desvinculação vai para `sg_equipment_history` (`event_kind = 'os_desvinculada'`), como manda §28.4.

### Por que não um hook no `deleteOrderFull`

Fazer o RS avisar o SentinelGrid inverteria a dependência que os **ADR-001/005** estabelecem: o SG
consome o contrato do RS, nunca o contrário. O Report Service deve continuar ignorando que o
SentinelGrid existe. A detecção é **pull**, não push.

> **Contrato de serviço** — `getOrderById` e a existência em lote viviam só no repo do RS. Foram
> expostos em `serviceReportService.js` (`getOrder`, `listExistingOrderIds`) para a checagem passar
> pelo contrato, não pelo banco alheio.

## Não duplicar cliente / site / equipamento no Report Service

Gerar a OS chama `ensureCustomerByRef` / `ensureSiteByRef` / `ensureEquipmentByRef`. Eles procuravam
**apenas** por `(external_source='sentinelgrid', external_id=<id no SG>)`. O buraco: o
`registrySync` (importar cliente do RS → SG) vincula um registro **que já existe** no RS gravando só
o `sentinelgrid_id` — **sem** a referência externa. O RS tinha `setSentinelGridLink` para *escrever*
esse vínculo e **nenhuma função para lê-lo**. Resultado: gerar a OS não encontrava o cliente e
**criava uma duplicata**.

### O sintoma real: o campo `tipo`

Na base, o RS já tinha os clientes cadastrados à mão — KN Açu (`offshore`), ARCELORMITTAL
(`onshore`) — **sem vínculo** com o SG. Gerar a OS criou gêmeos idênticos, exceto por um campo:
`customer_type = 'others'`. O SentinelGrid **não tem** o conceito de tipo de cliente e manda
`'others'` fixo. O tipo é o único campo que difere — e por isso não pode entrar no casamento.

### Cadeia de resolução (antes de criar qualquer coisa)

| Ordem | Critério | Cliente | Site | Equipamento |
|-------|----------|:-------:|:----:|:-----------:|
| 1 | Referência externa (`external_source` + `external_id`) | ✅ | ✅ | ✅ |
| 2 | **`sentinelgrid_id`** — a outra ponta, gravada por quem importou do RS | ✅ | ✅ | ✅ |
| 3 | Chave natural | **nome normalizado** | nome dentro do cliente | **tag** dentro do cliente |
| 4 | Chave natural (2ª) | — | — | nº de série **se inequívoco** |
| 5 | Criar | ✅ | ✅ | ✅ |

**Nome normalizado** = sem caixa, sem acento, sem espaço nas pontas (via `TRANSLATE`, sem depender
da extensão `unaccent`). O `customer_type` fica **fora** do casamento e **não é sobrescrito** na
adoção: o `offshore` do RS sobrevive, o `'others'` do SG nunca é gravado por cima.

> **A tag é a chave do equipamento, não a série.** Na base real o mesmo nº de série aparece em
> unidades diferentes (`L13-0640` em duas, `L07-0515` em três). O RS já trata a tag como única por
> site (`ensureEquipmentTagUnique`). A série só casa quando retorna **exatamente um** equipamento —
> série ambígua devolve `null` e deixa criar, porque adotar qualquer um seria chutar.

Ao adotar, a referência externa é **recarimbada** (`backfillExternalRef`) e o equipamento órfão
ganha dono (`backfillEquipmentOwner`, que só preenche o que está vazio — nunca sequestra um
equipamento de outro cliente). A cura é permanente: a próxima geração o encontra pelo caminho 1.

O `registrySync` (exportar SG → RS) chama os mesmos `ensure*`, então herda a deduplicação de graça.

**Verificado contra o banco real:** cliente novo com nome `KN ACU SERVICOS...` (sem acento, caixa
diferente) **adotou o original** (id 4, não o gêmeo 24) preservando `customer_type='offshore'`;
equipamento adotou o original pela tag preservando o `type`; série ambígua (`L13-0640`) foi
corretamente **recusada**; nenhum registro criado.

> ⚠️ **Dívida conhecida** — os 4 clientes do SG já estão vinculados aos **gêmeos**
> (`sg_clients.service_report_id = 24`, e o gêmeo carrega `external_id='41'`). Como o caminho 1
> resolve primeiro, as próximas OSs desses clientes continuam caindo no gêmeo. A correção acima
> vale para **clientes novos**; repontar os existentes exige um script de revinculação.

## Mudança na navegação

O menu lateral hoje suporta **um** nível de submenu: `NavGroup.children` é tipado `NavItem[]` e o
render usa um único booleano `programMenuOpen` ([`Layout.tsx:213`](../../frontend/src/components/Layout.tsx)).
Para *Gerar Demanda* ser um grupo **dentro** de *Programa de manutenção*:

1. `NavGroup.children: NavEntry[]` (recursivo, em vez de `NavItem[]`).
2. Estado de abertura vira `Record<string, boolean>` keyed por `group.key`, não um booleano só.
   Um grupo abre automaticamente quando a rota ativa está sob ele (é o que `programMenuActive` já
   faz, mas precisa valer por grupo).
3. Extrair `renderNavEntry(entry, depth)` e chamar recursivamente; `depth` controla
   `vx-nav__link--child` e o tamanho do `SgIcon` (29 → 24 → 20).
4. CSS: `.vx-nav-group__children .vx-nav-group__children` ganha o recuo do segundo nível.

Árvore final:

```text
Programa de manutenção
├── Programas
├── Planos
├── Ordens
├── Gerar Demanda          ← novo grupo
│   ├── Agendado           ← /sentinelgrid/demands/scheduled   (novo)
│   └── Agenda técnica     ← /sentinelgrid/technician-agenda   (rota mantida, só muda de lugar)
├── Checklists
└── Assets
```

A rota `/sentinelgrid/technician-agenda` **não muda** — só a posição no menu. Nenhum link salvo
quebra.

---

## Tela *Agendado*

Uma lista de **cards de grupo**, não uma tabela de OMs. O agrupamento é a informação principal.

```text
┌─ ACME · Site Alpha · 20/07/2026 ────────────────── [pendente] ─┐
│ Técnicos: João, Maria          Fim previsto: 22/07             │
│ ☑ OM-1041  UPS-01   preventiva c/ parada   3 dias   João       │
│ ☑ OM-1042  UPS-02   preventiva            1 dia    João        │
│ ☑ OM-1055  BAT-07   preventiva            1 dia    Maria       │
│ ⛔ OM-1060  UPS-09   já em OS-2026-0231  → abrir                │
│                              [ Gerar OS (3 OMs) ]              │
└────────────────────────────────────────────────────────────────┘
```

- Filtros no topo: período (`from`/`to`, default = próximos 30 dias), cliente, site, busca.
- Seleção por OM **dentro** do grupo — o usuário pode excluir uma OM do lote sem desfazer o grupo.
- Ação em massa: **Gerar todas as OSs pendentes** do período (um `POST` com N grupos).
- Grupo `gerada` colapsa e mostra só o código da OS + link para o Report Service.

Frontend novo: `frontend/src/pages/sentinelgrid/DemandScheduledPage.tsx` +
`frontend/src/api/sentinelgrid/demands.ts`. Reaproveita o padrão de filtros/tabela de
[`MaintenanceOrdersPage.tsx`](../../frontend/src/pages/sentinelgrid/MaintenanceOrdersPage.tsx).

---

## Fatias de entrega

| # | Fatia | Arquivos | Estado |
|---|-------|----------|--------|
| 1 | **Nav recursiva** — `NavGroup.children: NavEntry[]`, estado de abertura por chave de grupo, `renderNavEntry(entry, depth)`. O recuo do 2º nível sai de graça: `.vx-nav-group__children` já tem `padding-left: 18px` e o aninhamento compõe. | `Layout.tsx` | ✅ |
| 2 | **Refactor da integração** — `sendOrderGroupToReportService([ids])`; `sendOrderToReportService` vira wrapper de grupo-de-1. | `reportServiceIntegration.js` | ✅ |
| 3 | **Leitura dos grupos** — `GET /demands/scheduled`. | `demandsRepository.js`, `routes/demands.js`, `apiV2.js` | ✅ |
| 4 | **Geração em lote** — `POST /demands/generate` com as guardas + advisory lock. Um grupo que falha não derruba os outros do lote. | `routes/demands.js` | ✅ |
| 5 | **Tela Agendado** — cards de grupo, seleção por OM, geração em massa. | `DemandScheduledPage.tsx`, `api/sentinelgrid/demands.ts`, `App.tsx` | ✅ |
| 6 | **Equipe da OS** — `PUT /demands/technicians` (replace no grupo + sync da OS), editor de equipe no card. | `demandService.js`, `routes/demands.js`, `serviceReportService.js`, `DemandScheduledPage.tsx` | ✅ |
| 7 | **Duração da OS** — `PUT /demands/duration` (aplica `execution_days` a todas as OMs do grupo, com validação de conflito), campo no card. | `demandService.js`, `routes/demands.js`, `DemandScheduledPage.tsx` | ✅ |

| 8 | **Consistência OS apagada** — `clearOrphanServiceOrderLinks` nas três camadas + script de reconciliação. | `reportServiceIntegration.js`, `routes/demands.js`, `serviceReportService.js`, `scripts/` | ✅ |

**Verificado em execução:** a reconciliação foi exercitada contra o banco real — carimbo apontado
para uma OS inexistente, `clearOrphanServiceOrderLinks` desfez **só** a órfã (`checked: 4,
cleared: [741]`, as 3 OSs vivas intactas), a OM permaneceu `agendada` e o histórico
`os_desvinculada` foi gravado.

**Falta verificar em execução:** gerar uma OS a partir de um grupo real com duas OMs e conferir no
Report Service que ela saiu com os dois equipamentos e a união dos técnicos.
