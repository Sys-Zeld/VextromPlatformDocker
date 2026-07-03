const env = require("../specflow/config/env");
const { ensureDatabaseExists } = require("../specflow/db/ensure-database");
const { runMigrations } = require("./src/migrations/runner");

// Entrypoint de migração do SentinelGrid: garante o banco isolado e aplica as
// migrations versionadas pendentes. Reutiliza a infra de plataforma
// (ensureDatabaseExists) — ADR-002: infra compartilhada, domínio isolado.
async function migrateSentinelGrid() {
  await ensureDatabaseExists({
    connectionString: env.databases.sentinelgrid.url,
    ssl: env.databases.sentinelgrid.ssl
  });
  return runMigrations();
}

module.exports = { migrateSentinelGrid };

if (require.main === module) {
  migrateSentinelGrid()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(`SentinelGrid migration complete (${result.applied} applied / ${result.total} total).`);
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("SentinelGrid migration failed:", err.message);
      process.exit(1);
    });
}
