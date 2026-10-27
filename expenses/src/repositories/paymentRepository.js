// Pagamentos (imutáveis). O snapshot bancário cifrado nunca sai nas listagens.

const PUBLIC_COLUMNS = `p.id, p.report_id, p.payment_type, p.amount, p.payment_date, p.payment_method,
                        p.transaction_reference, p.proof_name, p.proof_mime, (p.proof_path IS NOT NULL) AS has_proof,
                        p.notes, p.recorded_by, p.recorded_by_name, p.created_at`;

async function insert(db, data) {
  const { rows } = await db.query(
    `INSERT INTO ex_payments (report_id, payment_type, amount, payment_date, payment_method, transaction_reference,
                              proof_path, proof_name, proof_mime, bank_details_snapshot_enc, notes,
                              recorded_by, recorded_by_name)
     VALUES ($1, 'INTEGRAL', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [data.reportId, data.amount, data.paymentDate, data.paymentMethod, data.transactionReference,
      data.proofPath, data.proofName, data.proofMime, data.bankSnapshotEnc, data.notes,
      data.recordedBy, data.recordedByName]
  );
  return rows[0];
}

async function listByReport(db, reportId) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM ex_payments p WHERE p.report_id = $1 ORDER BY p.created_at`,
    [reportId]
  );
  return rows;
}

// Uso interno (download do comprovante / snapshot).
async function getRaw(db, paymentId) {
  const { rows } = await db.query("SELECT * FROM ex_payments WHERE id = $1", [paymentId]);
  return rows[0] || null;
}

async function listAll(db, { limit, offset, from, to }) {
  const params = [];
  const where = ["1=1"];
  if (from) { params.push(from); where.push(`p.payment_date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`p.payment_date <= $${params.length}`); }
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM ex_payments p WHERE ${where.join(" AND ")}`, params);
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS}, r.report_number, r.title, r.requester_username, r.requester_name
       FROM ex_payments p JOIN ex_reports r ON r.id = p.report_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { payments: rows, total: total.rows[0].c };
}

module.exports = { insert, listByReport, getRaw, listAll };
