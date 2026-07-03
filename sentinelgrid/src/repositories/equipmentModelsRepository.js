const pool = require("../db");

const BASE_FROM =
  "FROM sg_equipment_models em " +
  "JOIN sg_manufacturers m ON m.id = em.manufacturer_id " +
  "JOIN sg_equipment_types t ON t.id = em.equipment_type_id";

async function listModels({ manufacturerId = null, equipmentTypeId = null, search = "", limit = 100, offset = 0 } = {}) {
  const params = [];
  let where = "em.deleted_at IS NULL";
  if (manufacturerId) {
    params.push(manufacturerId);
    where += ` AND em.manufacturer_id = $${params.length}`;
  }
  if (equipmentTypeId) {
    params.push(equipmentTypeId);
    where += ` AND em.equipment_type_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND LOWER(em.name) LIKE $${params.length}`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const models = (
    await pool.query(
      `SELECT em.*, m.name AS manufacturer_name, t.name AS equipment_type_name
         ${BASE_FROM}
        WHERE ${where}
        ORDER BY m.name ASC, em.name ASC
        LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;

  return { models, total };
}

async function getModel(id) {
  return (await pool.query("SELECT * FROM sg_equipment_models WHERE id = $1 AND deleted_at IS NULL", [id])).rows[0] || null;
}

async function createModel(input, actor = "") {
  return (
    await pool.query(
      `INSERT INTO sg_equipment_models (manufacturer_id, equipment_type_id, name, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [input.manufacturerId, input.equipmentTypeId, input.name, input.notes, actor]
    )
  ).rows[0];
}

async function updateModel(id, input, actor = "") {
  return (
    await pool.query(
      `UPDATE sg_equipment_models
          SET manufacturer_id = $2, equipment_type_id = $3, name = $4, notes = $5,
              updated_by = $6, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, input.manufacturerId, input.equipmentTypeId, input.name, input.notes, actor]
    )
  ).rows[0] || null;
}

async function softDeleteModel(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_equipment_models SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

module.exports = { listModels, getModel, createModel, updateModel, softDeleteModel };
