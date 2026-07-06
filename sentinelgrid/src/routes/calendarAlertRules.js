const express = require("express");
const { toValidationError } = require("./httpErrors");
const { parseAlertRuleInput, isValidCriticality } = require("../validators/calendarAlertRuleValidators");
const repo = require("../repositories/calendarAlertRulesRepository");

function createCalendarAlertRulesRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const badCriticality = { error: "Criticidade inválida", errorCode: "SG_ALERT_RULE_CRITICALITY" };

  router.get("/", asyncHandler(async (_req, res) => {
    res.json({ rules: await repo.listRules() });
  }));

  router.put("/:criticality", asyncHandler(async (req, res) => {
    const criticality = String(req.params.criticality);
    if (!isValidCriticality(criticality)) return res.status(400).json(badCriticality);
    let input;
    try {
      input = parseAlertRuleInput(req.body);
    } catch (err) {
      return res.status(400).json(toValidationError(err));
    }
    const rule = await repo.upsertRule(criticality, input, actorOf(req));
    res.json({ rule });
  }));

  return router;
}

module.exports = { createCalendarAlertRulesRouter };
