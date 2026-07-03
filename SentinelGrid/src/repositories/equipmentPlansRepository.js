const pool = require("../db");

const BASE_FROM = `FROM sg_equipment_plans p
  JOIN sg_equipment e ON e.id = p.equipment_id
  JOIN sg_clients c ON c.id = e.client_id
  JOIN sg_sites s ON s.id = e.site_id
  JOIN sg_areas a ON a.id = e.area_id
  LEFT JOIN sg_maintenance_programs mp ON mp.id = p.program_id`;

const SELECT_COLS = `p.*, e.tag AS equipment_tag, e.serial_number AS equipment_serial_number,
  c.name AS client_name, s.name AS site_name, a.name AS area_name, mp.name AS program_name`;

function equipmentInvalidError() {
  const err = new Error("Equipamento invalido ou inexistente");
  err.code = "SG_EQUIPMENT_INVALID";
  return err;
}

function planInvalidError() {
  const err = new Error("Plano invalido ou inexistente");
  err.code = "SG_PLAN_INVALID";
  return err;
}

async function assertEquipmentExists(client, equipmentId) {
  const res = await client.query("SELECT id FROM sg_equipment WHERE id = $1 AND deleted_at IS NULL", [equipmentId]);
  if (!res.rows[0]) throw equipmentInvalidError();
}

async function listPlans({ equipmentId = null, clientId = null, active = null, search = "", limit = 100, offset = 0 } = {}) {
  const params = [];
  let where = "p.deleted_at IS NULL";
  const add = (cond, val) => {
    params.push(val);
    where += ` AND ${cond.replace("$?", `$${params.length}`)}`;
  };
  if (equipmentId) add("p.equipment_id = $?", equipmentId);
  if (clientId) add("e.client_id = $?", clientId);
  if (active !== null && active !== undefined) add("p.active = $?", active);
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(p.name) LIKE $${params.length} OR LOWER(e.tag) LIKE $${params.length} OR LOWER(e.serial_number) LIKE $${params.length})`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const plans = (
    await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM}
        WHERE ${where}
        ORDER BY p.active DESC, c.name ASC, e.tag ASC, p.name ASC
        LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;
  return { plans, total };
}

async function getPlan(id) {
  const plan = (await pool.query(`SELECT ${SELECT_COLS} ${BASE_FROM} WHERE p.id = $1 AND p.deleted_at IS NULL`, [id])).rows[0] || null;
  if (!plan) return null;
  const items = (await pool.query(
    `SELECT * FROM sg_plan_items WHERE plan_id = $1 AND deleted_at IS NULL ORDER BY order_index ASC, id ASC`,
    [id]
  )).rows;
  return { ...plan, items };
}

function planValues(input) {
  return [
    input.equipmentId,
    input.programId,
    input.name,
    input.maintenanceType,
    input.periodicity,
    JSON.stringify(input.adjustments || {}),
    input.active,
    input.notes
  ];
}

async function createPlan(input, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertEquipmentExists(client, input.equipmentId);
    const plan = (await client.query(
      `INSERT INTO sg_equipment_plans
        (equipment_id, program_id, name, maintenance_type, periodicity, adjustments, active, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $9)
       RETURNING *`,
      [...planValues(input), actor]
    )).rows[0];

    await client.query(
      `INSERT INTO sg_plan_items
        (plan_id, title, maintenance_type, periodicity, next_due_date, order_index, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $7)`,
      [plan.id, "Rotina principal", input.maintenanceType, input.periodicity, input.initialNextDueDate, input.notes || "", actor]
    );
    await client.query("COMMIT");
    return getPlan(plan.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updatePlan(id, input, actor = "") {
  await assertEquipmentExists(pool, input.equipmentId);
  const res = await pool.query(
    `UPDATE sg_equipment_plans
        SET equipment_id = $2, program_id = $3, name = $4, maintenance_type = $5,
            periodicity = $6, adjustments = $7::jsonb, active = $8, notes = $9,
            updated_by = $10, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
    [id, ...planValues(input), actor]
  );
  return res.rows[0] ? getPlan(id) : null;
}

async function softDeletePlan(id, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `UPDATE sg_equipment_plans SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, actor]
    );
    if (res.rowCount > 0) {
      await client.query(
        `UPDATE sg_plan_items SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
          WHERE plan_id = $1 AND deleted_at IS NULL`,
        [id, actor]
      );
    }
    await client.query("COMMIT");
    return res.rowCount > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function assertPlanExists(planId) {
  const res = await pool.query("SELECT id FROM sg_equipment_plans WHERE id = $1 AND deleted_at IS NULL", [planId]);
  if (!res.rows[0]) throw planInvalidError();
}

async function createPlanItem(planId, input, actor = "") {
  await assertPlanExists(planId);
  const res = await pool.query(
    `INSERT INTO sg_plan_items
      (plan_id, title, maintenance_type, periodicity, next_due_date, order_index, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING *`,
    [planId, input.title, input.maintenanceType, input.periodicity, input.nextDueDate, input.orderIndex, input.notes, actor]
  );
  return res.rows[0];
}

async function updatePlanItem(planId, itemId, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_plan_items
        SET title = $3, maintenance_type = $4, periodicity = $5, next_due_date = $6,
            order_index = $7, notes = $8, updated_by = $9, updated_at = NOW()
      WHERE id = $2 AND plan_id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [planId, itemId, input.title, input.maintenanceType, input.periodicity, input.nextDueDate, input.orderIndex, input.notes, actor]
  );
  return res.rows[0] || null;
}

async function softDeletePlanItem(planId, itemId, actor = "") {
  const res = await pool.query(
    `UPDATE sg_plan_items SET deleted_at = NOW(), updated_by = $3, updated_at = NOW()
      WHERE id = $2 AND plan_id = $1 AND deleted_at IS NULL RETURNING id`,
    [planId, itemId, actor]
  );
  return res.rowCount > 0;
}

module.exports = {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  softDeletePlan,
  createPlanItem,
  updatePlanItem,
  softDeletePlanItem
};
