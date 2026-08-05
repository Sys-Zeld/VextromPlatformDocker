const pool = require("../db");
const equipmentRepo = require("../repositories/equipmentRepository");
// Contrato de serviço do Service Report (in-process, remote-ready — ADR-003).
// O SentinelGrid consome só a API de serviço do RS; nunca o banco/repo do RS (ADR-001/005).
const rs = require("../../../report_service/src/services/serviceReportService");

const SOURCE = "sentinelgrid";

function integrationError(message, code = "SG_INTEGRATION_INVALID") {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function upsertLink(client, entityType, sgId, rsId) {
  const registryTables = { client: "sg_clients", site: "sg_sites", equipment: "sg_equipment" };
  const table = registryTables[entityType];
  if (table) {
    await client.query(
      `UPDATE ${table} SET service_report_id=$2, updated_at=NOW()
        WHERE id=$1 AND deleted_at IS NULL`,
      [sgId, rsId]
    );
    await client.query(
      "DELETE FROM sg_rs_links WHERE entity_type=$1 AND (sg_id=$2 OR rs_id=$3)",
      [entityType, sgId, rsId]
    );
  }
  await client.query(
    `INSERT INTO sg_rs_links (entity_type, sg_id, rs_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_type, sg_id) DO UPDATE SET rs_id = EXCLUDED.rs_id, updated_at = NOW()`,
    [entityType, sgId, rsId]
  );
}

async function listReportServiceTechnicians() {
  const technicians = await rs.listGlobalTechnicians();
  const links = (await pool.query("SELECT sg_id, rs_id FROM sg_rs_links WHERE entity_type='technician'")).rows;
  const byRs = new Map(links.map((link) => [Number(link.rs_id), Number(link.sg_id)]));
  return technicians.map((technician) => ({ ...technician, sg_id: byRs.get(Number(technician.id)) || null }));
}

async function importReportServiceTechnician(rsTechnicianId, actor = "") {
  const source = await rs.getGlobalTechnician(rsTechnicianId);
  if (!source) throw integrationError("Tecnico nao encontrado no Service Report.", "SG_TECHNICIAN_INVALID");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(71002, $1)", [rsTechnicianId]);
    const linked = (await client.query("SELECT sg_id FROM sg_rs_links WHERE entity_type='technician' AND rs_id=$1", [rsTechnicianId])).rows[0];
    if (linked) { await client.query("COMMIT"); return { technicianId: Number(linked.sg_id), reused: true }; }
    let local = source.email ? (await client.query(
      "SELECT * FROM sg_technicians WHERE LOWER(email)=LOWER($1) AND deleted_at IS NULL LIMIT 1", [source.email]
    )).rows[0] : null;
    if (!local) local = (await client.query(
      `INSERT INTO sg_technicians (name, role, company, email, phone, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
      [source.name, source.role || "", source.company || "", source.email || "", source.phone || "", actor]
    )).rows[0];
    await upsertLink(client, "technician", local.id, source.id);
    await client.query("COMMIT");
    return { technicianId: Number(local.id), reused: false };
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}

async function exportTechnicianToReportService(technicianId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(71003, $1)", [technicianId]);
    const local = (await client.query("SELECT * FROM sg_technicians WHERE id=$1 AND deleted_at IS NULL", [technicianId])).rows[0];
    if (!local) throw integrationError("Tecnico nao encontrado no SentinelGrid.", "SG_TECHNICIAN_INVALID");
    const linked = (await client.query("SELECT rs_id FROM sg_rs_links WHERE entity_type='technician' AND sg_id=$1", [technicianId])).rows[0];
    if (linked && await rs.getGlobalTechnician(linked.rs_id)) {
      await client.query("COMMIT");
      return { rsTechnicianId: Number(linked.rs_id), reused: true };
    }
    const created = await rs.createGlobalTechnician(local);
    await upsertLink(client, "technician", local.id, created.id);
    await client.query("COMMIT");
    return { rsTechnicianId: Number(created.id), reused: false };
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}

async function listReportServiceReportsForOrder(orderId) {
  const om = (await pool.query(
    "SELECT rs_service_order_id FROM sg_maintenance_orders WHERE id=$1 AND deleted_at IS NULL", [orderId]
  )).rows[0];
  if (!om) throw integrationError("Ordem de manutencao inexistente.", "SG_ORDER_INVALID");
  if (!om.rs_service_order_id) return [];
  const report = await rs.getReportByOrderId(om.rs_service_order_id);
  return report ? [report] : [];
}

async function linkReportServiceReport(orderId, rsReportId, actor = "") {
  const om = (await pool.query(
    "SELECT id, equipment_id, rs_service_order_id FROM sg_maintenance_orders WHERE id=$1 AND deleted_at IS NULL", [orderId]
  )).rows[0];
  if (!om) throw integrationError("Ordem de manutencao inexistente.", "SG_ORDER_INVALID");
  if (!om.rs_service_order_id) throw integrationError("Crie a OS no Service Report antes de vincular o relatorio.", "SG_RS_ORDER_REQUIRED");
  const report = await rs.getReportById(rsReportId);
  if (!report || Number(report.service_order_id) !== Number(om.rs_service_order_id)) {
    throw integrationError("O relatorio selecionado nao pertence a OS vinculada.", "SG_RS_REPORT_INVALID");
  }
  const externalId = `service-report:${report.id}`;
  const existing = (await pool.query(
    "SELECT * FROM sg_associated_reports WHERE external_id=$1 AND deleted_at IS NULL", [externalId]
  )).rows[0];
  if (existing) return { report: existing, reused: true };
  const created = await require("../repositories/operationsRepository").createReport({
    orderId: om.id,
    reportCode: report.report_number || "",
    title: report.title || `Relatorio ${report.report_number || report.id}`,
    issuedAt: report.issue_date ? `${String(report.issue_date).slice(0, 10)}T00:00:00.000Z` : null,
    technician: "",
    reportType: "service_report",
    fileRef: "",
    externalLink: `/app/orders/${report.service_order_id}/report`,
    externalId,
    notes: "Vinculado a partir do Service Report"
  }, actor);
  return { report: created, reused: false };
}

// A exclusão de OS no Service Report é DELETE físico e não há FK entre os bancos: o carimbo
// rs_service_order_id é uma HIPÓTESE, não uma verdade — só vale enquanto as duas pontas
// concordam (mesma filosofia de registrySync.reconcileMutualLink).
//
// Confirma no RS quais OSs ainda existem e desfaz o vínculo das órfãs: a OM volta a ser pendente e
// pode gerar uma OS nova. Ela continua 'agendada' — o trabalho de campo não deixou de existir só
// porque alguém apagou a OS. A desvinculação vai para o histórico do equipamento (§28.4).
async function clearOrphanServiceOrderLinks({ orderIds = null } = {}, actor = "") {
  const ids = orderIds ? [...new Set(orderIds.map(Number).filter(Number.isInteger))] : null;
  if (ids && !ids.length) return { checked: 0, cleared: [] };

  const params = [];
  let where = "rs_service_order_id IS NOT NULL AND deleted_at IS NULL";
  if (ids) {
    params.push(ids);
    where += ` AND id = ANY($${params.length}::bigint[])`;
  }
  const stamped = (await pool.query(
    `SELECT id, equipment_id, order_number, rs_service_order_id, rs_service_order_code
       FROM sg_maintenance_orders WHERE ${where}`,
    params
  )).rows;
  if (!stamped.length) return { checked: 0, cleared: [] };

  const rsIds = [...new Set(stamped.map((om) => Number(om.rs_service_order_id)))];
  const alive = new Set((await rs.listExistingOrderIds(rsIds)).map(Number));
  const orphans = stamped.filter((om) => !alive.has(Number(om.rs_service_order_id)));
  if (!orphans.length) return { checked: stamped.length, cleared: [] };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orphanIds = orphans.map((om) => Number(om.id));
    await client.query(
      `UPDATE sg_maintenance_orders
          SET rs_service_order_id = NULL, rs_service_order_code = '', rs_sent_at = NULL,
              updated_by = $2, updated_at = NOW()
        WHERE id = ANY($1::bigint[])`,
      [orphanIds, actor]
    );
    for (const om of orphans) {
      const label = om.rs_service_order_code || `#${om.rs_service_order_id}`;
      await client.query(
        `INSERT INTO sg_equipment_history (equipment_id, event_kind, ref_table, ref_id, summary, actor)
         VALUES ($1, 'os_desvinculada', 'sg_maintenance_orders', $2, $3, $4)`,
        [om.equipment_id, om.id, `OS ${label} apagada no Service Report — vínculo desfeito, ${om.order_number} voltou a aguardar OS.`, actor]
      );
    }
    await client.query("COMMIT");
    return { checked: stamped.length, cleared: orphanIds };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Título da OS: SEMPRE "Programa + OM(s)" — é assim que a operação identifica o trabalho.
//
//   PROGRAMA MANUT. PREVENTIVA SEM PARADA KN ACU - OM-00767-26, OM-00780-26
//
// O programa vem por OM.plan_id → sg_equipment_plans.program_id → sg_maintenance_programs.name.
// Um grupo pode reunir OMs de programas diferentes (mesmo cliente/site/dia, planos distintos):
// nesse caso os nomes distintos entram juntos, sem repetir.
// Corretiva/avulsa não tem plano — cai no nome do plano e, na falta dele, no tipo de manutenção.
function programLabel(orders) {
  const names = [...new Set(
    orders
      .map((om) => String(om.program_name || om.plan_name || "").trim())
      .filter(Boolean)
  )];
  if (names.length) return names.join(" / ");
  const types = [...new Set(orders.map((om) => String(om.maintenance_type || "").replace(/_/g, " ").trim()).filter(Boolean))];
  return types.join(" / ") || "Manutenção";
}

function buildOrderTitle(orders) {
  const numbers = orders.map((om) => om.order_number).filter(Boolean).join(", ");
  return [programLabel(orders), numbers].filter(Boolean).join(" - ");
}

function buildOrderDescription(orders, equipmentById) {
  if (orders.length === 1) return orders[0].scope || "";
  return orders
    .map((om) => {
      const tag = equipmentById.get(Number(om.equipment_id))?.tag || `#${om.equipment_id}`;
      const type = String(om.maintenance_type || "").replace(/_/g, " ");
      return [om.order_number, tag, type].filter(Boolean).join(" · ") + (om.scope ? ` — ${om.scope}` : "");
    })
    .join("\n");
}

// Envia um grupo de OMs (mesmo cliente + site + dia) ao Service Report como UMA OS com N
// equipamentos. Garante cliente/site/equipamento por referência externa (sem duplicar) e carimba
// todas as OMs do grupo com a OS criada.
//
// Idempotente por natureza:
//   · todas já enviadas          → reabre a OS existente (reused);
//   · nenhuma enviada            → cria a OS;
//   · parte enviada (grupo parcial) → anexa as pendentes à OS que já existe, sem criar uma segunda.
async function sendOrderGroupToReportService(orderIds, actor = "") {
  const ids = [...new Set((orderIds || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  if (!ids.length) throw integrationError("Selecione ao menos uma OM para gerar a OS.", "SG_ORDER_INVALID");

  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    // Lock por OM (mesmo namespace do envio individual) + lock do lote, para que dois usuários
    // gerando o mesmo grupo simultaneamente não criem duas OSs.
    for (const id of ids) await client.query("SELECT pg_advisory_xact_lock(71001, $1)", [id]);
    await client.query("SELECT pg_advisory_xact_lock(71004, $1)", [ids[0]]);

    const orders = (await client.query(
      `SELECT o.*, to_char(COALESCE(o.scheduled_date::date, o.planned_date), 'YYYY-MM-DD') AS group_date,
              pr.name AS program_name, pl.name AS plan_name
         FROM sg_maintenance_orders o
         LEFT JOIN sg_equipment_plans pl ON pl.id = o.plan_id
         LEFT JOIN sg_maintenance_programs pr ON pr.id = pl.program_id
        WHERE o.id = ANY($1::bigint[]) AND o.deleted_at IS NULL
        ORDER BY o.id`,
      [ids]
    )).rows;
    if (orders.length !== ids.length) throw integrationError("Ordem de manutenção inexistente.", "SG_ORDER_INVALID");

    // O grupo é (cliente, site, dia). Revalida no servidor — o payload do cliente não decide isso.
    const groupKeyOf = (om) => `${om.client_id}:${om.site_id}:${om.group_date}`;
    const groupKey = groupKeyOf(orders[0]);
    if (orders.some((om) => groupKeyOf(om) !== groupKey)) {
      throw integrationError(
        "As OMs selecionadas não pertencem ao mesmo grupo (cliente, site e dia).",
        "SG_DEMAND_GROUP_MISMATCH"
      );
    }
    if (!orders[0].group_date) {
      throw integrationError("OM sem data de execução não pode gerar OS.", "SG_DEMAND_DATE_REQUIRED");
    }

    // O carimbo não basta: a OS pode ter sido APAGADA no RS. Sem esta checagem o grupo trava —
    // reusaria eternamente um id morto e nunca criaria OS nova. A órfã é desvinculada aqui mesmo,
    // dentro da transação, e a OM volta a contar como pendente.
    const stampedIds = [...new Set(orders.filter((om) => om.rs_service_order_id).map((om) => Number(om.rs_service_order_id)))];
    const alive = new Set(stampedIds.length ? (await rs.listExistingOrderIds(stampedIds)).map(Number) : []);
    const orphans = orders.filter((om) => om.rs_service_order_id && !alive.has(Number(om.rs_service_order_id)));
    if (orphans.length) {
      await client.query(
        `UPDATE sg_maintenance_orders
            SET rs_service_order_id = NULL, rs_service_order_code = '', rs_sent_at = NULL,
                updated_by = $2, updated_at = NOW()
          WHERE id = ANY($1::bigint[])`,
        [orphans.map((om) => Number(om.id)), actor]
      );
      for (const om of orphans) {
        const label = om.rs_service_order_code || `#${om.rs_service_order_id}`;
        await client.query(
          `INSERT INTO sg_equipment_history (equipment_id, event_kind, ref_table, ref_id, summary, actor)
           VALUES ($1, 'os_desvinculada', 'sg_maintenance_orders', $2, $3, $4)`,
          [om.equipment_id, om.id, `OS ${label} apagada no Service Report — vínculo desfeito, ${om.order_number} voltou a aguardar OS.`, actor]
        );
        om.rs_service_order_id = null;
        om.rs_service_order_code = "";
      }
    }

    // Já enviadas → definem a OS de destino. Duas OSs distintas no mesmo grupo é estado corrompido.
    const sent = orders.filter((om) => om.rs_service_order_id);
    const pending = orders.filter((om) => !om.rs_service_order_id);
    const existingIds = [...new Set(sent.map((om) => Number(om.rs_service_order_id)))];
    if (existingIds.length > 1) {
      throw integrationError(
        "As OMs deste grupo já apontam para OSs diferentes no Service Report.",
        "SG_DEMAND_MULTIPLE_OS"
      );
    }
    if (!pending.length) {
      await client.query("COMMIT");
      return {
        rsOrderId: existingIds[0],
        rsOrderCode: sent[0].rs_service_order_code || "",
        reused: true,
        orderIds: [],
        skipped: sent.map((om) => Number(om.id))
      };
    }
    const notScheduled = pending.find((om) => om.status !== "agendada");
    if (notScheduled) {
      throw integrationError(
        `Só é possível enviar OM com status 'agendada' (${notScheduled.order_number}).`,
        "SG_ORDER_NOT_SCHEDULED"
      );
    }

    // União dos técnicos das OMs pendentes — o mesmo técnico em duas OMs entra uma vez só na OS.
    // Coletada ANTES de qualquer mutação no RS: sem técnico não há OS, e como o RS roda fora desta
    // transação (bancos separados), criar a OS para só então falhar deixaria uma OS órfã no RS.
    const techniciansRepo = require("../repositories/techniciansRepository");
    const technicianIds = new Set();
    for (const om of pending) {
      for (const technician of await techniciansRepo.listOrderTechnicians(om.id)) {
        technicianIds.add(Number(technician.id));
      }
    }
    if (!technicianIds.size) {
      throw integrationError(
        "Defina ao menos um técnico para a equipe antes de gerar a OS.",
        "SG_DEMAND_NO_TECHNICIAN"
      );
    }

    // Equipamentos das OMs pendentes — o cliente/site da OS vem daqui, não da OM.
    const equipmentById = new Map();
    for (const om of pending) {
      const eq = await equipmentRepo.getEquipment(om.equipment_id);
      if (!eq) throw integrationError("Equipamento da OM inexistente.", "SG_ORDER_INVALID");
      equipmentById.set(Number(om.equipment_id), eq);
    }
    const head = equipmentById.get(Number(pending[0].equipment_id));

    // ensure-or-create no RS por referência externa (idempotente — 1:1 por módulo). Uma vez por grupo.
    const { customer } = await rs.ensureCustomerByRef({
      externalSource: SOURCE,
      externalId: String(head.client_id),
      sentinelgridId: head.client_id,
      name: head.client_name || `Cliente ${head.client_id}`
    });
    const { site } = await rs.ensureSiteByRef({
      externalSource: SOURCE,
      externalId: String(head.site_id),
      sentinelgridId: head.site_id,
      customerId: customer.id,
      siteName: head.site_name || `Site ${head.site_id}`
    });
    await upsertLink(client, "client", head.client_id, customer.id);
    await upsertLink(client, "site", head.site_id, site.id);

    // Grupo parcial reusa a OS existente; senão cria uma nova para o grupo inteiro.
    const reused = existingIds.length === 1;
    const rsOrder = reused
      ? { id: existingIds[0], service_order_code: sent[0].rs_service_order_code || "" }
      : await rs.createOrder({
          customerId: customer.id,
          siteId: site.id,
          title: buildOrderTitle(pending),
          description: buildOrderDescription(pending, equipmentById),
          createdBy: actor
        });

    // Um equipamento por OM pendente, todos na mesma OS.
    for (const om of pending) {
      const eq = equipmentById.get(Number(om.equipment_id));
      const { equipment } = await rs.ensureEquipmentByRef({
        externalSource: SOURCE,
        externalId: String(eq.id),
        sentinelgridId: eq.id,
        customerId: customer.id,
        siteId: site.id,
        type: eq.equipment_type_name || "Equipamento",
        serialNumber: eq.serial_number || "",
        tagNumber: eq.tag || "",
        manufacturer: eq.manufacturer_name || "",
        modelFamily: eq.model_name || "",
        area: eq.area_name || ""
      });
      await rs.linkOrderEquipment(rsOrder.id, equipment.id);
      await upsertLink(client, "equipment", eq.id, equipment.id);
    }

    // Técnicos do grupo (união já validada acima como não-vazia) → vinculados à OS.
    for (const technicianId of technicianIds) {
      const exported = await exportTechnicianToReportService(technicianId);
      await rs.linkTechnicianToOrder(rsOrder.id, exported.rsTechnicianId);
    }

    const pendingIds = pending.map((om) => Number(om.id));
    await client.query(
      `UPDATE sg_maintenance_orders
          SET rs_service_order_id = $2, rs_service_order_code = $3, rs_sent_at = NOW(),
              updated_by = $4, updated_at = NOW()
        WHERE id = ANY($1::bigint[])`,
      [pendingIds, rsOrder.id, rsOrder.service_order_code || "", actor]
    );
    await client.query("COMMIT");
    return {
      rsOrderId: Number(rsOrder.id),
      rsOrderCode: rsOrder.service_order_code || "",
      reused,
      orderIds: pendingIds,
      skipped: sent.map((om) => Number(om.id))
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Envio individual: um grupo de uma OM só. Mantido pelo botão "Enviar para OS" da tela de Ordens.
async function sendOrderToReportService(orderId, actor = "") {
  const { rsOrderId, rsOrderCode, reused } = await sendOrderGroupToReportService([orderId], actor);
  return { rsOrderId, rsOrderCode, reused };
}

module.exports = {
  sendOrderToReportService,
  sendOrderGroupToReportService,
  clearOrphanServiceOrderLinks,
  buildOrderTitle,
  listReportServiceTechnicians,
  importReportServiceTechnician,
  exportTechnicianToReportService
  ,listReportServiceReportsForOrder
  ,linkReportServiceReport
};
