const pool = require("../db");

const BASE_FROM = "FROM sg_contracts ct JOIN sg_clients c ON c.id = ct.client_id";

async function listContracts({ clientId = null, search = "", limit = 100, offset = 0 } = {}) {
  const params = [];
  let where = "ct.deleted_at IS NULL";
  if (clientId) {
    params.push(clientId);
    where += ` AND ct.client_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND LOWER(ct.name) LIKE $${params.length}`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const contracts = (
    await pool.query(
      `SELECT ct.*, c.name AS client_name
         ${BASE_FROM} WHERE ${where} ORDER BY c.name ASC, ct.name ASC LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;
  return { contracts, total };
}

async function getContract(id) {
  return (await pool.query("SELECT * FROM sg_contracts WHERE id = $1 AND deleted_at IS NULL", [id])).rows[0] || null;
}

async function createContract(input, actor = "") {
  return (
    await pool.query(
      `INSERT INTO sg_contracts
         (client_id, name, valid_from, valid_to, maint_per_year, sla_corrective, requires_report, requires_approval, scope, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) RETURNING *`,
      [input.clientId, input.name, input.validFrom, input.validTo, input.maintPerYear, input.slaCorrective, input.requiresReport, input.requiresApproval, input.scope, input.notes, actor]
    )
  ).rows[0];
}

async function updateContract(id, input, actor = "") {
  return (
    await pool.query(
      `UPDATE sg_contracts
          SET client_id = $2, name = $3, valid_from = $4, valid_to = $5, maint_per_year = $6,
              sla_corrective = $7, requires_report = $8, requires_approval = $9, scope = $10, notes = $11,
              updated_by = $12, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, input.clientId, input.name, input.validFrom, input.validTo, input.maintPerYear, input.slaCorrective, input.requiresReport, input.requiresApproval, input.scope, input.notes, actor]
    )
  ).rows[0] || null;
}

async function softDeleteContract(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_contracts SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

module.exports = { listContracts, getContract, createContract, updateContract, softDeleteContract };
