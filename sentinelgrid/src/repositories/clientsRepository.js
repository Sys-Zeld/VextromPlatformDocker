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

// Soft delete em cascata de TODA a árvore do cliente, numa única transação.
// Regra de pertinência (decisão de produto): excluir um cliente remove sites,
// áreas, equipamentos, contratos, gestores, planos (+itens) e ordens dele, além
// dos programas vinculados a contratos DESTE cliente. Programas globais (sem
// contrato) são preservados por serem templates reutilizáveis. Como todo o app
// usa soft delete (deleted_at) e as FKs são ON DELETE RESTRICT, marcamos
// deleted_at em vez de apagar fisicamente — reversível e sem violar FKs.
async function softDeleteClient(id, actor = "") {
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");

    const exists = await conn.query(
      "SELECT id FROM sg_clients WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id]
    );
    if (exists.rowCount === 0) {
      await conn.query("ROLLBACK");
      return false;
    }

    // Ordens do cliente.
    await conn.query(
      "UPDATE sg_maintenance_orders SET deleted_at = NOW() WHERE client_id = $1 AND deleted_at IS NULL",
      [id]
    );
    // Recomendações dos equipamentos do cliente.
    await conn.query(
      `UPDATE sg_recommendations SET deleted_at = NOW()
        WHERE equipment_id IN (SELECT id FROM sg_equipment WHERE client_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    // Itens de plano e planos dos equipamentos do cliente.
    await conn.query(
      `UPDATE sg_plan_items SET deleted_at = NOW()
        WHERE plan_id IN (
          SELECT p.id FROM sg_equipment_plans p
          JOIN sg_equipment e ON e.id = p.equipment_id
          WHERE e.client_id = $1
        ) AND deleted_at IS NULL`,
      [id]
    );
    await conn.query(
      `UPDATE sg_equipment_plans SET deleted_at = NOW()
        WHERE equipment_id IN (SELECT id FROM sg_equipment WHERE client_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    // Grupos de equipamentos dos sites do cliente.
    await conn.query(
      `UPDATE sg_equipment_groups SET deleted_at = NOW()
        WHERE site_id IN (SELECT id FROM sg_sites WHERE client_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    // Equipamentos do cliente.
    await conn.query(
      "UPDATE sg_equipment SET deleted_at = NOW() WHERE client_id = $1 AND deleted_at IS NULL",
      [id]
    );
    // Programas vinculados a contratos do cliente (globais, sem contrato, preservados).
    await conn.query(
      `UPDATE sg_maintenance_programs SET deleted_at = NOW()
        WHERE contract_id IN (SELECT id FROM sg_contracts WHERE client_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    // Contratos do cliente.
    await conn.query(
      "UPDATE sg_contracts SET deleted_at = NOW() WHERE client_id = $1 AND deleted_at IS NULL",
      [id]
    );
    // Áreas dos sites do cliente e os próprios sites.
    await conn.query(
      `UPDATE sg_areas SET deleted_at = NOW()
        WHERE site_id IN (SELECT id FROM sg_sites WHERE client_id = $1) AND deleted_at IS NULL`,
      [id]
    );
    await conn.query(
      "UPDATE sg_sites SET deleted_at = NOW() WHERE client_id = $1 AND deleted_at IS NULL",
      [id]
    );
    // Gestores do cliente.
    await conn.query(
      "UPDATE sg_client_managers SET deleted_at = NOW() WHERE client_id = $1 AND deleted_at IS NULL",
      [id]
    );
    // Por fim, o próprio cliente.
    await conn.query(
      "UPDATE sg_clients SET deleted_at = NOW(), updated_by = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
      [id, actor]
    );

    await conn.query("COMMIT");
    return true;
  } catch (err) {
    await conn.query("ROLLBACK");
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listClients, getClient, createClient, updateClient, softDeleteClient };
