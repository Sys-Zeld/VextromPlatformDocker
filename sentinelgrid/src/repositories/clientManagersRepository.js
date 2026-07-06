const pool = require("../db");

const BASE_FROM =
  "FROM sg_client_managers mg JOIN sg_clients c ON c.id = mg.client_id LEFT JOIN sg_sites s ON s.id = mg.site_id LEFT JOIN sg_areas a ON a.id = mg.area_id";

async function listManagers({ clientId = null, search = "", limit = 100, offset = 0 } = {}) {
  const params = [];
  let where = "mg.deleted_at IS NULL";
  if (clientId) {
    params.push(clientId);
    where += ` AND mg.client_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(mg.name) LIKE $${params.length} OR LOWER(mg.role_type) LIKE $${params.length})`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const managers = (
    await pool.query(
      `SELECT mg.*, c.name AS client_name, s.name AS site_name, a.name AS area_name
         ${BASE_FROM} WHERE ${where} ORDER BY c.name ASC, mg.name ASC LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;
  return { managers, total };
}

async function getManager(id) {
  return (await pool.query("SELECT * FROM sg_client_managers WHERE id = $1 AND deleted_at IS NULL", [id])).rows[0] || null;
}

async function createManager(input, actor = "") {
  return (
    await pool.query(
      `INSERT INTO sg_client_managers (client_id, site_id, area_id, name, role_type, email, phone, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
      [input.clientId, input.siteId, input.areaId, input.name, input.roleType, input.email, input.phone, input.notes, actor]
    )
  ).rows[0];
}

async function updateManager(id, input, actor = "") {
  return (
    await pool.query(
      `UPDATE sg_client_managers
          SET client_id = $2, site_id = $3, area_id = $4, name = $5, role_type = $6, email = $7, phone = $8, notes = $9,
              updated_by = $10, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, input.clientId, input.siteId, input.areaId, input.name, input.roleType, input.email, input.phone, input.notes, actor]
    )
  ).rows[0] || null;
}

async function softDeleteManager(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_client_managers SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

module.exports = { listManagers, getManager, createManager, updateManager, softDeleteManager };
