// Membros do módulo (acesso + papéis). Conta de login fica na plataforma.

async function get(db, userId) {
  const { rows } = await db.query("SELECT * FROM ex_members WHERE user_id = $1", [userId]);
  return rows[0] || null;
}

async function list(db) {
  const { rows } = await db.query("SELECT * FROM ex_members ORDER BY username");
  return rows;
}

async function upsert(db, data) {
  const { rows } = await db.query(
    `INSERT INTO ex_members (user_id, username, active, is_approver, is_finance, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username, active = EXCLUDED.active, is_approver = EXCLUDED.is_approver,
       is_finance = EXCLUDED.is_finance, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING *`,
    [data.userId, data.username, data.active, data.isApprover, data.isFinance, data.actor]
  );
  return rows[0];
}

// Membros ativos com papel de aprovação (destinatários das notificações de envio).
async function listApprovers(db) {
  const { rows } = await db.query("SELECT user_id, username FROM ex_members WHERE active AND is_approver");
  return rows;
}

// Remove o cadastro no módulo (relatórios e auditoria do usuário permanecem).
async function remove(db, userId) {
  const { rowCount } = await db.query("DELETE FROM ex_members WHERE user_id = $1", [userId]);
  return rowCount > 0;
}

module.exports = { get, list, upsert, listApprovers, remove };
