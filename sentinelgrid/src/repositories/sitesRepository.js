const pool = require("../db");

// Repositório de Sites. Leituras trazem o nome do cliente (join) e filtram soft delete.
async function listSites({ clientId = null, search = "", limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = "s.deleted_at IS NULL";
  if (clientId) {
    params.push(clientId);
    where += ` AND s.client_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(s.name) LIKE $${params.length} OR LOWER(s.location) LIKE $${params.length})`;
  }

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS c FROM sg_sites s WHERE ${where}`, params);

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const rowsRes = await pool.query(
    `SELECT s.*, c.name AS client_name
       FROM sg_sites s
       JOIN sg_clients c ON c.id = s.client_id
      WHERE ${where}
      ORDER BY s.name ASC
      LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  );

  return { sites: rowsRes.rows, total: totalRes.rows[0].c };
}

async function getSite(id) {
  const res = await pool.query("SELECT * FROM sg_sites WHERE id = $1 AND deleted_at IS NULL", [id]);
  return res.rows[0] || null;
}

async function createSite(input, actor = "") {
  const res = await pool.query(
    `INSERT INTO sg_sites (client_id, name, site_type, location, local_contact, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
    [input.clientId, input.name, input.siteType, input.location, input.localContact, input.notes, actor]
  );
  return res.rows[0];
}

async function updateSite(id, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_sites
        SET client_id = $2, name = $3, site_type = $4, location = $5, local_contact = $6, notes = $7,
            updated_by = $8, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id, input.clientId, input.name, input.siteType, input.location, input.localContact, input.notes, actor]
  );
  return res.rows[0] || null;
}

async function softDeleteSite(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_sites
        SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

module.exports = { listSites, getSite, createSite, updateSite, softDeleteSite };
