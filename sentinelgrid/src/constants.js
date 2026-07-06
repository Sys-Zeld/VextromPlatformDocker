// Enums/domínios do SentinelGrid.
// Fonte: SentinelGrid/planner/01-modelo-de-dados.md (§6) e as Regras de Negócio.
// Mantido como fonte única para validação (façade) e migrations.

const CLIENT_STATUS = ["ativo", "inativo", "prospect"];

const CRITICALITY = ["baixa", "media", "alta", "missao_critica"];

const OPERATIONAL_STATUS = [
  "operacional_normal",
  "operacional_restricao",
  "em_observacao",
  "em_manutencao",
  "indisponivel",
  "desativado",
  "substituido"
];

const MAINTENANCE_TYPE = [
  "preventiva_sem_parada",
  "preventiva_com_parada",
  "corretiva",
  "comissionamento",
  "teste_bateria",
  "retrofit"
];

const ORDER_STATUS = [
  "planejada",
  "agendada",
  "aguardando_aprovacao",
  "aprovada",
  "em_execucao",
  "concluida",
  "concluida_com_pendencias",
  "reprogramada",
  "cancelada",
  "emergencial"
];

const RECOMMENDATION_STATUS = [
  "aberta",
  "em_analise",
  "aprovada",
  "rejeitada",
  "executada",
  "vencida",
  "cancelada"
];

const PERIODICITY = ["mensal", "trimestral", "semestral", "anual", "bienal", "personalizada"];

const CORRECTIVE_CLASS = ["emergencial", "urgente", "programada", "paliativa", "definitiva"];

// Fase 10 — Mapa Calendário.
// Prioridade do alerta (§7/A.8), do menor para o maior peso.
const ALERT_PRIORITY = ["informativo", "atencao", "importante", "critico", "emergencial"];

// Status geral visual (§11/A.10), do melhor para o pior.
const GENERAL_STATUS = ["normal", "atencao", "critico", "emergencial"];

// Cores do calendário (§6/A.7).
const CALENDAR_COLOR = ["verde", "azul", "amarelo", "laranja", "vermelho", "roxo", "cinza"];

module.exports = {
  CLIENT_STATUS,
  CRITICALITY,
  OPERATIONAL_STATUS,
  MAINTENANCE_TYPE,
  ORDER_STATUS,
  RECOMMENDATION_STATUS,
  PERIODICITY,
  CORRECTIVE_CLASS,
  ALERT_PRIORITY,
  GENERAL_STATUS,
  CALENDAR_COLOR
};
