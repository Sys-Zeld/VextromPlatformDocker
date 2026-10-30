// Auditoria (append-only, protegida por trigger) e notificações internas.

async function insertAudit(db, data) {
  await db.query(
    `INSERT INTO ex_audit_log (report_id, actor_id, actor_name, action, entity_type, entity_id,
                               previous_status, new_status, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [data.reportId || null, data.actorId, data.actorName || "", data.action, data.entityType,
      data.entityId === undefined || data.entityId === null ? null : String(data.entityId),
      data.previousStatus || null, data.newStatus || null, data.reason || "", JSON.stringify(data.metadata || {})]
  );
}

async function listAudit(db, { reportId, search, limit, offset }) {
  const params = [];
  const where = ["1=1"];
  if (reportId) { params.push(reportId); where.push(`l.report_id = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(r.report_number) LIKE $${params.length} OR LOWER(l.actor_name) LIKE $${params.length}
                 OR LOWER(l.action) LIKE $${params.length})`);
  }
  const from = "ex_audit_log l LEFT JOIN ex_reports r ON r.id = l.report_id";
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM ${from} WHERE ${where.join(" AND ")}`, params);
  const { rows } = await db.query(
    `SELECT l.*, r.report_number FROM ${from}
      WHERE ${where.join(" AND ")}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { entries: rows, total: total.rows[0].c };
}

async function insertNotification(db, data) {
  await db.query(
    `INSERT INTO ex_notifications (recipient_user_id, report_id, event, title, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.recipientUserId, data.reportId || null, data.event, data.title, data.message || ""]
  );
}

async function listNotifications(db, userId, { limit = 50, unreadOnly = false } = {}) {
  const { rows } = await db.query(
    `SELECT n.*, r.report_number FROM ex_notifications n LEFT JOIN ex_reports r ON r.id = n.report_id
      WHERE n.recipient_user_id = $1 ${unreadOnly ? "AND n.read_at IS NULL" : ""}
      ORDER BY n.created_at DESC, n.id DESC LIMIT $2`,
    [userId, limit]
  );
  const unread = await db.query(
    "SELECT COUNT(*)::int AS c FROM ex_notifications WHERE recipient_user_id = $1 AND read_at IS NULL",
    [userId]
  );
  return { notifications: rows, unread: unread.rows[0].c };
}

// Marca como lida só se pertencer ao usuário (id null = todas).
async function markRead(db, userId, notificationId = null) {
  if (notificationId) {
    await db.query(
      "UPDATE ex_notifications SET read_at = NOW() WHERE id = $1 AND recipient_user_id = $2 AND read_at IS NULL",
      [notificationId, userId]
    );
  } else {
    await db.query(
      "UPDATE ex_notifications SET read_at = NOW() WHERE recipient_user_id = $1 AND read_at IS NULL",
      [userId]
    );
  }
}

module.exports = { insertAudit, listAudit, insertNotification, listNotifications, markRead };
