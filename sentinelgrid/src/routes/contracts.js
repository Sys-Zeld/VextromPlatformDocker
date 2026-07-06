const express = require("express");
const { parseContractInput } = require("../validators/contractValidators");
const { toValidationError, isForeignKeyError, isUniqueViolation } = require("./httpErrors");
const repo = require("../repositories/contractsRepository");

function createContractsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Contrato não encontrado", errorCode: "SG_CONTRACT_NOT_FOUND" };
  const invalidClient = { error: "Cliente inválido ou inexistente", errorCode: "SG_CONTRACT_FK" };
  const dupNumber = { error: "Número de contrato já existe. Gere um novo número.", errorCode: "SG_CONTRACT_DUP_NUMBER" };

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (isForeignKeyError(err)) return res.status(400).json(invalidClient);
      if (isUniqueViolation(err)) return res.status(409).json(dupNumber);
      throw err;
    }
  };

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 100));
      const { contracts, total } = await repo.listContracts({
        clientId: Number(req.query.clientId) || null,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ contracts, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const contract = await repo.getContract(Number(req.params.id));
      if (!contract) return res.status(404).json(notFound);
      res.json({ contract });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseContractInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const contract = await handleWrite(() => repo.createContract(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ contract });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseContractInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const contract = await handleWrite(() => repo.updateContract(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!contract) return res.status(404).json(notFound);
      res.json({ contract });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteContract(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createContractsRouter };
