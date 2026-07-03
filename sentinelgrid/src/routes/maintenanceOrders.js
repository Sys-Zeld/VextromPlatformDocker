const express = require("express");
const {
  parseMaintenanceOrderInput,
  parseOrderFromPlanInput,
  parseOrderApprovalInput,
  parseOrderStatusInput
} = require("../validators/maintenanceOrderValidators");
const { toValidationError, isForeignKeyError, isUniqueViolation } = require("./httpErrors");
const repo = require("../repositories/maintenanceOrdersRepository");
const { createOrderExecutionRouter } = require("./orderExecution");

function createMaintenanceOrdersRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Ordem de manutencao nao encontrada", errorCode: "SG_ORDER_NOT_FOUND" };
  const invalidEquipment = { error: "Equipamento invalido ou inexistente", errorCode: "SG_EQUIPMENT_INVALID" };
  const invalidOrder = { error: "Ordem de manutencao invalida ou inexistente", errorCode: "SG_ORDER_INVALID" };
  const invalidPlan = { error: "Plano ou item de plano invalido", errorCode: "SG_PLAN_INVALID" };
  const invalidRef = { error: "Ordem contem referencia invalida", errorCode: "SG_ORDER_FK" };
  const duplicate = { error: "Ja existe uma ordem com esse numero", errorCode: "SG_ORDER_DUP" };
  const invalidTransition = { error: "Transicao de status invalida", errorCode: "SG_ORDER_TRANSITION_INVALID" };
  const invalidCompletion = { error: "Conclusao invalida", errorCode: "SG_ORDER_COMPLETION_INVALID" };
  const approvalNotRequired = { error: "Aprovacao nao exigida para esta ordem", errorCode: "SG_ORDER_APPROVAL_NOT_REQUIRED" };

  router.use("/:orderId", createOrderExecutionRouter(deps));

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === "SG_EQUIPMENT_INVALID") return res.status(400).json(invalidEquipment);
      if (err && err.code === "SG_ORDER_INVALID") return res.status(404).json(invalidOrder);
      if (err && err.code === "SG_PLAN_INVALID") return res.status(400).json(invalidPlan);
      if (err && err.code === "SG_ORDER_TRANSITION_INVALID") return res.status(409).json({ ...invalidTransition, detail: err.message });
      if (err && err.code === "SG_ORDER_COMPLETION_INVALID") return res.status(409).json({ ...invalidCompletion, detail: err.message });
      if (err && err.code === "SG_ORDER_APPROVAL_NOT_REQUIRED") return res.status(400).json(approvalNotRequired);
      if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
      if (isUniqueViolation(err)) return res.status(409).json(duplicate);
      throw err;
    }
  };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 100));
      const { orders, total } = await repo.listOrders({
        equipmentId: Number(req.query.equipmentId) || null,
        clientId: Number(req.query.clientId) || null,
        status: String(req.query.status || "").trim(),
        maintenanceType: String(req.query.maintenanceType || "").trim(),
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ orders, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const order = await repo.getOrder(Number(req.params.id));
      if (!order) return res.status(404).json(notFound);
      res.json({ order });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseMaintenanceOrderInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const order = await handleWrite(() => repo.createOrder(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ order });
    })
  );

  router.post(
    "/from-plan",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseOrderFromPlanInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const order = await handleWrite(() => repo.createOrderFromPlan(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ order });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseMaintenanceOrderInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const order = await handleWrite(() => repo.updateOrder(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!order) return res.status(404).json(notFound);
      res.json({ order });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteOrder(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  router.post(
    "/:id/status",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseOrderStatusInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const order = await handleWrite(() => repo.transitionOrderStatus(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!order) return res.status(404).json(notFound);
      res.json({ order });
    })
  );

  router.post(
    "/:id/approvals",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseOrderApprovalInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const result = await handleWrite(() => repo.createApproval(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json(result);
    })
  );

  return router;
}

module.exports = { createMaintenanceOrdersRouter };
