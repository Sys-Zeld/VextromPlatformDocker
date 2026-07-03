const express = require("express");
const { parseSiteInput } = require("../validators/siteValidators");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/sitesRepository");

function createSitesRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const invalidClient = { error: "Cliente inválido ou inexistente", errorCode: "SG_CLIENT_FK" };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
      const clientId = Number(req.query.clientId) || null;
      const { sites, total } = await repo.listSites({
        clientId,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ sites, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const site = await repo.getSite(Number(req.params.id));
      if (!site) return res.status(404).json({ error: "Site não encontrado", errorCode: "SG_SITE_NOT_FOUND" });
      res.json({ site });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseSiteInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      try {
        const site = await repo.createSite(input, actorOf(req));
        res.status(201).json({ site });
      } catch (err) {
        if (isForeignKeyError(err)) return res.status(400).json(invalidClient);
        throw err;
      }
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseSiteInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      try {
        const site = await repo.updateSite(Number(req.params.id), input, actorOf(req));
        if (!site) return res.status(404).json({ error: "Site não encontrado", errorCode: "SG_SITE_NOT_FOUND" });
        res.json({ site });
      } catch (err) {
        if (isForeignKeyError(err)) return res.status(400).json(invalidClient);
        throw err;
      }
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteSite(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json({ error: "Site não encontrado", errorCode: "SG_SITE_NOT_FOUND" });
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createSitesRouter };
