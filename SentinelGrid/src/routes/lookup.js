const express = require("express");
const { parseLookupInput } = require("../validators/lookupValidators");
const { toValidationError, isUniqueViolation } = require("./httpErrors");

// Router genérico de lookup { name, notes }. `opts`: { repo, itemsKey, notFound, conflict }.
function createLookupRouter(deps, opts) {
  const { repo, itemsKey, notFound, conflict } = opts;
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 100));
      const { items, total } = await repo.list({
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ [itemsKey]: items, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const item = await repo.get(Number(req.params.id));
      if (!item) return res.status(404).json(notFound);
      res.json({ item });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseLookupInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      try {
        const item = await repo.create(input, actorOf(req));
        res.status(201).json({ item });
      } catch (err) {
        if (isUniqueViolation(err)) return res.status(409).json(conflict);
        throw err;
      }
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseLookupInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      try {
        const item = await repo.update(Number(req.params.id), input, actorOf(req));
        if (!item) return res.status(404).json(notFound);
        res.json({ item });
      } catch (err) {
        if (isUniqueViolation(err)) return res.status(409).json(conflict);
        throw err;
      }
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDelete(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createLookupRouter };
