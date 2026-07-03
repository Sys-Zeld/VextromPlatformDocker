const express = require("express");
const { parseClientManagerInput } = require("../validators/clientManagerValidators");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/clientManagersRepository");

function createClientManagersRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Gestor não encontrado", errorCode: "SG_MANAGER_NOT_FOUND" };
  const invalidRef = { error: "Cliente ou site inválido", errorCode: "SG_MANAGER_FK" };

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
      throw err;
    }
  };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 100));
      const { managers, total } = await repo.listManagers({
        clientId: Number(req.query.clientId) || null,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ managers, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const manager = await repo.getManager(Number(req.params.id));
      if (!manager) return res.status(404).json(notFound);
      res.json({ manager });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseClientManagerInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const manager = await handleWrite(() => repo.createManager(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ manager });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseClientManagerInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const manager = await handleWrite(() => repo.updateManager(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!manager) return res.status(404).json(notFound);
      res.json({ manager });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteManager(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createClientManagersRouter };
