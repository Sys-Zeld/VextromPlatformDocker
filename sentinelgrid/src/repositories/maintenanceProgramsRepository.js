const pool = require("../db");

const BASE_FROM = `FROM sg_maintenance_programs p
  LEFT JOIN sg_equipment_types t ON t.id = p.equipment_type_id
  LEFT JOIN sg_manufacturers m ON m.id = p.manufacturer_id
  LEFT JOIN sg_equipment_models mo ON mo.id = p.model_id
  LEFT JOIN sg_contracts ct ON ct.id = p.contract_id
  LEFT JOIN sg_clients c ON c.id = ct.client_id`;

const SELECT_COLS = `p.*, t.name AS equipment_type_name, m.name AS manufacturer_name,
  mo.name AS model_name, ct.name AS contract_name, c.name AS contract_client_name,
  to_char(ct.valid_from, 'YYYY-MM-DD') AS contract_valid_from,
  to_char(ct.valid_to, 'YYYY-MM-DD') AS contract_valid_to`;

async function listPrograms({
  equipmentTypeId = null,
  manufacturerId = null,
  modelId = null,
  contractId = null,
  criticality = "",
  maintenanceType = "",
  periodicity = "",
  active = null,
  search = "",
  limit = 100,
  offset = 0
} = {}) {
  const params = [];
  let where = "p.deleted_at IS NULL";
  const add = (cond, val) => {
    params.push(val);
    where += ` AND ${cond.replace("$?", `$${params.length}`)}`;
  };

  if (equipmentTypeId) add("p.equipment_type_id = $?", equipmentTypeId);
  if (manufacturerId) add("p.manufacturer_id = $?", manufacturerId);
  if (modelId) add("p.model_id = $?", modelId);
  if (contractId) add("p.contract_id = $?", contractId);
  if (criticality) add("p.criticality = $?", criticality);
  if (maintenanceType) add("p.maintenance_type = $?", maintenanceType);
  if (periodicity) add("p.periodicity = $?", periodicity);
  if (active !== null && active !== undefined) add("p.active = $?", active);
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const programs = (
    await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM}
        WHERE ${where}
        ORDER BY p.active DESC, p.name ASC
        LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;

  return { programs, total };
}

async function getProgram(id) {
  const res = await pool.query(`SELECT ${SELECT_COLS} ${BASE_FROM} WHERE p.id = $1 AND p.deleted_at IS NULL`, [id]);
  return res.rows[0] || null;
}

function values(input) {
  return [
    input.name,
    input.description,
    input.equipmentTypeId,
    input.manufacturerId,
    input.modelId,
    input.contractId,
    input.criticality,
    input.maintenanceType,
    input.periodicity,
    input.active,
    input.scopeNotes,
    input.notes,
    input.planIntervalsMonths || []
  ];
}

async function createProgram(input, actor = "") {
  const res = await pool.query(
    `INSERT INTO sg_maintenance_programs
      (name, description, equipment_type_id, manufacturer_id, model_id, contract_id, criticality,
       maintenance_type, periodicity, active, scope_notes, notes, plan_intervals_months, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
     RETURNING *`,
    [...values(input), actor]
  );
  return res.rows[0];
}

async function updateProgram(id, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_maintenance_programs
        SET name = $2, description = $3, equipment_type_id = $4, manufacturer_id = $5,
            model_id = $6, contract_id = $7, criticality = $8, maintenance_type = $9,
            periodicity = $10, active = $11, scope_notes = $12, notes = $13, plan_intervals_months = $14,
            updated_by = $15, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id, ...values(input), actor]
  );
  return res.rows[0] || null;
}

// Soft delete em cascata do programa: exclui os planos que o usam (+itens) e as
// ordens geradas desses planos. Guarda de pertinência (decisão de produto): um
// programa é um template que pode ter sido aplicado a equipamentos de mais de um
// cliente; nesse caso bloqueamos, para não apagar dados de outro cliente sem
// querer. Retorno estruturado (a rota mapeia para 404 / 409 / 204):
//   { ok: false, notFound: true }
//   { ok: false, blocked: true, clientCount, clientNames }
//   { ok: true, deletedPlans, deletedOrders }
async function softDeleteProgram(id, actor = "") {
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");

    const exists = await conn.query(
      "SELECT id FROM sg_maintenance_programs WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id]
    );
    if (exists.rowCount === 0) {
      await conn.query("ROLLBACK");
      return { ok: false, notFound: true };
    }

    // Clientes distintos cobertos pelos planos ativos deste programa.
    const clientsRes = await conn.query(
      `SELECT DISTINCT e.client_id, c.name
         FROM sg_equipment_plans p
         JOIN sg_equipment e ON e.id = p.equipment_id
         JOIN sg_clients c ON c.id = e.client_id
        WHERE p.program_id = $1 AND p.deleted_at IS NULL`,
      [id]
    );
    if (clientsRes.rowCount > 1) {
      await conn.query("ROLLBACK");
      return {
        ok: false,
        blocked: true,
        clientCount: clientsRes.rowCount,
        clientNames: clientsRes.rows.map((r) => r.name)
      };
    }

    // Ordens geradas dos planos do programa.
    const ordersRes = await conn.query(
      `UPDATE sg_maintenance_orders SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
        WHERE plan_id IN (SELECT id FROM sg_equipment_plans WHERE program_id = $1 AND deleted_at IS NULL)
          AND deleted_at IS NULL
        RETURNING id`,
      [id, actor]
    );
    // Itens dos planos do programa.
    await conn.query(
      `UPDATE sg_plan_items SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
        WHERE plan_id IN (SELECT id FROM sg_equipment_plans WHERE program_id = $1 AND deleted_at IS NULL)
          AND deleted_at IS NULL`,
      [id, actor]
    );
    // Planos vinculados ao programa.
    const plansRes = await conn.query(
      `UPDATE sg_equipment_plans SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
        WHERE program_id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, actor]
    );
    // O próprio programa.
    await conn.query(
      "UPDATE sg_maintenance_programs SET deleted_at = NOW(), updated_by = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
      [id, actor]
    );

    await conn.query("COMMIT");
    return { ok: true, deletedPlans: plansRes.rowCount, deletedOrders: ordersRes.rowCount };
  } catch (err) {
    await conn.query("ROLLBACK");
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listPrograms, getProgram, createProgram, updateProgram, softDeleteProgram };
