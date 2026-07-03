const express = require("express");
const { parseChecklistInput, parseChecklistItemInput } = require("../validators/checklistValidators");
const { toValidationError, isForeignKeyError, isUniqueViolation } = require("./httpErrors");
const repo = require("../repositories/checklistsRepository");

function createChecklistsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Checklist nao encontrado", errorCode: "SG_CHECKLIST_NOT_FOUND" };
  const itemNotFound = { error: "Item do checklist nao encontrado", errorCode: "SG_CHECKLIST_ITEM_NOT_FOUND" };
  const invalidChecklist = { error: "Checklist invalido ou inexistente", errorCode: "SG_CHECKLIST_INVALID" };
  const invalidRef = { error: "Checklist contem referencia invalida", errorCode: "SG_CHECKLIST_FK" };
  const duplicate = { error: "Ja existe um checklist com esse nome", errorCode: "SG_CHECKLIST_DUP" };

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === "SG_CHECKLIST_INVALID") return res.status(400).json(invalidChecklist);
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
      const { checklists, total } = await repo.listChecklists({
        equipmentTypeId: Number(req.query.equipmentTypeId) || null,
        manufacturerId: Number(req.query.manufacturerId) || null,
        modelId: Number(req.query.modelId) || null,
        programId: Number(req.query.programId) || null,
        maintenanceType: String(req.query.maintenanceType || "").trim(),
        active,
        search: String(req.query.search || "").trim(),
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      res.json({ checklists, total, page, pageSize });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const checklist = await repo.getChecklist(Number(req.params.id));
      if (!checklist) return res.status(404).json(notFound);
      res.json({ checklist });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseChecklistInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const checklist = await handleWrite(() => repo.createChecklist(input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ checklist });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseChecklistInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const checklist = await handleWrite(() => repo.updateChecklist(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      if (!checklist) return res.status(404).json(notFound);
      res.json({ checklist });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteChecklist(Number(req.params.id), actorOf(req));
      if (!ok) return res.status(404).json(notFound);
      res.status(204).end();
    })
  );

  router.post(
    "/:id/items",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseChecklistItemInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const item = await handleWrite(() => repo.createChecklistItem(Number(req.params.id), input, actorOf(req)), res);
      if (res.headersSent) return;
      res.status(201).json({ item });
    })
  );

  router.put(
    "/:id/items/:itemId",
    asyncHandler(async (req, res) => {
      let input;
      try {
        input = parseChecklistItemInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const item = await repo.updateChecklistItem(Number(req.params.id), Number(req.params.itemId), input, actorOf(req));
      if (!item) return res.status(404).json(itemNotFound);
      res.json({ item });
    })
  );

  router.delete(
    "/:id/items/:itemId",
    asyncHandler(async (req, res) => {
      const ok = await repo.softDeleteChecklistItem(Number(req.params.id), Number(req.params.itemId), actorOf(req));
      if (!ok) return res.status(404).json(itemNotFound);
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createChecklistsRouter };
