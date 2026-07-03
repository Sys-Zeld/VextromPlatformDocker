const express = require("express");
const { parseAreaInput } = require("../validators/areaValidators");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/areasRepository");

function createAreasRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const invalidSite = { error: "Site inválido ou inexistente", errorCode: "SG_SITE_FK" };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
      const { areas, total } = await repo.listAreas({
        siteId: Number(req.query.siteId) || null,
        clientId: Number(req.query.clientId) || null,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ areas, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const area = await repo.getArea(Number(req.params.id));
      if (!area) return res.status(404).json({ error: "Área não encontrada", errorCode: "SG_AREA_NOT_FOUND" });
      res.json({ area });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseAreaInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      try {
        const area = await repo.createArea(input, actorOf(req));
        res.status(201).json({ area });
      } catch (err) {
        if (isForeignKeyError(err)) return res.status(400).json(invalidSite);
        throw err;
      }
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseAreaInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      try {
        const area = await repo.updateArea(Number(req.params.id), input, actorOf(req));
        if (!area) return res.status(404).json({ error: "Área não encontrada", errorCode: "SG_AREA_NOT_FOUND" });
        res.json({ area });
      } catch (err) {
        if (isForeignKeyError(err)) return res.status(400).json(invalidSite);
        throw err;
      }
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteArea(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json({ error: "Área não encontrada", errorCode: "SG_AREA_NOT_FOUND" });
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createAreasRouter };
