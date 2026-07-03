const { Pool } = require("pg");
const env = require("../../specflow/config/env");

// Banco isolado do SentinelGrid (ADR-001: isolamento total por dado).
const pool = new Pool({
  connectionString: env.databases.sentinelgrid.url,
  ssl: env.databases.sentinelgrid.ssl ? { rejectUnauthorized: false } : false
});

module.exports = pool;
