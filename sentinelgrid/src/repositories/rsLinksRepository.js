const pool = require("../db");

// Mapeamento 1:1 SentinelGrid ↔ Service Report por entidade (cliente/site/equipamento),
// persistido em sg_rs_links (Fase 11.2). Usado como mecanismo de deduplicação/idempotência
// na troca de cadastros: dado um id de um lado, achamos (se existir) o id correspondente
// do outro, evitando criar registros duplicados a cada nova sincronização.
const ENTITY_TYPES = ["client", "site", "equipment"];

async function getSgIdByRs(entityType, rsId) {
  const res = await pool.query(
    "SELECT sg_id FROM sg_rs_links WHERE entity_type = $1 AND rs_id = $2 LIMIT 1",
    [entityType, rsId]
  );
  return res.rows[0] ? Number(res.rows[0].sg_id) : null;
}

async function getRsIdBySg(entityType, sgId) {
  const res = await pool.query(
    "SELECT rs_id FROM sg_rs_links WHERE entity_type = $1 AND sg_id = $2 LIMIT 1",
    [entityType, sgId]
  );
  return res.rows[0] ? Number(res.rows[0].rs_id) : null;
}

// Upsert idempotente do vínculo. Aceita um client de transação (opcional) ou usa o pool.
async function upsertLink(entityType, sgId, rsId, executor = pool) {
  await executor.query(
    `INSERT INTO sg_rs_links (entity_type, sg_id, rs_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_type, sg_id) DO UPDATE SET rs_id = EXCLUDED.rs_id, updated_at = NOW()`,
    [entityType, sgId, rsId]
  );
}

module.exports = { ENTITY_TYPES, getSgIdByRs, getRsIdBySg, upsertLink };
