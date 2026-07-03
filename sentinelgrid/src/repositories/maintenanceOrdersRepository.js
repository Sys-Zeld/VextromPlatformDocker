const pool = require("../db");

const BASE_FROM = `FROM sg_maintenance_orders o
  JOIN sg_equipment e ON e.id = o.equipment_id
  JOIN sg_clients c ON c.id = o.client_id
  JOIN sg_sites s ON s.id = o.site_id
  JOIN sg_areas a ON a.id = o.area_id
  LEFT JOIN sg_equipment_plans p ON p.id = o.plan_id
  LEFT JOIN sg_plan_items pi ON pi.id = o.plan_item_id
  LEFT JOIN sg_checklists cl ON cl.id = o.checklist_id
  LEFT JOIN sg_client_managers cm ON cm.id = o.client_manager_id`;

const SELECT_COLS = `o.*, e.tag AS equipment_tag, e.serial_number AS equipment_serial_number,
  c.name AS client_name, s.name AS site_name, a.name AS area_name,
  p.name AS plan_name, pi.title AS plan_item_title, cl.name AS checklist_name, cm.name AS client_manager_name`;

function equipmentInvalidError() {
  const err = new Error("Equipamento invalido ou inexistente");
  err.code = "SG_EQUIPMENT_INVALID";
  return err;
}

function orderInvalidError() {
  const err = new Error("Ordem invalida ou inexistente");
  err.code = "SG_ORDER_INVALID";
  return err;
}

function planInvalidError() {
  const err = new Error("Plano invalido ou inexistente");
  err.code = "SG_PLAN_INVALID";
  return err;
}

function transitionInvalidError(message) {
  const err = new Error(message || "Transicao de status invalida");
  err.code = "SG_ORDER_TRANSITION_INVALID";
  return err;
}

function approvalNotRequiredError() {
  const err = new Error("Aprovacao nao exigida para esta ordem");
  err.code = "SG_ORDER_APPROVAL_NOT_REQUIRED";
  return err;
}

function completionInvalidError(message) {
  const err = new Error(message || "Conclusao invalida");
  err.code = "SG_ORDER_COMPLETION_INVALID";
  return err;
}

async function resolveEquipmentScope(client, equipmentId) {
  const res = await client.query(
    `SELECT id, client_id, site_id, area_id
       FROM sg_equipment
      WHERE id = $1 AND deleted_at IS NULL`,
    [equipmentId]
  );
  if (!res.rows[0]) throw equipmentInvalidError();
  return res.rows[0];
}

function defaultStatus(input) {
  if (input.status) return input.status;
  if (input.maintenanceType === "preventiva_com_parada") return "aguardando_aprovacao";
  if (input.maintenanceType === "corretiva") return "emergencial";
  return "planejada";
}

async function nextOrderNumber(client) {
  const seq = (await client.query("SELECT nextval('sg_maintenance_order_number_seq') AS n")).rows[0].n;
  return `SG-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
}

async function listOrders({
  equipmentId = null,
  clientId = null,
  status = "",
  maintenanceType = "",
  search = "",
  limit = 100,
  offset = 0
} = {}) {
  const params = [];
  let where = "o.deleted_at IS NULL";
  const add = (cond, val) => {
    params.push(val);
    where += ` AND ${cond.replace("$?", `$${params.length}`)}`;
  };
  if (equipmentId) add("o.equipment_id = $?", equipmentId);
  if (clientId) add("o.client_id = $?", clientId);
  if (status) add("o.status = $?", status);
  if (maintenanceType) add("o.maintenance_type = $?", maintenanceType);
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(o.order_number) LIKE $${params.length} OR LOWER(e.tag) LIKE $${params.length} OR LOWER(o.scope) LIKE $${params.length})`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const orders = (
    await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM}
        WHERE ${where}
        ORDER BY COALESCE(o.planned_date, o.created_at::date) DESC, o.id DESC
        LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;
  return { orders, total };
}

async function getOrder(id) {
  const order = (await pool.query(`SELECT ${SELECT_COLS} ${BASE_FROM} WHERE o.id = $1 AND o.deleted_at IS NULL`, [id])).rows[0] || null;
  if (!order) return null;
  const correctiveDetails = (await pool.query("SELECT * FROM sg_order_corrective_details WHERE order_id = $1", [id])).rows[0] || null;
  const approvals = (await pool.query(
    `SELECT ap.*, cm.name AS client_manager_name
       FROM sg_client_approvals ap
       LEFT JOIN sg_client_managers cm ON cm.id = ap.client_manager_id
      WHERE ap.order_id = $1 AND ap.deleted_at IS NULL
      ORDER BY ap.created_at DESC, ap.id DESC`,
    [id]
  )).rows;
  return { ...order, corrective_details: correctiveDetails, approvals };
}

function orderValues(input, scope, status) {
  return [
    input.equipmentId,
    scope.client_id,
    scope.site_id,
    scope.area_id,
    input.planId,
    input.planItemId,
    input.checklistId,
    input.maintenanceType,
    status,
    input.priority,
    input.plannedDate,
    input.scheduledDate,
    input.executedDate,
    input.technicianId,
    input.clientManagerId,
    input.scope,
    input.finalCondition,
    input.notes
  ];
}

function correctiveValues(input) {
  const d = input.correctiveDetails || {};
  return [
    d.symptom || "",
    d.alarm || "",
    d.operationalImpact || "",
    d.probableCause || "",
    d.rootCause || "",
    d.actionTaken || "",
    d.urgency || "",
    d.correctiveClass || "programada"
  ];
}

async function upsertCorrectiveDetails(client, orderId, input, actor) {
  if (input.maintenanceType !== "corretiva") {
    await client.query("DELETE FROM sg_order_corrective_details WHERE order_id = $1", [orderId]);
    return;
  }
  await client.query(
    `INSERT INTO sg_order_corrective_details
      (order_id, symptom, alarm, operational_impact, probable_cause, root_cause,
       action_taken, urgency, corrective_class, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     ON CONFLICT (order_id) DO UPDATE SET
       symptom = EXCLUDED.symptom,
       alarm = EXCLUDED.alarm,
       operational_impact = EXCLUDED.operational_impact,
       probable_cause = EXCLUDED.probable_cause,
       root_cause = EXCLUDED.root_cause,
       action_taken = EXCLUDED.action_taken,
       urgency = EXCLUDED.urgency,
       corrective_class = EXCLUDED.corrective_class,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [orderId, ...correctiveValues(input), actor]
  );
}

async function createOrder(input, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const scope = await resolveEquipmentScope(client, input.equipmentId);
    const orderNumber = await nextOrderNumber(client);
    const status = defaultStatus(input);
    const res = await client.query(
      `INSERT INTO sg_maintenance_orders
        (order_number, equipment_id, client_id, site_id, area_id, plan_id, plan_item_id, checklist_id,
         maintenance_type, status, priority, planned_date, scheduled_date, executed_date,
         technician_id, client_manager_id, scope, final_condition, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20)
       RETURNING id`,
      [orderNumber, ...orderValues(input, scope, status), actor]
    );
    await upsertCorrectiveDetails(client, res.rows[0].id, input, actor);
    await client.query("COMMIT");
    return getOrder(res.rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateOrder(id, input, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const scope = await resolveEquipmentScope(client, input.equipmentId);
    const status = defaultStatus(input);
    const res = await client.query(
      `UPDATE sg_maintenance_orders
          SET equipment_id = $2, client_id = $3, site_id = $4, area_id = $5,
              plan_id = $6, plan_item_id = $7, checklist_id = $8, maintenance_type = $9, status = $10,
              priority = $11, planned_date = $12, scheduled_date = $13, executed_date = $14,
              technician_id = $15, client_manager_id = $16, scope = $17,
              final_condition = $18, notes = $19, updated_by = $20, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id`,
      [id, ...orderValues(input, scope, status), actor]
    );
    if (!res.rows[0]) {
      await client.query("COMMIT");
      return null;
    }
    await upsertCorrectiveDetails(client, id, input, actor);
    await client.query("COMMIT");
    return getOrder(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteOrder(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_maintenance_orders SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

async function resolvePlanForOrder(client, input) {
  const plan = (await client.query(
    `SELECT p.*, e.client_id, e.site_id, e.area_id
       FROM sg_equipment_plans p
       JOIN sg_equipment e ON e.id = p.equipment_id
      WHERE p.id = $1 AND p.deleted_at IS NULL AND p.active = TRUE AND e.deleted_at IS NULL`,
    [input.planId]
  )).rows[0] || null;
  if (!plan) throw planInvalidError();

  const item = input.planItemId
    ? (await client.query(
        `SELECT *
           FROM sg_plan_items
          WHERE id = $1 AND plan_id = $2 AND deleted_at IS NULL`,
        [input.planItemId, input.planId]
      )).rows[0] || null
    : (await client.query(
        `SELECT *
           FROM sg_plan_items
          WHERE plan_id = $1 AND deleted_at IS NULL
          ORDER BY order_index ASC, id ASC
          LIMIT 1`,
        [input.planId]
      )).rows[0] || null;

  if (!item) throw planInvalidError();
  return { plan, item };
}

async function createOrderFromPlan(input, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { plan, item } = await resolvePlanForOrder(client, input);
    const maintenanceType = item.maintenance_type || plan.maintenance_type;
    const orderInput = {
      equipmentId: plan.equipment_id,
      planId: plan.id,
      planItemId: item.id,
      checklistId: input.checklistId,
      maintenanceType,
      priority: input.priority,
      plannedDate: input.plannedDate || item.next_due_date,
      scheduledDate: input.scheduledDate,
      executedDate: null,
      technicianId: input.technicianId,
      clientManagerId: input.clientManagerId,
      scope: input.scope || `${plan.name} - ${item.title}`,
      finalCondition: "",
      notes: input.notes,
      correctiveDetails: null
    };
    const scope = { client_id: plan.client_id, site_id: plan.site_id, area_id: plan.area_id };
    const status = defaultStatus(orderInput);
    const orderNumber = await nextOrderNumber(client);
    const res = await client.query(
      `INSERT INTO sg_maintenance_orders
        (order_number, equipment_id, client_id, site_id, area_id, plan_id, plan_item_id, checklist_id,
         maintenance_type, status, priority, planned_date, scheduled_date, executed_date,
         technician_id, client_manager_id, scope, final_condition, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20)
       RETURNING id`,
      [orderNumber, ...orderValues(orderInput, scope, status), actor]
    );
    await client.query("COMMIT");
    return getOrder(res.rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function approvedCount(client, orderId) {
  const res = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM sg_client_approvals
      WHERE order_id = $1 AND deleted_at IS NULL AND approved_at IS NOT NULL`,
    [orderId]
  );
  return res.rows[0].c;
}

const COMPLETION_STATUSES = ["concluida", "concluida_com_pendencias"];

async function transitionOrderStatus(id, input, actor = "") {
  const nextStatus = typeof input === "string" ? input : input.status;
  const finalCondition = typeof input === "string" ? "" : input.finalCondition;
  const notes = typeof input === "string" ? "" : input.notes;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = (await client.query(
      "SELECT id, maintenance_type, status, final_condition, notes FROM sg_maintenance_orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id]
    )).rows[0];
    if (!order) {
      await client.query("COMMIT");
      return null;
    }

    if (
      order.maintenance_type === "preventiva_com_parada" &&
      ["aprovada", "em_execucao", "concluida", "concluida_com_pendencias"].includes(nextStatus) &&
      (await approvedCount(client, id)) === 0
    ) {
      throw transitionInvalidError("Preventiva com parada exige aprovacao do cliente");
    }

    if (COMPLETION_STATUSES.includes(nextStatus)) {
      if (!(finalCondition || order.final_condition || "").trim()) {
        throw completionInvalidError("Conclusao exige condicao final");
      }
      if (order.maintenance_type === "corretiva") {
        const details = (await client.query(
          `SELECT symptom, alarm, operational_impact, probable_cause, root_cause, action_taken
             FROM sg_order_corrective_details
            WHERE order_id = $1`,
          [id]
        )).rows[0] || {};
        const hasCause = Boolean((details.probable_cause || "").trim() || (details.root_cause || "").trim());
        if (
          !(details.symptom || "").trim() ||
          !(details.alarm || "").trim() ||
          !(details.operational_impact || "").trim() ||
          !hasCause ||
          !(details.action_taken || "").trim()
        ) {
          throw completionInvalidError("Corretiva exige sintoma, alarme, impacto, causa e acao tomada para conclusao");
        }
      }
    }

    await client.query(
      `UPDATE sg_maintenance_orders
          SET status = $2,
              final_condition = CASE WHEN $3::text <> '' THEN $3 ELSE final_condition END,
              notes = CASE WHEN $4::text <> '' THEN $4 ELSE notes END,
              updated_by = $5,
              updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, nextStatus, finalCondition, notes, actor]
    );
    await client.query("COMMIT");
    return getOrder(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function createApproval(orderId, input, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = (await client.query(
      "SELECT id, maintenance_type, status FROM sg_maintenance_orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [orderId]
    )).rows[0];
    if (!order) throw orderInvalidError();
    if (order.maintenance_type !== "preventiva_com_parada") throw approvalNotRequiredError();

    const approvedAt = input.approvedAt || new Date().toISOString();
    const approval = (await client.query(
      `INSERT INTO sg_client_approvals
        (order_id, client_manager_id, approver_name, approved_at, authorized_window,
         restrictions, release_condition, final_accept, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING *`,
      [
        orderId,
        input.clientManagerId,
        input.approverName,
        approvedAt,
        input.authorizedWindow,
        input.restrictions,
        input.releaseCondition,
        input.finalAccept,
        input.notes,
        actor
      ]
    )).rows[0];

    if (order.status === "aguardando_aprovacao") {
      await client.query(
        `UPDATE sg_maintenance_orders
            SET status = 'aprovada', updated_by = $2, updated_at = NOW()
          WHERE id = $1`,
        [orderId, actor]
      );
    }

    await client.query("COMMIT");
    return { approval, order: await getOrder(orderId) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  createOrderFromPlan,
  softDeleteOrder,
  transitionOrderStatus,
  createApproval
};
