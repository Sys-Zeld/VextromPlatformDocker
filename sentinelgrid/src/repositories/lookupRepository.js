const pool = require("../db");

// Fábrica de repositório para lookups simples { name, notes } com soft delete.
// `table` é uma constante do código (nunca input do usuário) — seguro interpolar.
function lookupRepo(table) {
  async function list({ search = "", limit = 100, offset = 0 } = {}) {
    const params = [];
    let where = "deleted_at IS NULL";
    if (search) {
      params.push(`%${String(search).toLowerCase()}%`);
      where += ` AND LOWER(name) LIKE $${params.length}`;
    }
    const total = (await pool.query(`SELECT COUNT(*)::int AS c FROM ${table} WHERE ${where}`, params)).rows[0].c;
    params.push(limit);
    const limIdx = params.length;
    params.push(offset);
    const offIdx = params.length;
    const items = (
      await pool.query(`SELECT * FROM ${table} WHERE ${where} ORDER BY name ASC LIMIT $${limIdx} OFFSET $${offIdx}`, params)
    ).rows;
    return { items, total };
  }

  async function get(id) {
    return (await pool.query(`SELECT * FROM ${table} WHERE id = $1 AND deleted_at IS NULL`, [id])).rows[0] || null;
  }

  async function create(input, actor = "") {
    return (
      await pool.query(
        `INSERT INTO ${table} (name, notes, created_by, updated_by) VALUES ($1, $2, $3, $3) RETURNING *`,
        [input.name, input.notes, actor]
      )
    ).rows[0];
  }

  async function update(id, input, actor = "") {
    return (
      await pool.query(
        `UPDATE ${table} SET name = $2, notes = $3, updated_by = $4, updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
        [id, input.name, input.notes, actor]
      )
    ).rows[0] || null;
  }

  async function softDelete(id, actor = "") {
    const res = await pool.query(
      `UPDATE ${table} SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, actor]
    );
    return res.rowCount > 0;
  }

  // Ensure-or-create por nome (case-insensitive). Usado na importação de cadastros
  // de outro módulo (RS guarda tipo/fabricante como texto; aqui viram lookup). Nome
  // vazio → null. Tolera corrida na unicidade re-selecionando após conflito.
  async function ensureByName(name, actor = "") {
    const nm = String(name == null ? "" : name).trim();
    if (!nm) return null;
    const existing = (
      await pool.query(`SELECT * FROM ${table} WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1`, [nm])
    ).rows[0];
    if (existing) return existing;
    try {
      return await create({ name: nm, notes: "" }, actor);
    } catch (_err) {
      return (
        await pool.query(`SELECT * FROM ${table} WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL LIMIT 1`, [nm])
      ).rows[0] || null;
    }
  }

  return { list, get, create, update, softDelete, ensureByName };
}

module.exports = { lookupRepo };
