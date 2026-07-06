// Fase 10 · Fatia 10.3 — Classificador puro do Mapa Calendário.
// Funções sem I/O: recebem um evento já normalizado pelo motor (10.1/10.2) e
// derivam cor (§6/A.7), prioridade (§7/A.8) e status geral (§11/A.10).

const { ALERT_PRIORITY, GENERAL_STATUS } = require("../constants");

const HIGH_CRIT = new Set(["alta", "missao_critica"]);
// Status que zeram o evento visualmente (cinza).
const DEAD_STATUS = new Set(["cancelada", "desativado", "substituido"]);
// Status de conclusão (verde) — hoje só relevante ao relatório pendente, mas
// deixamos explícito para eventos concluídos que venham a entrar no mapa.
const DONE_STATUS = new Set(["concluida", "concluida_com_pendencias"]);

function maxBy(order, a, b) {
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

// Cor do evento (A.7).
function deriveColor(ev) {
  if (DEAD_STATUS.has(ev.status)) return "cinza";
  switch (ev.event_kind) {
    case "corretiva_aberta":
      return "vermelho";
    case "evento_critico":
      return "vermelho";
    case "recomendacao_critica":
    case "recomendacao_prazo":
      return "roxo";
    case "aprovacao_pendente":
    case "relatorio_pendente":
      return "laranja";
    case "equip_restrito":
      return ev.status === "indisponivel" ? "vermelho" : "laranja";
    default: {
      // Manutenções (planejada_*/om_manutencao) seguem o alert_level (A.9).
      if (DONE_STATUS.has(ev.status)) return "verde";
      switch (ev.alert_level) {
        case "vencida":
        case "critica":
          return "vermelho";
        case "proxima":
          return "amarelo";
        default:
          return "azul";
      }
    }
  }
}

// Prioridade do alerta (A.8) — retorna o maior nível aplicável.
function derivePriority(ev) {
  const isHigh = HIGH_CRIT.has(ev.criticality);

  // Emergencial.
  if (ev.status === "emergencial") return "emergencial";
  if (ev.event_kind === "equip_restrito" && ev.status === "indisponivel") return "emergencial";
  if (ev.event_kind === "corretiva_aberta" && (isHigh || ev.is_overdue)) return "emergencial";

  // Crítico.
  if (ev.event_kind === "recomendacao_critica") return "critico";
  if (ev.event_kind === "corretiva_aberta") return "critico";
  if (ev.event_kind === "equip_restrito") return "critico";
  if (ev.alert_level === "vencida" && isHigh) return "critico";

  // Importante.
  if (ev.alert_level === "vencida") return "importante";
  if (ev.alert_level === "critica") return "importante";
  if (ev.event_kind === "aprovacao_pendente" && ev.is_overdue) return "importante";

  // Atenção.
  if (ev.alert_level === "proxima") return "atencao";
  if (ev.event_kind === "aprovacao_pendente") return "atencao";
  if (ev.event_kind === "relatorio_pendente") return "atencao";
  if (ev.event_kind === "recomendacao_prazo") return "atencao";

  // Informativo (planejado no futuro, sem risco).
  return "informativo";
}

// Contribuição do evento para o status geral (A.10).
function eventGeneralStatus(ev) {
  if (ev.status === "emergencial") return "emergencial";
  if (ev.event_kind === "equip_restrito" && ev.status === "indisponivel") return "emergencial";
  if (ev.event_kind === "corretiva_aberta" && ev.status === "emergencial") return "emergencial";

  if (ev.alert_level === "vencida") return "critico";
  if (ev.event_kind === "recomendacao_critica") return "critico";
  if (ev.event_kind === "equip_restrito") return "critico";
  if (ev.event_kind === "corretiva_aberta") return "critico";

  if (ev.alert_level === "proxima" || ev.alert_level === "critica") return "atencao";
  if (ev.event_kind === "aprovacao_pendente") return "atencao";
  if (ev.event_kind === "recomendacao_prazo") return "atencao";
  if (ev.event_kind === "relatorio_pendente") return "atencao";

  return "normal";
}

// Pior status geral de uma lista de eventos (A.10 — "pior condição no período").
function worstStatus(events) {
  let worst = "normal";
  for (const ev of events) worst = maxBy(GENERAL_STATUS, worst, eventGeneralStatus(ev));
  return worst;
}

// Anexa cor + prioridade ao evento (usado pelo motor ao devolver a lista).
function classifyEvent(ev) {
  return { ...ev, color: deriveColor(ev), priority: derivePriority(ev) };
}

// Utilitário para escolher a maior prioridade de uma lista (ex.: por dia/mês).
function highestPriority(events) {
  let top = "informativo";
  for (const ev of events) top = maxBy(ALERT_PRIORITY, top, derivePriority(ev));
  return top;
}

module.exports = { deriveColor, derivePriority, eventGeneralStatus, worstStatus, classifyEvent, highestPriority };
