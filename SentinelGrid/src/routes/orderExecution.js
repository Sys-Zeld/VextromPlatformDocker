const express = require("express");
const { parseChecklistResultInput } = require("../validators/orderExecutionValidators");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/orderExecutionRepository");

function createOrderExecutionRouter(deps) {
  const router = express.Router({ mergeParams: true });
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const invalidOrder = { error: "Ordem de manutencao invalida ou inexistente", errorCode: "SG_ORDER_INVALID" };
  const invalidChecklist = { error: "Ordem sem checklist vinculado ou item invalido", errorCode: "SG_ORDER_CHECKLIST_INVALID" };
  const invalidRef = { error: "Resultado contem referencia invalida", errorCode: "SG_EXECUTION_FK" };

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === "SG_ORDER_INVALID") return res.status(404).json(invalidOrder);
      if (err && err.code === "SG_ORDER_CHECKLIST_INVALID") return res.status(400).json(invalidChecklist);
      if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
      throw err;
    }
  };

  router.get(
    "/checklist-results",
    asyncHandler(async (req, res) => {
      const execution = await handleWrite(() => repo.getOrderChecklistExecution(Number(req.params.orderId)), res);
      if (res.headersSent) return;
      res.json(execution);
    })
  );

  router.post(
    "/checklist-results",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseChecklistResultInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const result = await handleWrite(() => repo.upsertChecklistResult(Number(req.params.orderId), input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ result });
    })
  );

  return router;
}

module.exports = { createOrderExecutionRouter };
