// Auditor de aderência ao plano de manutenção (lógica pura, testável — sem I/O).
//
// Cruza o que o PROGRAMA/PLANO previa (cadência derivada de periodicidade + next_due_date) com o
// que realmente aconteceu (as OMs geradas). Regras de negócio confirmadas com o produto:
//
//   · "Cumprido"  = OM em 'concluida' OU 'concluida_com_pendencias' (as com pendência recebem selo).
//   · Aderência   = |data de execução − data prevista|:  ≤7d "no prazo" · ≤30d "aproximado" · +"fora do prazo".
//   · Data de execução efetiva = COALESCE(executed_date, updated_at) — o mesmo fallback do Mapa
//     Calendário, já que a transição de status não grava executed_date.
//   · Escopo      = compara as OMs existentes E aponta "lacunas": ocorrências que a cadência previa
//     no passado e que nunca viraram OM.

const DONE_STATUSES = new Set(["concluida", "concluida_com_pendencias"]);
const PERIODICITY_MONTHS = { mensal: 1, trimestral: 3, semestral: 6, anual: 12, bienal: 24 };

const ON_TIME_DAYS = 7;   // ≤ 7 dias da data prevista → no prazo
const APPROX_DAYS = 30;   // ≤ 30 dias → aproximado; acima → fora do prazo

function toDate(value) {
  if (!value) return null;
  const s = typeof value === "string" ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

// Soma meses preservando o dia, com clamp para o último dia do mês (31/jan + 1 mês → 28/fev).
function addMonths(date, n) {
  const day = date.getUTCDate();
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, lastDay));
  return base;
}

function periodicityMonths(periodicity) {
  return PERIODICITY_MONTHS[periodicity] || null;
}

// Classifica a execução de uma OM concluída frente à data prevista (planned_date).
function classifyAdherence(plannedDate, execDate) {
  if (!plannedDate || !execDate) return { adherence: "sem_data", deltaDays: null };
  const delta = diffDays(execDate, plannedDate); // + atrasada, − adiantada
  const abs = Math.abs(delta);
  const adherence = abs <= ON_TIME_DAYS ? "no_prazo" : abs <= APPROX_DAYS ? "aproximado" : "fora_prazo";
  return { adherence, deltaDays: delta };
}

// Ocorrências previstas pela cadência do item dentro de [from, to]. Ancorada em next_due_date e
// passeando de `meses` em `meses` (periodicidade). Sem periodicidade/cadência conhecida, considera
// apenas o próprio next_due_date se cair na janela.
function cadenceDates(nextDueDate, periodicity, from, to) {
  const anchor = toDate(nextDueDate);
  if (!anchor) return [];
  const months = periodicityMonths(periodicity);
  if (!months) return anchor >= from && anchor <= to ? [iso(anchor)] : [];

  let cursor = anchor;
  let guard = 0;
  while (diffDays(cursor, from) > 0 && guard++ < 2000) cursor = addMonths(cursor, -months);

  const dates = [];
  guard = 0;
  while (diffDays(cursor, to) <= 0 && guard++ < 2000) {
    if (diffDays(cursor, from) >= 0) dates.push(iso(cursor));
    cursor = addMonths(cursor, months);
  }
  return dates;
}

function execEffectiveOf(order) {
  // O repo já entrega COALESCE(executed_date, updated_at) como exec_effective.
  return order.exec_effective || order.executed_date || order.updated_at || null;
}

function makeOccurrence({ item, expectedDate, order, todayD }) {
  const expected = expectedDate ? String(expectedDate).slice(0, 10) : null;
  const expectedD = expected ? toDate(expected) : null;
  const isPast = expectedD ? diffDays(todayD, expectedD) >= 0 : false;

  let category;
  let adherence = null;
  let deltaDays = null;
  let pendencias = false;
  let execDate = null;

  if (order) {
    pendencias = order.status === "concluida_com_pendencias";
    if (DONE_STATUSES.has(order.status)) {
      const execRaw = execEffectiveOf(order);
      execDate = execRaw ? String(execRaw).slice(0, 10) : null;
      const ref = order.planned_date ? toDate(order.planned_date) : expectedD;
      const classified = classifyAdherence(ref, execDate ? toDate(execDate) : null);
      adherence = classified.adherence;
      deltaDays = classified.deltaDays;
      category = "cumprida";
    } else {
      // OM existe mas não concluída: no passado é atraso em aberto; no futuro, apenas planejada.
      category = isPast ? "em_aberto_atrasada" : "planejada";
    }
  } else {
    category = isPast ? "lacuna" : "futura";
  }

  return {
    planId: item?.plan_id ?? order?.plan_id ?? null,
    planName: item?.plan_name ?? order?.plan_name ?? null,
    programName: item?.program_name ?? null,
    itemId: item?.id ?? null,
    itemTitle: item?.title ?? null,
    maintenanceType: item?.maintenance_type ?? order?.maintenance_type ?? null,
    periodicity: item?.periodicity ?? null,
    expectedDate: expected,
    order: order
      ? {
          id: Number(order.id),
          orderNumber: order.order_number || "",
          status: order.status,
          plannedDate: order.planned_date ? String(order.planned_date).slice(0, 10) : null
        }
      : null,
    execDate,
    category, // cumprida | em_aberto_atrasada | planejada | lacuna | futura
    adherence, // no_prazo | aproximado | fora_prazo | sem_data | null
    deltaDays,
    pendencias
  };
}

function summarize(occurrences, todayD) {
  const isPast = (o) => o.expectedDate && diffDays(todayD, toDate(o.expectedDate)) >= 0;
  const count = (pred) => occurrences.filter(pred).length;

  const esperadasPassado = count(isPast);
  const cumpridas = count((o) => o.category === "cumprida");
  const noPrazo = count((o) => o.adherence === "no_prazo");
  const aproximado = count((o) => o.adherence === "aproximado");
  const foraPrazo = count((o) => o.adherence === "fora_prazo");
  const comPendencias = count((o) => o.pendencias);
  const emAberto = count((o) => o.category === "em_aberto_atrasada");
  const lacunas = count((o) => o.category === "lacuna");
  const planejadas = count((o) => o.category === "planejada");
  const futuras = count((o) => o.category === "futura");

  const aderentes = noPrazo + aproximado; // dentro do previsto (no prazo ou aproximado)
  const adherenceRate = esperadasPassado ? Math.round((aderentes / esperadasPassado) * 100) : null;
  const executionRate = esperadasPassado ? Math.round((cumpridas / esperadasPassado) * 100) : null;

  return {
    total: occurrences.length,
    esperadasPassado,
    cumpridas,
    noPrazo,
    aproximado,
    foraPrazo,
    comPendencias,
    emAberto,
    lacunas,
    planejadas,
    futuras,
    adherenceRate,
    executionRate
  };
}

// Monta a auditoria de um equipamento.
//
// IMPORTANTE — modelo de ocorrência: neste sistema o plano JÁ enumera cada manutenção como um item
// separado (ex.: 25 itens mensais, um por mês), cada um com seu próprio next_due_date e, em geral,
// sua própria OM. Portanto NÃO re-expandimos o item pela periodicidade (isso multiplicaria cada
// item por N meses). A regra, igual à do Mapa Calendário (generateCalendar):
//
//   · cada item de plano ativo = UMA ocorrência esperada, na sua next_due_date;
//   · casada com a(s) OM(s) que apontam para ele via plan_item_id;
//   · item no passado sem OM concluída → lacuna; OMs sem item → ocorrências avulsas (corretivas).
//
// Só entram ocorrências cuja data (planned_date da OM, ou next_due_date do item) cai em [from, to].
function buildEquipmentAudit({ planItems, orders, from, to, today }) {
  const fromD = toDate(from);
  const toD = toDate(to);
  const todayD = toDate(today);

  const inWindow = (value) => {
    const d = value ? toDate(value) : null;
    return d ? diffDays(d, fromD) >= 0 && diffDays(d, toD) <= 0 : false;
  };

  const itemIds = new Set(planItems.map((item) => Number(item.id)));
  const ordersByItem = new Map();
  const looseOrders = [];
  for (const order of orders) {
    const key = order.plan_item_id ? Number(order.plan_item_id) : null;
    if (key && itemIds.has(key)) {
      if (!ordersByItem.has(key)) ordersByItem.set(key, []);
      ordersByItem.get(key).push(order);
    } else {
      // Sem item, ou item inativo/apagado: entra como ocorrência avulsa (não cria lacuna sintética).
      looseOrders.push(order);
    }
  }

  const occurrences = [];

  for (const item of planItems) {
    const itemOrders = (ordersByItem.get(Number(item.id)) || [])
      .slice()
      .sort((a, b) => String(a.planned_date || "").localeCompare(String(b.planned_date || "")));

    if (itemOrders.length) {
      // O item virou OM: cada OM é uma ocorrência (a data prevista é a planned_date da OM).
      for (const order of itemOrders) {
        const expected = order.planned_date || item.next_due_date;
        if (inWindow(expected)) occurrences.push(makeOccurrence({ item, expectedDate: expected, order, todayD }));
      }
    } else if (inWindow(item.next_due_date)) {
      // Item ainda sem OM: a próxima data prevista é uma ocorrência esperada (lacuna se no passado).
      occurrences.push(makeOccurrence({ item, expectedDate: item.next_due_date, order: null, todayD }));
    }
  }

  for (const order of looseOrders) {
    if (inWindow(order.planned_date)) {
      occurrences.push(makeOccurrence({ item: null, expectedDate: order.planned_date, order, todayD }));
    }
  }

  occurrences.sort((a, b) => String(a.expectedDate || "").localeCompare(String(b.expectedDate || "")));
  return { occurrences, summary: summarize(occurrences, todayD) };
}

module.exports = {
  buildEquipmentAudit,
  classifyAdherence,
  cadenceDates,
  summarize,
  ON_TIME_DAYS,
  APPROX_DAYS,
  DONE_STATUSES,
  PERIODICITY_MONTHS
};
