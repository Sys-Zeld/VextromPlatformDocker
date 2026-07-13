const express = require("express");
const { parseChecklistInput, parseChecklistItemInput } = require("../validators/checklistValidators");
const { toValidationError, isForeignKeyError, isUniqueViolation } = require("./httpErrors");
const repo = require("../repositories/checklistsRepository");
const { extractChecklistFromPdf } = require("../services/checklistAi");

const AI_PDF_MAX_BYTES = 10 * 1024 * 1024;
const AI_MAX_ITEMS = 500;

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

  router.post(
    "/ai/import-pdf",
    asyncHandler(async (req, res) => {
      const fileName = String(req.body && req.body.fileName || "checklist.pdf").trim().slice(0, 240);
      const mimeType = String(req.body && req.body.mimeType || "").trim().toLowerCase();
      const rawBase64 = String(req.body && req.body.fileBase64 || "").trim().replace(/^data:application\/pdf;base64,/i, "");
      if (mimeType !== "application/pdf" || !fileName.toLowerCase().endsWith(".pdf") || !rawBase64) {
        return res.status(422).json({ error: "Selecione um arquivo PDF valido.", errorCode: "SG_CHECKLIST_AI_PDF_INVALID" });
      }
      if (rawBase64.length > Math.ceil(AI_PDF_MAX_BYTES * 4 / 3) + 16) {
        return res.status(413).json({ error: "O PDF deve ter no maximo 10 MB.", errorCode: "SG_CHECKLIST_AI_PDF_TOO_LARGE" });
      }
      let fileBuffer;
      try { fileBuffer = Buffer.from(rawBase64, "base64"); } catch (_err) { fileBuffer = Buffer.alloc(0); }
      if (!fileBuffer.length || fileBuffer.length > AI_PDF_MAX_BYTES || fileBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        return res.status(422).json({ error: "O conteudo enviado nao e um PDF valido.", errorCode: "SG_CHECKLIST_AI_PDF_INVALID" });
      }
      try {
        const draft = await extractChecklistFromPdf({
          fileBuffer,
          fileName,
          userInstructions: String(req.body && req.body.instructions || "").trim().slice(0, 4000)
        });
        if (draft.items.length > AI_MAX_ITEMS) {
          return res.status(422).json({
            error: `O documento gerou mais de ${AI_MAX_ITEMS} campos. Divida o PDF em partes menores.`,
            errorCode: "SG_CHECKLIST_ITEMS_LIMIT"
          });
        }
        return res.json({ draft });
      } catch (err) {
        const status = [422, 429, 500, 502, 503, 504].includes(Number(err && err.statusCode)) ? Number(err.statusCode) : 502;
        return res.status(status).json({
          error: err && err.message ? err.message : "Nao foi possivel analisar o PDF com IA.",
          errorCode: "SG_CHECKLIST_AI_FAILED"
        });
      }
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
      let items = [];
      try {
        input = parseChecklistInput(req.body);
        const rawItems = Array.isArray(req.body && req.body.items) ? req.body.items : [];
        if (rawItems.length > AI_MAX_ITEMS) {
          return res.status(422).json({ error: `O checklist pode ter no maximo ${AI_MAX_ITEMS} itens.`, errorCode: "SG_CHECKLIST_ITEMS_LIMIT" });
        }
        items = rawItems.map(parseChecklistItemInput);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      const checklist = await handleWrite(
        () => items.length
          ? repo.createChecklistWithItems(input, items, actorOf(req))
          : repo.createChecklist(input, actorOf(req)),
        res
      );
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
