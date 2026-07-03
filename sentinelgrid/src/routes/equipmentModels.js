const express = require("express");
const { parseEquipmentModelInput } = require("../validators/equipmentModelValidators");
const { toValidationError, isForeignKeyError, isUniqueViolation } = require("./httpErrors");
const repo = require("../repositories/equipmentModelsRepository");

function createEquipmentModelsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Modelo não encontrado", errorCode: "SG_MODEL_NOT_FOUND" };
  const invalidRef = { error: "Fabricante ou tipo inválido", errorCode: "SG_MODEL_FK" };
  const conflict = { error: "Já existe um modelo com esse nome para o fabricante", errorCode: "SG_MODEL_DUP" };

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
      if (isUniqueViolation(err)) return res.status(409).json(conflict);
      throw err;
    }
  };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 100));
      const { models, total } = await repo.listModels({
        manufacturerId: Number(req.query.manufacturerId) || null,
        equipmentTypeId: Number(req.query.equipmentTypeId) || null,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ models, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const model = await repo.getModel(Number(req.params.id));
      if (!model) return res.status(404).json(notFound);
      res.json({ model });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseEquipmentModelInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const model = await handleWrite(() => repo.createModel(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ model });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseEquipmentModelInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const model = await handleWrite(() => repo.updateModel(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!model) return res.status(404).json(notFound);
      res.json({ model });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteModel(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createEquipmentModelsRouter };
