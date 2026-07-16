const pool = require("../db");
const { validateTechnicianSchedule } = require("./technicianScheduleValidator");
const integration = require("./reportServiceIntegration");
const rs = require("../../../report_service/src/services/serviceReportService");

function demandError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function normalizeIds(values) {
  return [...new Set((values || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
}

// Carrega as OMs do grupo com lock, e garante que são MESMO um grupo: um único (cliente, site,
// dia), todas Agendadas. O payload do cliente nunca decide o agrupamento.
async function loadGroupOrders(client, ids, action) {
  const orders = (await client.query(
    `SELECT id, order_number, status, client_id, site_id, rs_service_order_id, execution_days,
            to_char(COALESCE(scheduled_date::date, planned_date), 'YYYY-MM-DD') AS group_date
       FROM sg_maintenance_orders
      WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL
      ORDER BY id
      FOR UPDATE`,
    [ids]
  )).rows;
  if (orders.length !== ids.length) throw demandError("Ordem de manutenção inexistente.", "SG_ORDER_INVALID");

  const keyOf = (om) => `${om.client_id}:${om.site_id}:${om.group_date}`;
  if (orders.some((om) => keyOf(om) !== keyOf(orders[0]))) {
    throw demandError(
      "As OMs selecionadas não pertencem ao mesmo grupo (cliente, site e dia).",
      "SG_DEMAND_GROUP_MISMATCH"
    );
  }
  const notScheduled = orders.find((om) => om.status !== "agendada");
  if (notScheduled) {
    throw demandError(
      `${action} só pode ser alterada em ordens Agendadas (${notScheduled.order_number}).`,
      "SG_ORDER_NOT_SCHEDULED"
    );
  }
  return orders;
}

// Define os técnicos do GRUPO (a futura OS), não de uma OM isolada: o vínculo é aplicado a todas
// as OMs do grupo, porque uma mobilização de campo é uma só. A lista enviada é a lista final —
// quem sai dela é desvinculado de todas as OMs do grupo.
//
// Conflito de agenda continua valendo: o validador só acusa quando o técnico está em OUTRO
// cliente/site no período, então alocá-lo no grupo inteiro nunca conflita consigo mesmo.
async function setGroupTechnicians({ orderIds, technicianIds }, actor = "") {
  const ids = normalizeIds(orderIds);
  if (!ids.length) throw demandError("Selecione o grupo de OMs.", "SG_DEMAND_INVALID");
  const wanted = normalizeIds(technicianIds);

  const client = await pool.connect();
  let orders;
  try {
    await client.query("BEGIN");
    orders = await loadGroupOrders(client, ids, "A equipe");
    if (wanted.length) {
      const known = (await client.query(
        "SELECT id FROM sg_technicians WHERE id = ANY($1::bigint[]) AND active = TRUE AND deleted_at IS NULL",
        [wanted]
      )).rows;
      if (known.length !== wanted.length) throw demandError("Técnico inexistente ou inativo.", "SG_TECHNICIAN_INVALID");
    }

    for (const om of orders) {
      if (wanted.length) await validateTechnicianSchedule(client, om.id, { technicianIds: wanted });
      await client.query(
        "DELETE FROM sg_order_technicians WHERE order_id = $1 AND NOT (technician_id = ANY($2::bigint[]))",
        [om.id, wanted]
      );
      if (wanted.length) {
        await client.query(
          `INSERT INTO sg_order_technicians (order_id, technician_id, created_by)
           SELECT $1, id, $3 FROM sg_technicians WHERE id = ANY($2::bigint[])
           ON CONFLICT DO NOTHING`,
          [om.id, wanted, actor]
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Grupo já gerado: a OS no Report Service precisa refletir a nova equipe. Fora da transação do
  // SG — a exportação do técnico abre transação própria, e um erro aqui não deve desfazer o
  // vínculo já commitado no SentinelGrid.
  const rsOrderIds = [...new Set(orders.map((om) => om.rs_service_order_id).filter(Boolean).map(Number))];
  if (rsOrderIds.length) {
    // A equipe da OS passa a ser exatamente a do grupo: quem entrou é vinculado, quem saiu é
    // desvinculado. Só um "add" deixaria técnico removido preso na OS.
    const rsWanted = new Set();
    for (const technicianId of wanted) {
      const exported = await integration.exportTechnicianToReportService(technicianId);
      rsWanted.add(Number(exported.rsTechnicianId));
    }
    for (const rsOrderId of rsOrderIds) {
      const current = await rs.listOrderTechnicians(rsOrderId);
      for (const rsTechnicianId of rsWanted) await rs.linkTechnicianToOrder(rsOrderId, rsTechnicianId);
      for (const technician of current) {
        if (!rsWanted.has(Number(technician.id))) await rs.unlinkTechnicianFromOrder(rsOrderId, technician.id);
      }
    }
  }
  return { orderIds: ids, technicianIds: wanted, rsOrderIds };
}

// Duração do GRUPO (a OS): a mobilização de campo dura o que dura, então o valor é gravado em
// execution_days de TODAS as OMs do grupo — é execution_days que ocupa a agenda do técnico.
//
// Não é o rescheduleOrder da Agenda técnica: aquele reescreve planned_date junto (efeito colateral
// correto ao *arrastar* a OM no calendário, errado ao mudar só a duração). Aqui a data de início
// não é tocada.
async function setGroupDuration({ orderIds, executionDays }, actor = "") {
  const ids = normalizeIds(orderIds);
  if (!ids.length) throw demandError("Selecione o grupo de OMs.", "SG_DEMAND_INVALID");
  const days = Number(executionDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw demandError("Duração deve ser um número de dias entre 1 e 365.", "SG_DEMAND_INVALID");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orders = await loadGroupOrders(client, ids, "A duração");
    // Esticar a mobilização pode invadir outra frente do mesmo técnico — o validador acusa.
    for (const om of orders) await validateTechnicianSchedule(client, om.id, { executionDays: days });
    await client.query(
      `UPDATE sg_maintenance_orders
          SET execution_days=$2, updated_by=$3, updated_at=NOW()
        WHERE id = ANY($1::bigint[])`,
      [ids, days, actor]
    );
    await client.query("COMMIT");
    return { orderIds: ids, executionDays: days };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { setGroupTechnicians, setGroupDuration };
