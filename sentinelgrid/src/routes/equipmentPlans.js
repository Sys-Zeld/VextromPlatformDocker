const express = require("express");
const { parseEquipmentPlanInput, parsePlanItemInput } = require("../validators/equipmentPlanValidators");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/equipmentPlansRepository");

function createEquipmentPlansRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Plano de equipamento nao encontrado", errorCode: "SG_PLAN_NOT_FOUND" };
  const itemNotFound = { error: "Item do plano nao encontrado", errorCode: "SG_PLAN_ITEM_NOT_FOUND" };
  const invalidEquipment = { error: "Equipamento invalido ou inexistente", errorCode: "SG_EQUIPMENT_INVALID" };
  const invalidPlan = { error: "Plano de equipamento invalido ou inexistente", errorCode: "SG_PLAN_INVALID" };
  const invalidRef = { error: "Plano contem referencia invalida", errorCode: "SG_PLAN_FK" };

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === "SG_EQUIPMENT_INVALID") return res.status(400).json(invalidEquipment);
      if (err && err.code === "SG_PLAN_INVALID") return res.status(400).json(invalidPlan);
      if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
      throw err;
    }
  };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 100));
      const activeRaw = String(req.query.active || "").trim();
      const active = activeRaw === "" ? null : activeRaw === "true" || activeRaw === "1";
      const { plans, total } = await repo.listPlans({
        equipmentId: Number(req.query.equipmentId) || null,
        clientId: Number(req.query.clientId) || null,
        programId: Number(req.query.programId) || null,
        active,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ plans, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const plan = await repo.getPlan(Number(req.params.id));
      if (!plan) return res.status(404).json(notFound);
      res.json({ plan });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseEquipmentPlanInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const plan = await handleWrite(() => repo.createPlan(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ plan });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseEquipmentPlanInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const plan = await handleWrite(() => repo.updatePlan(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!plan) return res.status(404).json(notFound);
      res.json({ plan });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeletePlan(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  router.post(
    "/:id/items",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parsePlanItemInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const item = await handleWrite(() => repo.createPlanItem(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ item });
    })
  );

  router.put(
    "/:id/items/:itemId",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parsePlanItemInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const item = await repo.updatePlanItem(Number(req.params.id), Number(req.params.itemId), input, actorOf(req));
      if (!item) return res.status(404).json(itemNotFound);
      res.json({ item });
    })
  );

  router.delete(
    "/:id/items/:itemId",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeletePlanItem(Number(req.params.id), Number(req.params.itemId), actorOf(req));
      if (!ok) return res.status(404).json(itemNotFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createEquipmentPlansRouter };
