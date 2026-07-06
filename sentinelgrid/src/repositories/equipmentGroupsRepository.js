const pool = require("../db");

const BASE_FROM = `FROM sg_equipment_groups g
  JOIN sg_sites s ON s.id = g.site_id
  JOIN sg_clients c ON c.id = s.client_id`;

const SELECT_COLS = `g.*, s.name AS site_name, c.id AS client_id, c.name AS client_name,
  (SELECT COUNT(*)::int FROM sg_equipment_group_members m
     JOIN sg_equipment e ON e.id = m.equipment_id AND e.deleted_at IS NULL
    WHERE m.group_id = g.id) AS member_count`;

function siteInvalidError() {
  const err = new Error("Site inválido ou inexistente");
  err.code = "SG_GROUP_SITE_INVALID";
  return err;
}

async function listGroups({ siteId = null, clientId = null, search = "", limit = 200, offset = 0 } = {}) {
  const params = [];
  let where = "g.deleted_at IS NULL";
  const add = (cond, val) => { params.push(val); where += ` AND ${cond.replace("$?", `$${params.length}`)}`; };
  if (siteId) add("g.site_id = $?", siteId);
  if (clientId) add("s.client_id = $?", clientId);
  if (search) { params.push(`%${String(search).toLowerCase()}%`); where += ` AND LOWER(g.name) LIKE $${params.length}`; }

  const total = (await pool.query(`SELECT COUNT(*)::int AS c ${BASE_FROM} WHERE ${where}`, params)).rows[0].c;
  params.push(limit); const limIdx = params.length;
  params.push(offset); const offIdx = params.length;
  const groups = (await pool.query(
    `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE ${where}
      ORDER BY c.name ASC, s.name ASC, g.name ASC LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  )).rows;
  return { groups, total };
}

async function listGroupMembers(groupId) {
  return (await pool.query(
    `SELECT e.id, e.tag, e.serial_number, e.criticality, a.name AS area_name, e.equipment_type_id, t.name AS equipment_type_name
       FROM sg_equipment_group_members m
       JOIN sg_equipment e ON e.id = m.equipment_id AND e.deleted_at IS NULL
       LEFT JOIN sg_areas a ON a.id = e.area_id
       LEFT JOIN sg_equipment_types t ON t.id = e.equipment_type_id
      WHERE m.group_id = $1
      ORDER BY e.tag ASC, e.id ASC`,
    [groupId]
  )).rows;
}

async function getGroup(id) {
  const group = (await pool.query(`SELECT ${SELECT_COLS} ${BASE_FROM} WHERE g.id = $1 AND g.deleted_at IS NULL`, [id])).rows[0] || null;
  if (!group) return null;
  const members = await listGroupMembers(id);
  return { ...group, members };
}

async function createGroup(input, actor = "") {
  return (await pool.query(
    `INSERT INTO sg_equipment_groups (site_id, name, description, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
    [input.siteId, input.name, input.description, input.notes, actor]
  )).rows[0];
}

async function updateGroup(id, input, actor = "") {
  return (await pool.query(
    `UPDATE sg_equipment_groups
        SET site_id = $2, name = $3, description = $4, notes = $5, updated_by = $6, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id, input.siteId, input.name, input.description, input.notes, actor]
  )).rows[0] || null;
}

async function softDeleteGroup(id, actor = "") {
  const res = await pool.query(
    `UPDATE sg_equipment_groups SET deleted_at = NOW(), updated_by = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id, actor]
  );
  return res.rowCount > 0;
}

// Adiciona membros; só entram equipamentos do mesmo site do grupo (retorna descartados).
async function addMembers(groupId, equipmentIds) {
  const group = (await pool.query("SELECT id, site_id FROM sg_equipment_groups WHERE id = $1 AND deleted_at IS NULL", [groupId])).rows[0];
  if (!group) return null;
  const eligible = (await pool.query(
    `SELECT id FROM sg_equipment WHERE id = ANY($1::bigint[]) AND site_id = $2 AND deleted_at IS NULL`,
    [equipmentIds, group.site_id]
  )).rows.map((r) => Number(r.id));
  let added = 0;
  for (const equipmentId of eligible) {
    const res = await pool.query(
      `INSERT INTO sg_equipment_group_members (group_id, equipment_id) VALUES ($1, $2)
       ON CONFLICT (group_id, equipment_id) DO NOTHING RETURNING equipment_id`,
      [groupId, equipmentId]
    );
    added += res.rowCount;
  }
  const skippedWrongSite = equipmentIds.filter((id) => !eligible.includes(Number(id))).length;
  return { added, skippedWrongSite, eligible: eligible.length };
}

async function removeMember(groupId, equipmentId) {
  const res = await pool.query(
    `DELETE FROM sg_equipment_group_members WHERE group_id = $1 AND equipment_id = $2 RETURNING equipment_id`,
    [groupId, equipmentId]
  );
  return res.rowCount > 0;
}

module.exports = {
  listGroups, getGroup, listGroupMembers, createGroup, updateGroup, softDeleteGroup,
  addMembers, removeMember, siteInvalidError
};
