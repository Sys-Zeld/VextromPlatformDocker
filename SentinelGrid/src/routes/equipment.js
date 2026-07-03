const express = require("express");
const { parseEquipmentInput } = require("../validators/equipmentValidators");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/equipmentRepository");

function createEquipmentRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Equipamento não encontrado", errorCode: "SG_EQUIPMENT_NOT_FOUND" };
  const invalidArea = { error: "Área inválida ou inexistente", errorCode: "SG_AREA_INVALID" };
  const invalidRef = { error: "Tipo, fabricante ou modelo inválido", errorCode: "SG_EQUIPMENT_FK" };

  // Executa a escrita tratando os erros de negócio/FK como 400.
  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === "SG_AREA_INVALID") return res.status(400).json(invalidArea);
      if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
      throw err;
    }
  };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
      const { equipment, total } = await repo.listEquipment({
        clientId: Number(req.query.clientId) || null,
        siteId: Number(req.query.siteId) || null,
        areaId: Number(req.query.areaId) || null,
        criticality: String(req.query.criticality || "").trim(),
        operationalStatus: String(req.query.operationalStatus || "").trim(),
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ equipment, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const equipment = await repo.getEquipment(Number(req.params.id));
      if (!equipment) return res.status(404).json(notFound);
      res.json({ equipment });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseEquipmentInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const equipment = await handleWrite(() => repo.createEquipment(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ equipment });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseEquipmentInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const equipment = await handleWrite(() => repo.updateEquipment(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!equipment) return res.status(404).json(notFound);
      res.json({ equipment });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteEquipment(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createEquipmentRouter };
