const pool = require("../db");

function orderInvalidError() {
  const err = new Error("Ordem invalida ou inexistente");
  err.code = "SG_ORDER_INVALID";
  return err;
}

function checklistInvalidError() {
  const err = new Error("Ordem sem checklist vinculado ou item invalido");
  err.code = "SG_ORDER_CHECKLIST_INVALID";
  return err;
}

async function getOrderChecklistExecution(orderId) {
  const order = (await pool.query(
    `SELECT o.id, o.order_number, o.checklist_id, cl.name AS checklist_name
       FROM sg_maintenance_orders o
       LEFT JOIN sg_checklists cl ON cl.id = o.checklist_id
      WHERE o.id = $1 AND o.deleted_at IS NULL`,
    [orderId]
  )).rows[0] || null;
  if (!order) throw orderInvalidError();
  if (!order.checklist_id) throw checklistInvalidError();

  const items = (await pool.query(
    `SELECT ci.id AS checklist_item_id, ci.title, ci.item_type, ci.required, ci.expected_value,
            ci.unit, ci.acceptance_criteria, ci.order_index,
            r.id AS result_id, COALESCE(r.value, '') AS value,
            COALESCE(r.status, 'pendente') AS status, COALESCE(r.notes, '') AS notes,
            r.updated_at AS result_updated_at
       FROM sg_checklist_items ci
       LEFT JOIN sg_order_checklist_results r
         ON r.checklist_item_id = ci.id
        AND r.order_id = $2
        AND r.deleted_at IS NULL
      WHERE ci.checklist_id = $1 AND ci.deleted_at IS NULL
      ORDER BY ci.order_index ASC, ci.id ASC`,
    [order.checklist_id, orderId]
  )).rows;

  return { order, checklist: { id: order.checklist_id, name: order.checklist_name }, items };
}

async function upsertChecklistResult(orderId, input, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = (await client.query(
      "SELECT id, checklist_id FROM sg_maintenance_orders WHERE id = $1 AND deleted_at IS NULL",
      [orderId]
    )).rows[0] || null;
    if (!order) throw orderInvalidError();
    if (!order.checklist_id) throw checklistInvalidError();

    const item = (await client.query(
      `SELECT id FROM sg_checklist_items
        WHERE id = $1 AND checklist_id = $2 AND deleted_at IS NULL`,
      [input.checklistItemId, order.checklist_id]
    )).rows[0] || null;
    if (!item) throw checklistInvalidError();

    const result = (await client.query(
      `INSERT INTO sg_order_checklist_results
        (order_id, checklist_id, checklist_item_id, value, status, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (order_id, checklist_item_id) WHERE deleted_at IS NULL
       DO UPDATE SET value = EXCLUDED.value,
                     status = EXCLUDED.status,
                     notes = EXCLUDED.notes,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()
       RETURNING *`,
      [orderId, order.checklist_id, input.checklistItemId, input.value, input.status, input.notes, actor]
    )).rows[0];

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getOrderChecklistExecution, upsertChecklistResult };
