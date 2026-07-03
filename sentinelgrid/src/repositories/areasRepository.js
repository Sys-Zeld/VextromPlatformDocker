const pool = require("../db");

// Repositório de Áreas. Leituras trazem site e cliente (join) e filtram soft delete.
async function listAreas({ siteId = null, clientId = null, search = "", limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = "a.deleted_at IS NULL";
  if (siteId) {
    params.push(siteId);
    where += ` AND a.site_id = $${params.length}`;
  }
  if (clientId) {
    params.push(clientId);
    where += ` AND s.client_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(a.name) LIKE $${params.length} OR LOWER(a.area_type) LIKE $${params.length})`;
  }

  const baseFrom = "FROM sg_areas a JOIN sg_sites s ON s.id = a.site_id JOIN sg_clients c ON c.id = s.client_id";
  const totalRes = await pool.query(`SELECT COUNT(*)::int AS c ${baseFrom} WHERE ${where}`, params);

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const rowsRes = await pool.query(
    `SELECT a.*, s.name AS site_name, s.client_id, c.name AS client_name
       ${baseFrom}
      WHERE ${where}
      ORDER BY a.name ASC
      LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  );

  return { areas: rowsRes.rows, total: totalRes.rows[0].c };
}

async function getArea(id) {
  const res = await pool.query("SELECT * FROM sg_areas WHERE id = $1 AND deleted_at IS NULL", [id]);
  return res.rows[0] || null;
}

async function createArea(input, actor = "") {
  const res = await pool.query(
    `INSERT INTO sg_areas (site_id, name, area_type, classification, access_restrictions, env_conditions, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING *`,
    [input.siteId, input.name, input.areaType, input.classification, input.accessRestrictions, input.envConditions, input.notes, actor]
  );
  return res.rows[0];
}

async function updateArea(id, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_areas
        SET site_id = $2, name = $3, area_type = $4, classification = $5,
            access_restrictions = $6, env_conditions = $7, notes = $8,
            updated_by = $9, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id, input.siteId, input.name, input.areaType, input.classification, input.accessRestrictions, input.envConditions, input.notes, actor]
  );
  return res.rows[0] || null;
}

async function softDeleteArea(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_areas
        SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

module.exports = { listAreas, getArea, createArea, updateArea, softDeleteArea };
