// Cadastro complementar (um por usuário). Colunas *_enc chegam já cifradas.

async function getByUserId(db, userId) {
  const { rows } = await db.query("SELECT * FROM ex_profiles WHERE user_id = $1", [userId]);
  return rows[0] || null;
}

async function upsert(db, data) {
  const { rows } = await db.query(
    `INSERT INTO ex_profiles (user_id, username, full_name, cpf_enc, email, phone, bank_code, bank_name, agency,
                              account_number_enc, account_digit, account_type, pix_key_enc, pix_key_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username, full_name = EXCLUDED.full_name, cpf_enc = EXCLUDED.cpf_enc,
       email = EXCLUDED.email, phone = EXCLUDED.phone, bank_code = EXCLUDED.bank_code,
       bank_name = EXCLUDED.bank_name, agency = EXCLUDED.agency, account_number_enc = EXCLUDED.account_number_enc,
       account_digit = EXCLUDED.account_digit, account_type = EXCLUDED.account_type,
       pix_key_enc = EXCLUDED.pix_key_enc, pix_key_type = EXCLUDED.pix_key_type, updated_at = NOW()
     RETURNING *`,
    [data.userId, data.username, data.fullName, data.cpfEnc, data.email, data.phone, data.bankCode, data.bankName,
      data.agency, data.accountNumberEnc, data.accountDigit, data.accountType, data.pixKeyEnc, data.pixKeyType]
  );
  return rows[0];
}

module.exports = { getByUserId, upsert };
