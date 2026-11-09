// Categorias de despesa. Sem exclusão física (lançamentos as referenciam):
// desativar tira a categoria dos novos lançamentos.

async function list(db, { onlyActive = false } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM ex_categories ${onlyActive ? "WHERE active" : ""} ORDER BY sort_order, name`
  );
  return rows;
}

async function get(db, id) {
  const { rows } = await db.query("SELECT * FROM ex_categories WHERE id = $1", [id]);
  return rows[0] || null;
}

async function create(db, input) {
  const { rows } = await db.query(
    `INSERT INTO ex_categories (name, description, active, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.name, input.description, input.active, input.sortOrder]
  );
  return rows[0];
}

async function update(db, id, input) {
  const { rows } = await db.query(
    `UPDATE ex_categories SET name = $2, description = $3, active = $4, sort_order = $5, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, input.name, input.description, input.active, input.sortOrder]
  );
  return rows[0] || null;
}

module.exports = { list, get, create, update };
