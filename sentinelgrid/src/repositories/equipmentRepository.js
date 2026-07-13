const pool = require("../db");

const BASE_FROM = `FROM sg_equipment e
  JOIN sg_clients c ON c.id = e.client_id
  JOIN sg_sites s ON s.id = e.site_id
  JOIN sg_areas a ON a.id = e.area_id
  LEFT JOIN sg_equipment_types t ON t.id = e.equipment_type_id
  LEFT JOIN sg_manufacturers m ON m.id = e.manufacturer_id
  LEFT JOIN sg_equipment_models mo ON mo.id = e.model_id`;

const SELECT_COLS = `e.*, c.name AS client_name, s.name AS site_name, a.name AS area_name,
  t.name AS equipment_type_name, m.name AS manufacturer_name, mo.name AS model_name`;

// Erro de negócio: área inexistente/removida (a hierarquia deriva dela).
function areaInvalidError() {
  const err = new Error("Área inválida ou inexistente");
  err.code = "SG_AREA_INVALID";
  return err;
}

function duplicateTagError(message) {
  const err = new Error(message);
  err.code = "SG_EQUIPMENT_DUPLICATE";
  return err;
}

async function resolveAreaScope(areaId) {
  const res = await pool.query(
    `SELECT a.id, a.site_id, s.client_id
       FROM sg_areas a JOIN sg_sites s ON s.id = a.site_id
      WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [areaId]
  );
  return res.rows[0] || null;
}

async function findDuplicateTag({ tag, siteId, excludeId = null }) {
  const cleanTag = String(tag || "").trim();
  if (!cleanTag) return null;
  const params = [siteId, cleanTag.toLowerCase()];
  let where = "site_id = $1 AND LOWER(TRIM(tag)) = $2 AND deleted_at IS NULL";
  if (excludeId) {
    params.push(excludeId);
    where += ` AND id <> $${params.length}`;
  }
  const res = await pool.query(
    `SELECT id, area_id FROM sg_equipment WHERE ${where} LIMIT 1`,
    params
  );
  return res.rows[0] || null;
}

async function ensureUniqueTagInScope(input, scope, excludeId = null) {
  const duplicate = await findDuplicateTag({ tag: input.tag, siteId: scope.site_id, excludeId });
  if (!duplicate) return;
  const sameArea = Number(duplicate.area_id) === Number(scope.id);
  throw duplicateTagError(sameArea ? "TAG ja cadastrada nesta area." : "TAG ja cadastrada neste site.");
}

async function listEquipment({ clientId = null, siteId = null, areaId = null, criticality = "", operationalStatus = "", search = "", limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = "e.deleted_at IS NULL";
  const add = (cond, val) => { params.push(val); where += ` AND ${cond.replace("$?", `$${params.length}`)}`; };
  if (clientId) add("e.client_id = $?", clientId);
  if (siteId) add("e.site_id = $?", siteId);
  if (areaId) add("e.area_id = $?", areaId);
  if (criticality) add("e.criticality = $?", criticality);
  if (operationalStatus) add("e.operational_status = $?", operationalStatus);
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where += ` AND (LOWER(e.tag) LIKE $${params.length} OR LOWER(e.serial_number) LIKE $${params.length})`;
  }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;
  const equipment = (
    await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE ${where} ORDER BY e.tag ASC, e.id DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
      params
    )
  ).rows;

  return { equipment, total };
}

async function getEquipment(id) {
  const res = await pool.query(`SELECT ${SELECT_COLS} ${BASE_FROM} WHERE e.id = $1 AND e.deleted_at IS NULL`, [id]);
  return res.rows[0] || null;
}

// Equipamentos que casam com o escopo de um programa de manutenção (Fatia "Gerar Planos").
// Cada campo de escopo não nulo do programa restringe o conjunto; contrato restringe pelo cliente.
async function listByProgramScope(program) {
  const params = [];
  let where = "e.deleted_at IS NULL";
  const add = (cond, val) => { params.push(val); where += ` AND ${cond.replace("$?", `$${params.length}`)}`; };
  if (program.equipment_type_id) add("e.equipment_type_id = $?", program.equipment_type_id);
  if (program.manufacturer_id) add("e.manufacturer_id = $?", program.manufacturer_id);
  if (program.model_id) add("e.model_id = $?", program.model_id);
  if (program.criticality) add("e.criticality = $?", program.criticality);
  if (!program.contract_id || !program.contract_client_id) return [];
  add("e.client_id = $?", program.contract_client_id);
  return (
    await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE ${where} ORDER BY c.name ASC, e.tag ASC`,
      params
    )
  ).rows;
}

const WRITE_COLS = [
  "tag", "equipment_type_id", "manufacturer_id", "model_id", "serial_number",
  "rated_power", "input_voltage", "output_voltage", "dc_voltage", "frequency",
  "redundancy_config", "module_count", "battery_type", "install_date", "commission_date",
  "criticality", "operational_status", "internal_technician", "notes"
];

function writeValues(input) {
  return [
    input.tag, input.equipmentTypeId, input.manufacturerId, input.modelId, input.serialNumber,
    input.ratedPower, input.inputVoltage, input.outputVoltage, input.dcVoltage, input.frequency,
    input.redundancyConfig, input.moduleCount, input.batteryType, input.installDate, input.commissionDate,
    input.criticality, input.operationalStatus, input.internalTechnician, input.notes
  ];
}

async function createEquipment(input, actor = "") {
  const scope = await resolveAreaScope(input.areaId);
  if (!scope) throw areaInvalidError();
  await ensureUniqueTagInScope(input, scope);

  const cols = ["client_id", "site_id", "area_id", ...WRITE_COLS, "created_by", "updated_by"];
  const values = [scope.client_id, scope.site_id, input.areaId, ...writeValues(input), actor, actor];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const res = await pool.query(`INSERT INTO sg_equipment (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`, values);
  return getEquipment(res.rows[0].id);
}

async function updateEquipment(id, input, actor = "") {
  const scope = await resolveAreaScope(input.areaId);
  if (!scope) throw areaInvalidError();
  await ensureUniqueTagInScope(input, scope, id);

  const setCols = ["client_id", "site_id", "area_id", ...WRITE_COLS, "updated_by"];
  const values = [id, scope.client_id, scope.site_id, input.areaId, ...writeValues(input), actor];
  const setClause = setCols.map((col, i) => `${col} = $${i + 2}`).join(", ");
  const res = await pool.query(
    `UPDATE sg_equipment SET ${setClause}, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    values
  );
  return res.rows[0] ? getEquipment(id) : null;
}

async function softDeleteEquipment(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_equipment SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

module.exports = { listEquipment, getEquipment, listByProgramScope, createEquipment, updateEquipment, softDeleteEquipment };
