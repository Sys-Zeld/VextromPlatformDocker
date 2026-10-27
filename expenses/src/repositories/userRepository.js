// Contas do módulo (login próprio). Todas as leituras ignoram excluídos.

const COLUMNS = `id, username, full_name, email, status, is_admin, is_approver, is_finance,
                 must_change_password, failed_attempts, locked_until, session_version,
                 last_login_at, password_changed_at, created_by, created_at, updated_at`;

async function getById(db, id, { withHash = false, forUpdate = false } = {}) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}${withHash ? ", password_hash" : ""} FROM ex_users
      WHERE id = $1 AND deleted_at IS NULL${forUpdate ? " FOR UPDATE" : ""}`,
    [id]
  );
  return rows[0] || null;
}

// Login aceita usuário ou e-mail.
async function findForLogin(db, identifier) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}, password_hash FROM ex_users
      WHERE deleted_at IS NULL AND (LOWER(username) = LOWER($1) OR (email <> '' AND LOWER(email) = LOWER($1)))
      LIMIT 1 FOR UPDATE`,
    [identifier]
  );
  return rows[0] || null;
}

async function list(db) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM ex_users WHERE deleted_at IS NULL ORDER BY LOWER(username)`);
  return rows;
}

async function insert(db, data) {
  const { rows } = await db.query(
    `INSERT INTO ex_users (username, full_name, email, password_hash, status, is_admin, is_approver, is_finance,
                           must_change_password, password_changed_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $4 <> '' THEN NOW() END, $10)
     RETURNING ${COLUMNS}`,
    [data.username, data.fullName, data.email, data.passwordHash || "", data.status, data.isAdmin, data.isApprover,
      data.isFinance, data.mustChangePassword, data.createdBy]
  );
  return rows[0];
}

async function update(db, id, data) {
  const { rows } = await db.query(
    `UPDATE ex_users
        SET full_name = $2, email = $3, status = $4, is_admin = $5, is_approver = $6, is_finance = $7,
            session_version = session_version + CASE WHEN $8 THEN 1 ELSE 0 END,
            failed_attempts = CASE WHEN $9 THEN 0 ELSE failed_attempts END,
            locked_until = CASE WHEN $9 THEN NULL ELSE locked_until END,
            updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, data.fullName, data.email, data.status, data.isAdmin, data.isApprover, data.isFinance,
      Boolean(data.revokeSessions), Boolean(data.unlock)]
  );
  return rows[0] || null;
}

async function setPassword(db, id, { passwordHash, mustChange = false }) {
  const { rows } = await db.query(
    `UPDATE ex_users
        SET password_hash = $2, must_change_password = $3, status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
            failed_attempts = 0, locked_until = NULL, session_version = session_version + 1,
            password_changed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, passwordHash, mustChange]
  );
  return rows[0] || null;
}

async function registerFailure(db, id, { maxAttempts, lockMinutes }) {
  const { rows } = await db.query(
    `UPDATE ex_users
        SET failed_attempts = CASE WHEN failed_attempts + 1 >= $2 THEN 0 ELSE failed_attempts + 1 END,
            locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE locked_until END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING failed_attempts, locked_until`,
    [id, maxAttempts, lockMinutes]
  );
  return rows[0];
}

async function registerSuccess(db, id) {
  await db.query(
    "UPDATE ex_users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1",
    [id]
  );
}

async function softDelete(db, id) {
  await db.query(
    `UPDATE ex_users SET deleted_at = NOW(), status = 'disabled', session_version = session_version + 1, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
}

async function countActiveAdmins(db, { excludeId = null } = {}) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM ex_users
      WHERE deleted_at IS NULL AND is_admin AND status = 'active' AND ($1::text IS NULL OR id <> $1)`,
    [excludeId]
  );
  return rows[0].c;
}

async function listApprovers(db) {
  const { rows } = await db.query(
    `SELECT id, username, email FROM ex_users
      WHERE deleted_at IS NULL AND status = 'active' AND is_approver`
  );
  return rows;
}

/* --------------------------------- Tokens --------------------------------- */

async function insertToken(db, { userId, kind, tokenHash, ttlMinutes }) {
  // Um token válido por tipo: emitir um novo invalida os anteriores.
  await db.query(
    "UPDATE ex_user_tokens SET used_at = NOW() WHERE user_id = $1 AND kind = $2 AND used_at IS NULL",
    [userId, kind]
  );
  const { rows } = await db.query(
    `INSERT INTO ex_user_tokens (user_id, kind, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(mins => $4)) RETURNING expires_at`,
    [userId, kind, tokenHash, ttlMinutes]
  );
  return rows[0];
}

async function findValidToken(db, tokenHash, { forUpdate = false } = {}) {
  const { rows } = await db.query(
    `SELECT t.*, u.username, u.email FROM ex_user_tokens t JOIN ex_users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW() AND u.deleted_at IS NULL
        AND u.status <> 'disabled'${forUpdate ? " FOR UPDATE OF t" : ""}`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function markTokenUsed(db, id) {
  await db.query("UPDATE ex_user_tokens SET used_at = NOW() WHERE id = $1", [id]);
}

module.exports = {
  getById,
  findForLogin,
  list,
  insert,
  update,
  setPassword,
  registerFailure,
  registerSuccess,
  softDelete,
  countActiveAdmins,
  listApprovers,
  insertToken,
  findValidToken,
  markTokenUsed
};
