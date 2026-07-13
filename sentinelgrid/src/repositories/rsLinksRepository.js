const pool = require("../db");

// Mapeamento 1:1 SentinelGrid ↔ Service Report por entidade (cliente/site/equipamento),
// persistido em sg_rs_links (Fase 11.2). Usado como mecanismo de deduplicação/idempotência
// na troca de cadastros: dado um id de um lado, achamos (se existir) o id correspondente
// do outro, evitando criar registros duplicados a cada nova sincronização.
const ENTITY_TYPES = ["client", "site", "equipment"];
const ENTITY_TABLES = {
  client: "sg_clients",
  site: "sg_sites",
  equipment: "sg_equipment"
};

function entityTable(entityType) {
  const table = ENTITY_TABLES[entityType];
  if (!table) throw new Error(`Tipo de entidade de integração inválido: ${entityType}`);
  return table;
}

async function getSgIdByRs(entityType, rsId) {
  const table = entityTable(entityType);
  const res = await pool.query(
    `SELECT id AS sg_id FROM ${table}
      WHERE service_report_id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [rsId]
  );
  return res.rows[0] ? Number(res.rows[0].sg_id) : null;
}

async function getRsIdBySg(entityType, sgId) {
  const table = entityTable(entityType);
  const res = await pool.query(
    `SELECT service_report_id AS rs_id FROM ${table}
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [sgId]
  );
  return res.rows[0] && res.rows[0].rs_id != null ? Number(res.rows[0].rs_id) : null;
}

// Compatibilidade de transição: permite reaproveitar um vínculo antigo durante
// a primeira reimportação, mas nunca é usado para exibir "já vinculado".
async function getLegacySgIdByRs(entityType, rsId) {
  const res = await pool.query(
    "SELECT sg_id FROM sg_rs_links WHERE entity_type = $1 AND rs_id = $2 ORDER BY updated_at DESC LIMIT 1",
    [entityType, rsId]
  );
  return res.rows[0] ? Number(res.rows[0].sg_id) : null;
}

// Upsert idempotente do vínculo. Aceita um client de transação (opcional) ou usa o pool.
async function upsertLink(entityType, sgId, rsId, executor = pool) {
  const table = entityTable(entityType);
  const updated = await executor.query(
    `UPDATE ${table}
        SET service_report_id = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
    [sgId, rsId]
  );
  if (updated.rowCount === 0) return false;

  // Remove a ponta antiga antes do insert para que um soft delete seguido de
  // reimportação não deixe duas linhas apontando para o mesmo registro remoto.
  await executor.query(
    `DELETE FROM sg_rs_links
      WHERE entity_type = $1 AND (sg_id = $2 OR rs_id = $3)`,
    [entityType, sgId, rsId]
  );
  await executor.query(
    `INSERT INTO sg_rs_links (entity_type, sg_id, rs_id)
     VALUES ($1, $2, $3)`,
    [entityType, sgId, rsId]
  );
  return true;
}

module.exports = { ENTITY_TYPES, getSgIdByRs, getRsIdBySg, getLegacySgIdByRs, upsertLink };
