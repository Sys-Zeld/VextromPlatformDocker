const pool = require("../db");

const BASE_FROM = `FROM sg_checklists cl
  LEFT JOIN sg_equipment_types t ON t.id = cl.equipment_type_id
  LEFT JOIN sg_manufacturers m ON m.id = cl.manufacturer_id
  LEFT JOIN sg_equipment_models mo ON mo.id = cl.model_id
  LEFT JOIN sg_maintenance_programs p ON p.id = cl.program_id`;

const SELECT_COLS = `cl.*, t.name AS equipment_type_name, m.name AS manufacturer_name,
  mo.name AS model_name, p.name AS program_name`;

function checklistInvalidError() {
  const err = new Error("Checklist invalido ou inexistente");
  err.code = "SG_CHECKLIST_INVALID";
  return err;
}

async function listChecklists({
  equipmentTypeId = null,
  manufacturerId = null,
  modelId = null,
  programId = null,
  maintenanceType = "",
  active = null,
  search = "",
  limit = 100,
  offset = 0
} = {}) {
  const params = [];
  let where = "cl.deleted_at IS NULL";
  const add = (cond, val) => {
    params.push(val);
    where += ` AND ${cond.replace("$?", `$${params.length}`)}`;
  };

  if (equipmentTypeId) add("cl.equipment_type_id = $?", equipmentTypeId);
  if (manufacturerId) add("cl.manufacturer_id = $?", manufacturerId);
  if (modelId) add("cl.model_id = $?", modelId);
  if (programId) add("cl.program_id = $?", programId);
  if (maintenanceType) add("cl.maintenance_type = $?", maintenanceType);
  if (active !== null && active !== undefined) add("cl.active = $?", active);
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(cl.name) LIKE $${params.length} OR LOWER(cl.description) LIKE $${params.length})`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const checklists = (
    await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM}
        WHERE ${where}
        ORDER BY cl.active DESC, cl.name ASC
        LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;

  return { checklists, total };
}

async function getChecklist(id) {
  const checklist = (await pool.query(
    `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE cl.id = $1 AND cl.deleted_at IS NULL`,
    [id]
  )).rows[0] || null;
  if (!checklist) return null;
  const items = (await pool.query(
    `SELECT * FROM sg_checklist_items
      WHERE checklist_id = $1 AND deleted_at IS NULL
      ORDER BY order_index ASC, id ASC`,
    [id]
  )).rows;
  return { ...checklist, items };
}

function values(input) {
  return [
    input.name,
    input.description,
    input.equipmentTypeId,
    input.manufacturerId,
    input.modelId,
    input.programId,
    input.maintenanceType,
    input.active,
    input.notes
  ];
}

async function createChecklist(input, actor = "") {
  const res = await pool.query(
    `INSERT INTO sg_checklists
      (name, description, equipment_type_id, manufacturer_id, model_id, program_id,
       maintenance_type, active, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING id`,
    [...values(input), actor]
  );
  return getChecklist(res.rows[0].id);
}

async function updateChecklist(id, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_checklists
        SET name = $2, description = $3, equipment_type_id = $4, manufacturer_id = $5,
            model_id = $6, program_id = $7, maintenance_type = $8, active = $9,
            notes = $10, updated_by = $11, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
    [id, ...values(input), actor]
  );
  return res.rows[0] ? getChecklist(id) : null;
}

async function softDeleteChecklist(id, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `UPDATE sg_checklists SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, actor]
    );
    if (res.rowCount > 0) {
      await client.query(
        `UPDATE sg_checklist_items SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
          WHERE checklist_id = $1 AND deleted_at IS NULL`,
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

async function assertChecklistExists(checklistId) {
  const res = await pool.query("SELECT id FROM sg_checklists WHERE id = $1 AND deleted_at IS NULL", [checklistId]);
  if (!res.rows[0]) throw checklistInvalidError();
}

async function createChecklistItem(checklistId, input, actor = "") {
  await assertChecklistExists(checklistId);
  const res = await pool.query(
    `INSERT INTO sg_checklist_items
      (checklist_id, title, item_type, required, expected_value, unit, acceptance_criteria,
       order_index, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING *`,
    [
      checklistId,
      input.title,
      input.itemType,
      input.required,
      input.expectedValue,
      input.unit,
      input.acceptanceCriteria,
      input.orderIndex,
      input.notes,
      actor
    ]
  );
  return res.rows[0];
}

async function updateChecklistItem(checklistId, itemId, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_checklist_items
        SET title = $3, item_type = $4, required = $5, expected_value = $6,
            unit = $7, acceptance_criteria = $8, order_index = $9, notes = $10,
            updated_by = $11, updated_at = NOW()
      WHERE id = $2 AND checklist_id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [
      checklistId,
      itemId,
      input.title,
      input.itemType,
      input.required,
      input.expectedValue,
      input.unit,
      input.acceptanceCriteria,
      input.orderIndex,
      input.notes,
      actor
    ]
  );
  return res.rows[0] || null;
}

async function softDeleteChecklistItem(checklistId, itemId, actor = "") {
  const res = await pool.query(
    `UPDATE sg_checklist_items SET deleted_at = NOW(), updated_by = $3, updated_at = NOW()
      WHERE id = $2 AND checklist_id = $1 AND deleted_at IS NULL RETURNING id`,
    [checklistId, itemId, actor]
  );
  return res.rowCount > 0;
}

module.exports = {
  listChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  softDeleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  softDeleteChecklistItem
};
