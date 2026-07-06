const pool = require("../db");

// Ordem de exibição por severidade da criticidade.
const ORDER = "CASE criticality WHEN 'missao_critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baixa' THEN 3 ELSE 4 END";

async function listRules() {
  return (await pool.query(`SELECT * FROM sg_calendar_alert_rules ORDER BY ${ORDER}`)).rows;
}

async function getRule(criticality) {
  return (await pool.query("SELECT * FROM sg_calendar_alert_rules WHERE criticality = $1", [criticality])).rows[0] || null;
}

// Upsert: a migration já semeia as 4 criticidades, mas o upsert protege contra
// linhas ausentes e permite editar por PUT idempotente.
async function upsertRule(criticality, input, actor = "") {
  return (
    await pool.query(
      `INSERT INTO sg_calendar_alert_rules (criticality, first_alert_days, critical_alert_days, critical_after_due, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (criticality) DO UPDATE
         SET first_alert_days = EXCLUDED.first_alert_days,
             critical_alert_days = EXCLUDED.critical_alert_days,
             critical_after_due = EXCLUDED.critical_after_due,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
       RETURNING *`,
      [criticality, input.firstAlertDays, input.criticalAlertDays, input.criticalAfterDue, actor]
    )
  ).rows[0];
}

module.exports = { listRules, getRule, upsertRule };
