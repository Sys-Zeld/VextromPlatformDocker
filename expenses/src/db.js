const { Pool } = require("pg");
const env = require("../../specflow/config/env");

// Banco isolado do módulo Relatório de Despesas.
const pool = new Pool({
  connectionString: env.databases.expenses.url,
  ssl: env.databases.expenses.ssl ? { rejectUnauthorized: false } : false
});

// Executa `fn(client)` numa transação. Toda alteração financeira passa por aqui.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.withTransaction = withTransaction;
