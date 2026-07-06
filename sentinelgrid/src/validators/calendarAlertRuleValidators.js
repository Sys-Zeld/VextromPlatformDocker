const { z } = require("zod");
const { CRITICALITY } = require("../constants");

// Fase 10 · 10.2 — Regra de vencimento por criticidade (§8/A.9).
const alertRuleInputSchema = z.object({
  firstAlertDays: z.coerce.number().int().min(0).max(3650),
  criticalAlertDays: z.coerce.number().int().min(0).max(3650),
  criticalAfterDue: z.boolean().optional().default(false)
});

function parseAlertRuleInput(body) {
  return alertRuleInputSchema.parse(body ?? {});
}

function isValidCriticality(value) {
  return CRITICALITY.includes(String(value));
}

module.exports = { alertRuleInputSchema, parseAlertRuleInput, isValidCriticality };
