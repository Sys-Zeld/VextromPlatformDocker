const pool = require("../db");

const BASE_FROM = "FROM sg_contracts ct JOIN sg_clients c ON c.id = ct.client_id";

// Iniciais do cliente para o número do contrato: até 3 letras/dígitos.
// Ex.: "Sabesp Baterias e Manutenção" -> "SBM"; "Vextrom" -> "VEX".
function clientInitials(name) {
  const words = String(name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .match(/[A-Za-z0-9]+/g) || [];
  if (words.length === 0) return "XXX";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

// Numeração INICIAIS-NNNNNN-AA, ex.: SBM-135242-26.
function generateContractNumber(clientName) {
  const initials = clientInitials(clientName);
  const rand = String(Math.floor(100000 + Math.random() * 900000));
  const yy = String(new Date().getFullYear()).slice(-2);
  return `${initials}-${rand}-${yy}`;
}

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
  let contractNumber = (input.contractNumber || "").trim();
  if (!contractNumber) {
    const clientName = (await pool.query("SELECT name FROM sg_clients WHERE id = $1", [input.clientId])).rows[0]?.name || "";
    contractNumber = generateContractNumber(clientName);
  }
  return (
    await pool.query(
      `INSERT INTO sg_contracts
         (client_id, name, contract_number, valid_from, valid_to, maint_per_year, sla_corrective, requires_report, requires_approval, contact_email, contact_phone, scope, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14) RETURNING *`,
      [input.clientId, input.name, contractNumber, input.validFrom, input.validTo, input.maintPerYear, input.slaCorrective, input.requiresReport, input.requiresApproval, input.contactEmail, input.contactPhone, input.scope, input.notes, actor]
    )
  ).rows[0];
}

async function updateContract(id, input, actor = "") {
  return (
    await pool.query(
      `UPDATE sg_contracts
          SET client_id = $2, name = $3, contract_number = $4, valid_from = $5, valid_to = $6, maint_per_year = $7,
              sla_corrective = $8, requires_report = $9, requires_approval = $10, contact_email = $11, contact_phone = $12,
              scope = $13, notes = $14, updated_by = $15, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, input.clientId, input.name, input.contractNumber, input.validFrom, input.validTo, input.maintPerYear, input.slaCorrective, input.requiresReport, input.requiresApproval, input.contactEmail, input.contactPhone, input.scope, input.notes, actor]
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

module.exports = { listContracts, getContract, createContract, updateContract, softDeleteContract, clientInitials, generateContractNumber };
