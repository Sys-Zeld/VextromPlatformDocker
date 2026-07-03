const fs = require("fs");
const path = require("path");
const pool = require("../db");

// Runner de migrations versionadas (ADR-006): aplica só os arquivos .sql
// pendentes, em ordem alfabética (001_, 002_, ...), cada um numa transação,
// registrando a versão aplicada em sg_schema_migrations.
const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sg_schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function appliedVersions() {
  const { rows } = await pool.query("SELECT version FROM sg_schema_migrations");
  return new Set(rows.map((row) => row.version));
}

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function runMigrations() {
  await ensureMigrationsTable();
  const done = await appliedVersions();
  const files = migrationFiles();
  const pending = files.filter((file) => !done.has(file));

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO sg_schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      // eslint-disable-next-line no-console
      console.log(`[sentinelgrid] applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`SentinelGrid migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return { applied: pending.length, total: files.length };
}

module.exports = { runMigrations };
