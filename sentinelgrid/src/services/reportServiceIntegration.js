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
  await client.query(
    `INSERT INTO sg_rs_links (entity_type, sg_id, rs_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_type, sg_id) DO UPDATE SET rs_id = EXCLUDED.rs_id, updated_at = NOW()`,
    [entityType, sgId, rsId]
  );
}

// Envia uma OM (status 'agendada') para o Service Report: garante cliente/site/equipamento
// por referência externa (sem duplicar), cria a OS (título = nº + escopo da OM) e vincula o
// equipamento. Idempotente: se a OM já foi enviada, reabre a OS existente.
async function sendOrderToReportService(orderId, actor = "") {
  const om = (await pool.query(
    `SELECT o.* FROM sg_maintenance_orders o WHERE o.id = $1 AND o.deleted_at IS NULL`,
    [orderId]
  )).rows[0];
  if (!om) throw integrationError("Ordem de manutenção inexistente.", "SG_ORDER_INVALID");

  // Reenvio → reabre a OS já criada (não duplica).
  if (om.rs_service_order_id) {
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
    name: eq.client_name || `Cliente ${eq.client_id}`
  });
  const { site } = await rs.ensureSiteByRef({
    externalSource: SOURCE,
    externalId: String(eq.site_id),
    customerId: customer.id,
    siteName: eq.site_name || `Site ${eq.site_id}`
  });
  const { equipment } = await rs.ensureEquipmentByRef({
    externalSource: SOURCE,
    externalId: String(eq.id),
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertLink(client, "client", eq.client_id, customer.id);
    await upsertLink(client, "site", eq.site_id, site.id);
    await upsertLink(client, "equipment", eq.id, equipment.id);
    await client.query(
      `UPDATE sg_maintenance_orders
          SET rs_service_order_id = $2, rs_service_order_code = $3, rs_sent_at = NOW(),
              updated_by = $4, updated_at = NOW()
        WHERE id = $1`,
      [om.id, rsOrder.id, rsOrder.service_order_code || "", actor]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { rsOrderId: Number(rsOrder.id), rsOrderCode: rsOrder.service_order_code || "", reused: false };
}

module.exports = { sendOrderToReportService };
