const express = require("express");
const { parseMaintenanceProgramInput } = require("../validators/maintenanceProgramValidators");
const { toValidationError, isForeignKeyError, isUniqueViolation } = require("./httpErrors");
const repo = require("../repositories/maintenanceProgramsRepository");

function createMaintenanceProgramsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Programa de manutencao nao encontrado", errorCode: "SG_PROGRAM_NOT_FOUND" };
  const invalidRef = { error: "Escopo do programa contem referencia invalida", errorCode: "SG_PROGRAM_FK" };
  const duplicate = { error: "Ja existe um programa com esse nome", errorCode: "SG_PROGRAM_DUP" };

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
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
      const activeRaw = String(req.query.active || "").trim();
      const active = activeRaw === "" ? null : activeRaw === "true" || activeRaw === "1";
      const { programs, total } = await repo.listPrograms({
        equipmentTypeId: Number(req.query.equipmentTypeId) || null,
        manufacturerId: Number(req.query.manufacturerId) || null,
        modelId: Number(req.query.modelId) || null,
        contractId: Number(req.query.contractId) || null,
        criticality: String(req.query.criticality || "").trim(),
        maintenanceType: String(req.query.maintenanceType || "").trim(),
        periodicity: String(req.query.periodicity || "").trim(),
        active,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ programs, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const program = await repo.getProgram(Number(req.params.id));
      if (!program) return res.status(404).json(notFound);
      res.json({ program });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseMaintenanceProgramInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const program = await handleWrite(() => repo.createProgram(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ program });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseMaintenanceProgramInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const program = await handleWrite(() => repo.updateProgram(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!program) return res.status(404).json(notFound);
      res.json({ program });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteProgram(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createMaintenanceProgramsRouter };
