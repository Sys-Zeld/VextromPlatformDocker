# 01 — Modelo de Dados

Mapeamento das **25 entidades de negócio** (Regras de Negócio §3) para o schema
PostgreSQL do banco `sentinelgrid`. Colunas listadas são as **mínimas** —
timestamps (`created_at`, `updated_at`), `deleted_at` (soft delete) e auditoria
(`created_by`, `updated_by`) são padrão em todas as tabelas.

## 1. Hierarquia central (`Cliente → Site → Área → Equipamento`)

| Tabela | Entidade | Colunas-chave | Relacionamentos |
|--------|----------|---------------|-----------------|
| `sg_clients` | Cliente | `name`, `tax_id` (CNPJ), `segment`, `status`, `notes` | 1—N sites, contratos, equipamentos |
| `sg_sites` | Site | `client_id` FK, `name`, `site_type`, `location`, `local_contact` | pertence a cliente; 1—N áreas |
| `sg_areas` | Área | `site_id` FK, `name`, `area_type`, `classification`, `access_restrictions`, `env_conditions` | pertence a site; 1—N equipamentos |
| `sg_equipment` | **Equipamento** (central) | `client_id`, `site_id`, `area_id`, `tag`, `equipment_type_id`, `manufacturer_id`, `model_id`, `serial_number`, specs elétricas*, `criticality`, `operational_status`, `client_manager_id`, `internal_technician_id`, `install_date`, `commission_date` | núcleo de todo o histórico |

\* Specs elétricas do equipamento: `rated_power`, `input_voltage`,
`output_voltage`, `dc_voltage`, `frequency`, `redundancy_config`,
`module_count`, `battery_type`.

## 2. Cadastros de apoio

| Tabela | Entidade | Colunas-chave |
|--------|----------|---------------|
| `sg_client_managers` | Gestor do Cliente | `client_id`, `name`, `role_type` (fiscal/manutenção/operação/facilities/…), `email`, `phone`, escopo opcional (`site_id`, `area_id`, `equipment_id`) |
| `sg_manufacturers` | Fabricante | `name` (Vertiv, Schneider, Eaton, ABB, …) |
| `sg_equipment_types` | Tipo de Equipamento | `name` (UPS, retificador, banco de baterias, BMS, …) |
| `sg_equipment_models` | Modelo | `manufacturer_id`, `equipment_type_id`, `name`, `default_specs` (jsonb), `suggested_routines` (jsonb) |
| `sg_contracts` | Contrato / Escopo | `client_id`, `name`, `valid_from`, `valid_to`, `maint_per_year`, `included_types` (jsonb), `sla_corrective`, `requires_report` (bool), `requires_approval` (bool) |

## 3. Planejamento de manutenção

| Tabela | Entidade | Colunas-chave |
|--------|----------|---------------|
| `sg_maintenance_programs` | Programa de Manutenção (modelo padrão) | `name`, `scope` (por tipo/fabricante/modelo/criticidade/contrato), `maintenance_type`, `periodicity` (mensal…bienal/personalizada) |
| `sg_equipment_plans` | Plano do Equipamento (aplicação do programa) | `equipment_id` FK, `program_id` FK (nullable), `periodicity`, `adjustments` (jsonb: criticidade/ambiente/regime/contrato) |
| `sg_plan_items` | Itens do plano | `plan_id`, `maintenance_type`, `periodicity`, `next_due_date` |

## 4. Execução: Ordem de Manutenção e agregados

| Tabela | Entidade | Colunas-chave |
|--------|----------|---------------|
| `sg_maintenance_orders` | **Ordem de Manutenção** | `order_number`, `equipment_id`, `client_id`, `site_id`, `area_id`, `maintenance_type` (preventiva s/parada, c/parada, corretiva), `status`, `planned_date`, `scheduled_date`, `executed_date`, `technician_id`, `client_manager_id`, `scope`, `final_condition` |
| `sg_order_corrective_details` | Detalhe de corretiva | `order_id`, `symptom`, `alarm`, `operational_impact`, `probable_cause`, `root_cause`, `action_taken`, `urgency`, `corrective_class` (emergencial/urgente/programada/paliativa/definitiva) |
| `sg_checklists` | Checklist (template) | `equipment_type_id`/`model_id`/`maintenance_type`/`criticality`, `name` |
| `sg_checklist_items` | Item de checklist | `checklist_id`, `label`, `input_type`, `order_index` |
| `sg_order_checklist_results` | Resultado de checklist na OM | `order_id`, `checklist_item_id`, `value`, `status`, `notes` |
| `sg_measurements` | Medição Técnica | `order_id`, `equipment_id`, `technician_id`, `measured_at`, `metric` (tensão/corrente/THD/temperatura/tensão por bloco/…), `value`, `unit` |
| `sg_replaced_parts` | Peça/Componente Substituído | `order_id`, `equipment_id`, `part_description`, `part_code`, `manufacturer`, `quantity`, `reason`, `removed_condition`, `new_part_installed`, `evidence` |
| `sg_client_approvals` | Aprovação do Cliente | `order_id`, `approver` (client_manager), `approved_at`, `authorized_window`, `restrictions`, `release_condition`, `final_accept` |

## 5. Rastreabilidade e prontuário

| Tabela | Entidade | Colunas-chave |
|--------|----------|---------------|
| `sg_recommendations` | Recomendação Técnica | `equipment_id`, `origin_order_id`, `associated_report_id` (nullable), `description`, `justification`, `criticality`, `due_date`, `owner`, `status`, `evidence` |
| `sg_associated_reports` | Relatório Técnico **Associado** | `order_id`, `equipment_id`, `report_code`, `title`, `issued_at`, `technician`, `report_type`, `file_ref`, `external_link`, `external_id` |
| `sg_attachments` | Anexo Técnico | polimórfico: `entity_type` + `entity_id` (equipment/order/recommendation/report/event), `file_ref`, `kind` |
| `sg_events` | Evento / Alarme | `equipment_id`, `event_type`, `severity`, `occurred_at`, `description`, `generated_order_id` (nullable) |
| `sg_equipment_history` | Histórico do Equipamento (prontuário) | `equipment_id`, `event_kind` (cadastro/preventiva/corretiva/medição/peça/recomendação/alarme/status/anexo), `ref_table`, `ref_id`, `occurred_at`, `summary`, `actor` |
| `sg_calendar_entries` | Calendário Anual | `equipment_id`, `plan_item_id`, `year`, `month`, `maintenance_type`, `planned_date`, `status` (derivado das OMs) |

> `sg_equipment_history` é preenchida por **triggers de aplicação** (na camada de
> service ao concluir OMs/recomendações/eventos), funcionando como prontuário
> técnico consolidado (Regras §20 / §28.4).

## 6. Enums / domínios (em `constants.js`)

| Domínio | Valores |
|---------|---------|
| `criticality` | `baixa`, `media`, `alta`, `missao_critica` |
| `operational_status` | `operacional_normal`, `operacional_restricao`, `em_observacao`, `em_manutencao`, `indisponivel`, `desativado`, `substituido` |
| `maintenance_type` | `preventiva_sem_parada`, `preventiva_com_parada`, `corretiva` |
| `order_status` | `planejada`, `agendada`, `aguardando_aprovacao`, `aprovada`, `em_execucao`, `concluida`, `concluida_com_pendencias`, `reprogramada`, `cancelada`, `emergencial` |
| `recommendation_status` | `aberta`, `em_analise`, `aprovada`, `rejeitada`, `executada`, `vencida`, `cancelada` |
| `periodicity` | `mensal`, `trimestral`, `semestral`, `anual`, `bienal`, `personalizada` |
| `corrective_class` | `emergencial`, `urgente`, `programada`, `paliativa`, `definitiva` |

## 7. Diagrama de relacionamentos (alto nível)

```text
sg_clients ──< sg_sites ──< sg_areas ──< sg_equipment
   │                                        │
   ├──< sg_contracts                        ├── sg_equipment_type / manufacturer / model (ref)
   └──< sg_client_managers                  ├──< sg_equipment_plans ──< sg_plan_items ──< sg_calendar_entries
                                            ├──< sg_events
                                            ├──< sg_equipment_history  (prontuário)
                                            └──< sg_maintenance_orders
                                                    ├── sg_order_corrective_details (1—1, corretiva)
                                                    ├──< sg_order_checklist_results
                                                    ├──< sg_measurements
                                                    ├──< sg_replaced_parts
                                                    ├──< sg_recommendations
                                                    ├──< sg_associated_reports
                                                    ├──< sg_client_approvals
                                                    └──< sg_attachments (polimórfico)
```

## 8. Regras de integridade a codificar

- FK em cascata controlada: apagar Área exige mover/arquivar equipamentos (bloqueio, não cascade destrutivo).
- `sg_maintenance_orders.equipment_id` **NOT NULL** (Regras §28.1).
- `sg_equipment` exige `client_id`+`site_id`+`area_id` **NOT NULL** (Regras §28.2).
- OM `preventiva_com_parada` só passa de `aguardando_aprovacao`→`aprovada` com registro em `sg_client_approvals` (Regras §28.7).
- Encerramento de OM pode ser bloqueado por ausência de relatório associado — flag configurável por tipo/contrato (Regras §14).
- Conclusão de OM grava linha em `sg_equipment_history` e pode atualizar `operational_status` do equipamento.
