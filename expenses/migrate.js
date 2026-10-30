const env = require("../specflow/config/env");
const { ensureDatabaseExists } = require("../specflow/db/ensure-database");
const { runMigrations } = require("./src/migrations/runner");

// Entrypoint de migração do módulo de Despesas: cria o banco isolado (se não
// existir) e aplica as migrations versionadas pendentes.
async function migrateExpenses() {
  await ensureDatabaseExists({
    connectionString: env.databases.expenses.url,
    ssl: env.databases.expenses.ssl
  });
  return runMigrations();
}

module.exports = { migrateExpenses };

if (require.main === module) {
  migrateExpenses()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(`Expenses migration complete (${result.applied} applied / ${result.total} total).`);
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Expenses migration failed:", err.message);
      process.exit(1);
    });
}
