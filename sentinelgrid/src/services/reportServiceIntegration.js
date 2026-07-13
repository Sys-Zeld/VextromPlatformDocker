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

// Envia uma OM (status 'agendada') para o Service Report: garante cliente/site/equipamento
// por referência externa (sem duplicar), cria a OS (título = nº + escopo da OM) e vincula o
// equipamento. Idempotente: se a OM já foi enviada, reabre a OS existente.
async function sendOrderToReportService(orderId, actor = "") {
  const client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(71001, $1)", [orderId]);
  try {
  const om = (await client.query(
    `SELECT o.* FROM sg_maintenance_orders o WHERE o.id = $1 AND o.deleted_at IS NULL`,
    [orderId]
  )).rows[0];
  if (!om) throw integrationError("Ordem de manutenção inexistente.", "SG_ORDER_INVALID");

  // Reenvio → reabre a OS já criada (não duplica).
  if (om.rs_service_order_id) {
    await client.query("COMMIT");
    return { rsOrderId: Number(om.rs_service_order_id), rsOrderCode: om.rs_service_order_code || "", reused: true };
  }
  if (om.status !== "agendada") {
    throw integrationError("Só é possível enviar OM com status 'agendada'.", "SG_ORDER_NOT_SCHEDULED");
  }

  const eq = await equipmentRepo.getEquipment(om.equipment_id);
  if (!eq) throw integrationError("Equipamento da OM inexistente.", "SG_ORDER_INVALID");

  // ensure-or-create no RS por referência externa (idempotente — 1:1 por módulo).
  const { customer } = await rs.ensureCustomerByRef({
    externalSource: SOURCE,
    externalId: String(eq.client_id),
    sentinelgridId: eq.client_id,
    name: eq.client_name || `Cliente ${eq.client_id}`
  });
  const { site } = await rs.ensureSiteByRef({
    externalSource: SOURCE,
    externalId: String(eq.site_id),
    sentinelgridId: eq.site_id,
    customerId: customer.id,
    siteName: eq.site_name || `Site ${eq.site_id}`
  });
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
    modelFamily: eq.model_name || ""
  });

  // Cria a OS e vincula o equipamento.
  const title = [om.order_number, om.scope].map((v) => String(v || "").trim()).filter(Boolean).join(" - ");
  const rsOrder = await rs.createOrder({
    customerId: customer.id,
    siteId: site.id,
    title,
    description: om.scope || "",
    createdBy: actor
  });
  await rs.linkOrderEquipment(rsOrder.id, equipment.id);

  // Grava mapeamentos e carimba a OM (transação no lado SG).
    await upsertLink(client, "client", eq.client_id, customer.id);
    await upsertLink(client, "site", eq.site_id, site.id);
    await upsertLink(client, "equipment", eq.id, equipment.id);
    const technicians = await require("../repositories/techniciansRepository").listOrderTechnicians(om.id);
    for (const technician of technicians) {
      const exported = await exportTechnicianToReportService(technician.id);
      await rs.linkTechnicianToOrder(rsOrder.id, exported.rsTechnicianId);
    }
    await client.query(
      `UPDATE sg_maintenance_orders
          SET rs_service_order_id = $2, rs_service_order_code = $3, rs_sent_at = NOW(),
              updated_by = $4, updated_at = NOW()
        WHERE id = $1`,
      [om.id, rsOrder.id, rsOrder.service_order_code || "", actor]
    );
    await client.query("COMMIT");
    return { rsOrderId: Number(rsOrder.id), rsOrderCode: rsOrder.service_order_code || "", reused: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

}

module.exports = {
  sendOrderToReportService,
  listReportServiceTechnicians,
  importReportServiceTechnician,
  exportTechnicianToReportService
  ,listReportServiceReportsForOrder
  ,linkReportServiceReport
};
