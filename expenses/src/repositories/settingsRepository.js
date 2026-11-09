// Configurações do módulo (chave/valor).

async function getMany(db, keys) {
  const { rows } = await db.query("SELECT key, value FROM ex_settings WHERE key = ANY($1)", [keys]);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function setMany(db, values, actor) {
  for (const [key, value] of Object.entries(values)) {
    await db.query(
      `INSERT INTO ex_settings (key, value, updated_by) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [key, value === null || value === undefined ? "" : String(value), actor]
    );
  }
}

module.exports = { getMany, setMany };
