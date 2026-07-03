const express = require("express");
const { parseClientInput } = require("../validators/clientValidators");
const { toValidationError } = require("./httpErrors");
const repo = require("../repositories/clientsRepository");

function createClientsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
      const { clients, total } = await repo.listClients({
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ clients, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const client = await repo.getClient(Number(req.params.id));
      if (!client) return res.status(404).json({ error: "Cliente não encontrado", errorCode: "SG_CLIENT_NOT_FOUND" });
      res.json({ client });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseClientInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const client = await repo.createClient(input, actorOf(req));
      res.status(201).json({ client });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseClientInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const client = await repo.updateClient(Number(req.params.id), input, actorOf(req));
      if (!client) return res.status(404).json({ error: "Cliente não encontrado", errorCode: "SG_CLIENT_NOT_FOUND" });
      res.json({ client });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteClient(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json({ error: "Cliente não encontrado", errorCode: "SG_CLIENT_NOT_FOUND" });
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createClientsRouter };
