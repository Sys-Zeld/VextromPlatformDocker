# 06 — Modelo Conceitual e Fluxo

> **Esboço de apresentação.** Este documento descreve o **fluxo entre as entidades**, não o
> schema físico. Para o schema (colunas, FKs, enums), ver
> [01 — Modelo de Dados](01-modelo-de-dados.md). Versão visual:
> [`modelSentinelGrid.html`](modelSentinelGrid.html).

A tese do módulo em uma linha:

```text
Programa (modelo padrão)  →  Plano (aplicação ao ativo)  →  Ordem de Manutenção (execução)
                                        ↑                              │
                                        └────── Histórico do Equipamento ←┘
```

O ciclo **não é linear, é fechado**: o que a OM descobre em campo volta ao prontuário do ativo e
recalibra o próprio plano.

## Legenda das entidades

| Notação | Significado |
|---------|-------------|
| **Eixo** | `sg_equipment` — tudo no módulo pendura aqui |
| **Transacional** | O fato acontecido (OM, medição, evento) |
| **Referência** | Cadastro de apoio (fabricante, modelo, contrato) |
| **Externa** | Vive fora do módulo; associação por contrato (relatório técnico) |

---

## Camada 1 — Onde o ativo vive

A hierarquia é **obrigatória, não opcional**. Nenhum equipamento existe solto — a cadeia é o que
dá escopo a contrato, calendário, aprovação e indicador.

```text
Cliente ──1—N──> Site ──1—N──> Área ──1—N──> Equipamento
```

| Entidade | Tabela | Papel |
|----------|--------|-------|
| Cliente | `sg_clients` | A empresa atendida. Dona do contrato e dos gestores que aprovam parada. |
| Site | `sg_sites` | Unidade física: data center, plataforma offshore, fábrica, subestação. |
| Área | `sg_areas` | Sala de UPS, sala de baterias, data hall. Carrega restrição de acesso e condição ambiental. |
| **Equipamento** | `sg_equipment` | O ativo físico. **Entidade-eixo.** |

> **Regra dura §28.2** — `client_id`, `site_id` e `area_id` são **NOT NULL** no equipamento.
> Apagar uma Área com equipamento dentro é **bloqueado**, nunca cascateado.

---

## Camada 2 — A espinha: do modelo padrão à ordem executada

A pergunta central do desenho: como um Programa genérico vira uma Ordem de Manutenção num
equipamento específico. São quatro saltos, e cada um torna a informação mais concreta.

### 01 · Programa de Manutenção — *modelo padrão, genérico*

Um **molde reutilizável**. Não conhece nenhum equipamento — conhece uma *categoria*.
"Todo UPS leva preventiva com parada anual." É a biblioteca técnica da operação, escrita uma vez.

| Tabela | Conteúdo |
|--------|----------|
| `sg_maintenance_programs` | **Escopo** (tipo / fabricante / modelo / criticidade / contrato) + **tipo de manutenção** + **periodicidade** (mensal → bienal · personalizada) |
| `sg_equipment_models` *(ref)* | Alimenta o escopo e traz as *rotinas sugeridas* pelo fabricante |
| `sg_contracts` *(ref)* | Manutenções/ano, SLA corretivo, exigência de relatório e de aprovação — restringe o que o plano pode prometer |

O Programa é **declarativo e inerte**: sozinho, não agenda nada e não gera nada. Só ganha vida ao
ser aplicado a um ativo.

### 02 · Plano do Equipamento — *aplicação, individual*

**O salto mais importante do modelo.** O Programa é **copiado e ajustado** para um equipamento e
vira um plano próprio, dele, que pode divergir do padrão. Um UPS de programa anual instalado em
plataforma offshore passa a ter plano semestral — e isso **não altera o Programa**.

| Tabela | Conteúdo |
|--------|----------|
| `sg_equipment_plans` | Um por equipamento. Guarda `program_id` (a origem, opcional) e os **ajustes**: criticidade, ambiente, regime de operação, contrato, histórico de corretivas |
| `sg_plan_items` | A quebra do plano em linhas executáveis: *que* manutenção, com *que* periodicidade, com *que* próximo vencimento |
| `sg_calendar_entries` | Projeção dos itens no tempo (ano/mês). Revela vencimento, sobreposição de parada e conflito de agenda |

> **Regra dura §28.3** — cada equipamento tem **plano próprio**, mesmo quando derivado de um
> programa. O plano é uma *cópia viva*, não um ponteiro para o padrão.
>
> **§28.9** — o calendário anual é **derivado**, nunca digitado à mão. É uma leitura dos planos,
> não uma entidade que alguém preenche.

### 03 · Ordem de Manutenção (OM) — *execução, o fato acontecido*

A OM é a **unidade de trabalho**. Nasce por **dois caminhos** — e essa dualidade é o coração do
módulo:

| Caminho | Origem | Resultado |
|---------|--------|-----------|
| **Planejado** | `sg_plan_items` vence → calendário aponta | OM `planejada`. Preventiva, previsível, contratada. |
| **Reativo** | `sg_events` (alarme/falha) | OM `emergencial`/corretiva. Não estava no plano; o plano é que vai ter de reagir a ela. |

`sg_maintenance_orders` carrega: tipo, status, datas (prevista / agendada / executada), técnico,
gestor do cliente, escopo e condição final.

> **Regra dura §28.1** — **nenhuma OM existe sem equipamento.** `equipment_id` é NOT NULL.
> É a regra que sustenta o módulo inteiro: sem ela, não há prontuário nem indicador confiável.

### 04 · Histórico do Equipamento — *prontuário, append-only*

Toda OM concluída **volta para o ativo**. O histórico não é um relatório que alguém gera — é um
log que o sistema escreve sozinho a cada evento de domínio, e é ele que fecha o ciclo de volta ao
Plano.

| Tabela | Conteúdo |
|--------|----------|
| `sg_equipment_history` | Linha do tempo consolidada: cadastro, preventivas, corretivas, medições, peças, recomendações, alarmes, mudanças de status |

**Retroalimentação:** corretiva recorrente → o Plano do equipamento é ajustado (mais frequente,
inspeção extra). O ciclo recomeça.

> **Regra dura §28.4 / §28.11** — concluir manutenção **obrigatoriamente** grava histórico.
> Alteração posterior exige justificativa, usuário e data.

---

## Camada 3 — O Equipamento no eixo

O SentinelGrid é **orientado ao equipamento**. De um lado, o que *define* o ativo; do outro, o que
*acontece* com ele ao longo da vida.

```text
        DEFINE (entra)                    EIXO                     ACONTECE (sai)
  ┌──────────────────────┐                                  ┌──────────────────────────┐
  │ Cliente/Site/Área    │──┐                            ┌──│ sg_equipment_plans   1—1 │
  │ sg_equipment_types   │──┤                            ├──│ sg_maintenance_orders 1—N│
  │ sg_manufacturers     │──┼──>  ⚡ sg_equipment  ⚡ ──>─┼──│ sg_events            1—N │
  │ sg_equipment_models  │──┤        (TAG única)         ├──│ sg_recommendations   1—N │
  │ sg_client_managers   │──┤                            ├──│ sg_equipment_history 1—N │
  │ sg_contracts         │──┘                            └──│                          │
  └──────────────────────┘                                  └──────────────────────────┘
```

Specs do ativo: `tag`, `serial_number`, `rated_power`, `input_voltage`, `output_voltage`,
`dc_voltage`, `frequency`, `redundancy_config`, `module_count`, `battery_type`, `install_date`,
`commission_date`.

Dois campos **mudam o comportamento do resto do sistema**:

- **`criticality`** → prioriza alerta, vencimento e planejamento (§28.10).
- **`operational_status`** → atualizado por toda OM concluída (§21).

---

## Camada 4 — A OM por dentro

A OM é um **agregado**: sozinha, é só um cabeçalho. O valor técnico está nos registros que ela
reúne durante a execução em campo.

| Agregado | Tabela | Papel |
|----------|--------|-------|
| Checklist | `sg_order_checklist_results` | Resultado item a item. Template por tipo/modelo/criticidade — checklist de UPS ≠ de banco de baterias. |
| Medições | `sg_measurements` | Tensão, corrente, THD, temperatura, tensão por bloco. Vinculadas a equipamento + OM + técnico + data. |
| Peças substituídas | `sg_replaced_parts` | O que saiu, em que condição, e o que entrou. Alimenta confiabilidade por fabricante/modelo. |
| Detalhe da corretiva | `sg_order_corrective_details` | 1—1, só em corretiva. Sintoma, alarme, impacto, causa provável, causa raiz, ação, classe (§28.8). |
| Aprovação do cliente | `sg_client_approvals` | Janela autorizada, restrições, condição de liberação, aceite final. **Gate de execução** em manutenção com parada. |
| Recomendações | `sg_recommendations` | Nascem na OM, mas **vivem no equipamento** — sobrevivem ao encerramento e viram pendência rastreada. |
| Relatório técnico *(externo)* | `sg_associated_reports` | **Só associado, nunca criado aqui** (§28.5). Código, PDF, link ou ID externo apontando para o Report Service. |
| Anexos | `sg_attachments` | Polimórfico: fotos, logs, curvas de descarga. Penduram em equipamento, OM, recomendação, relatório ou evento. |

---

## Camada 5 — Ciclo de vida e os dois portões

Não é um campo de texto livre: é uma **máquina de estados com guardas**.

### Fluxo planejado (preventiva)

```text
Planejada → Agendada → [⛔ Aguardando aprovação] → Aprovada → Em execução → Concluída
                                                                          ↘ Concluída c/ pendências
                                                                          ↘ Reprogramada
                                                                          ↘ Cancelada
```

### Fluxo reativo (corretiva)

```text
Evento / Alarme → Emergencial → Em execução → Concluída
```

A corretiva **entra pelo lado**: pula o planejamento, mas **não pula o histórico**.

### Os dois portões

> **Portão 1 — Aprovação (§28.7).** Uma OM `preventiva_com_parada` só sai de *Aguardando aprovação*
> para *Aprovada* se existir registro em `sg_client_approvals`. Sem aprovação do cliente, não há
> parada.

> **Portão 2 — Encerramento (§14).** O encerramento pode ser bloqueado pela ausência de relatório
> técnico associado. Isso é **política configurável** por contrato / tipo de manutenção — não um
> `if` espalhado pelo código (ver [ADR-008](05-decisoes-arquiteturais.md)).

---

## Camada 6 — Criticidade: um multiplicador, não um rótulo

É o único atributo que **atravessa todas as camadas**. Muda a periodicidade que o plano herda, a
prioridade do vencimento no calendário, a exigência de aprovação e o peso da recomendação aberta.

| Criticidade | Efeito no sistema |
|-------------|-------------------|
| `baixa` | Baixo impacto operacional. Segue o programa padrão sem ajuste. |
| `media` | Impacto controlado. Vencimento entra na fila normal do calendário. |
| `alta` | Impacto relevante. Escala alerta e antecipa inspeção. |
| `missao_critica` | Falha causa parada crítica. Prioridade máxima em alerta, vencimento, recomendação e planejamento (§28.10). |

---

## Camada 7 — Como vamos trabalhar nessas entidades

Na tela, o usuário nunca "cria uma OM do zero". Ele opera um **ciclo** — e cada passo é uma fatia
de produto entregável por vez.

| # | Passo | O que acontece |
|---|-------|----------------|
| 1 | **Cadastro** | Estruturar o parque: Cliente → Site → Área → Equipamento, com tipo, fabricante, modelo, criticidade e gestor. |
| 2 | **Biblioteca** | Escrever os Programas, uma vez, por tipo/modelo. Trabalho de engenharia, não de rotina diária. |
| 3 | **Aplicação** | Aplicar o Programa ao ativo e **ajustar** ao ambiente real. Gera os itens do plano e o calendário. |
| 4 | **Execução** | Abrir e executar a OM — do calendário (preventiva) ou do evento (corretiva). Checklist, medições, peças, aprovação. |
| 5 | **Fechamento** | Associar relatório do Report Service, registrar recomendações e a condição final. |
| 6 | **Retorno ↺** | Histórico gravado, status operacional atualizado, **Plano recalibrado**. O ciclo recomeça no passo 3. |

---

## Referência rápida — quem é dono de quê

| Entidade | Natureza | Depende de | Papel no fluxo |
|----------|----------|------------|----------------|
| `sg_equipment` | **Eixo** | Cliente + Site + Área | Ponto de ancoragem de plano, ordem, histórico, evento e recomendação. |
| `sg_maintenance_programs` | Modelo (genérico) | Tipo / Fabricante / Modelo | Biblioteca padrão. Não agenda nada sozinho. |
| `sg_equipment_plans` | Aplicação (individual) | Equipamento + Programa *(opcional)* | Cópia ajustada do programa. Um por equipamento, obrigatório. |
| `sg_plan_items` | Detalhe | Plano | Linha executável com periodicidade e próximo vencimento. |
| `sg_calendar_entries` | **Derivado** | Itens do Plano | Projeção no tempo. Revela vencido, conflito e sobreposição de parada. |
| `sg_maintenance_orders` | Transacional | Equipamento *(NOT NULL)* | Unidade de trabalho. Nasce do plano ou de um evento. |
| `sg_equipment_history` | Log (append-only) | Equipamento | Prontuário. Escrito pelo sistema, nunca digitado. |
| `sg_associated_reports` | Referência externa | OM + Report Service | Apenas associação por código/PDF/link/ID. O módulo não gera relatório. |

### Correlação do registry com o Service Report

```text
sg_clients.service_report_id   <----> service_report_customers.sentinelgrid_id
sg_sites.service_report_id     <----> service_report_customer_sites.sentinelgrid_id
sg_equipment.service_report_id <----> service_report_equipments.sentinelgrid_id
```

Esses campos são FKs externas lógicas, sem `REFERENCES` entre bancos. Um vínculo
só é válido quando as duas pontas coincidem e o registro do SentinelGrid não
está em soft delete. Assim, apagar e reimportar um cadastro substitui a referência
órfã pelo novo ID ativo.
