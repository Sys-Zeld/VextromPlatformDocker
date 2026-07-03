const pool = require("../db");

// Repositório de Clientes. Soft delete: toda leitura filtra deleted_at IS NULL.
async function listClients({ search = "", limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = "deleted_at IS NULL";
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(tax_id) LIKE $${params.length})`;
  }

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS c FROM sg_clients WHERE ${where}`, params);

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const rowsRes = await pool.query(
    `SELECT * FROM sg_clients WHERE ${where} ORDER BY name ASC LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  );

  return { clients: rowsRes.rows, total: totalRes.rows[0].c };
}

async function getClient(id) {
  const res = await pool.query("SELECT * FROM sg_clients WHERE id = $1 AND deleted_at IS NULL", [id]);
  return res.rows[0] || null;
}

async function createClient(input, actor = "") {
  const res = await pool.query(
    `INSERT INTO sg_clients (name, tax_id, segment, status, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *`,
    [input.name, input.taxId, input.segment, input.status, input.notes, actor]
  );
  return res.rows[0];
}

async function updateClient(id, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_clients
        SET name = $2, tax_id = $3, segment = $4, status = $5, notes = $6,
            updated_by = $7, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id, input.name, input.taxId, input.segment, input.status, input.notes, actor]
  );
  return res.rows[0] || null;
}

async function softDeleteClient(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_clients
        SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

module.exports = { listClients, getClient, createClient, updateClient, softDeleteClient };
