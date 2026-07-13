const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { parseMaintenanceProgramInput, parseGeneratePlansInput } = require("../validators/maintenanceProgramValidators");
const { toValidationError, isForeignKeyError, isUniqueViolation } = require("./httpErrors");
const repo = require("../repositories/maintenanceProgramsRepository");
const equipmentRepo = require("../repositories/equipmentRepository");
const plansRepo = require("../repositories/equipmentPlansRepository");

function createMaintenanceProgramsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Programa de manutencao nao encontrado", errorCode: "SG_PROGRAM_NOT_FOUND" };
  const invalidRef = { error: "Escopo do programa contem referencia invalida", errorCode: "SG_PROGRAM_FK" };
  const duplicate = { error: "Ja existe um programa com esse nome", errorCode: "SG_PROGRAM_DUP" };
  const contractRequired = { error: "Selecione um contrato para definir o cliente do programa", errorCode: "SG_PROGRAM_CONTRACT_REQUIRED" };
  const documentsDir = path.join(process.cwd(), "dados", "sentinelgrid", "program-documents");

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === "SG_CHECKLIST_INVALID") return res.status(400).json({ error: "Checklist invalido ou inexistente", errorCode: err.code });
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

  router.put(
    "/:id/assets",
    asyncHandler(async (req, res) => {
      const checklistIds = Array.isArray(req.body?.checklistIds)
        ? req.body.checklistIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        : [];
      if (checklistIds.length !== (req.body?.checklistIds?.length || 0)) {
        return res.status(400).json({ error: "Lista de checklists invalida", errorCode: "SG_CHECKLIST_INVALID" });
      }
      try {
        const program = await repo.setProgramChecklists(Number(req.params.id), checklistIds, actorOf(req));
        if (!program) return res.status(404).json(notFound);
        res.json({ program });
      } catch (err) {
        if (err && err.code === "SG_CHECKLIST_INVALID") return res.status(400).json({ error: "Um checklist selecionado ja pertence a outro programa ou nao existe", errorCode: err.code });
        throw err;
      }
    })
  );

  const documentConfig = {
    manual: { mime: ["application/pdf"], ext: [".pdf"], max: 25 * 1024 * 1024 },
    nameplate: { mime: ["image/jpeg", "image/png", "image/webp"], ext: [".jpg", ".jpeg", ".png", ".webp"], max: 10 * 1024 * 1024 }
  };

  const uploadDocument = (kind) => [
    express.raw({ type: () => true, limit: kind === "manual" ? "25mb" : "10mb" }),
    asyncHandler(async (req, res) => {
      const program = await repo.getProgram(Number(req.params.id));
      if (!program) return res.status(404).json(notFound);
      const config = documentConfig[kind];
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const mimeType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
      const originalName = path.basename(decodeURIComponent(String(req.headers["x-file-name"] || "arquivo"))).replace(/[^a-zA-Z0-9._\- ]/g, "").slice(0, 180);
      const ext = path.extname(originalName).toLowerCase();
      const validSignature = kind === "manual"
        ? buffer.subarray(0, 5).toString("ascii") === "%PDF-"
        : (buffer[0] === 0xff && buffer[1] === 0xd8) || buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) || buffer.subarray(8, 12).toString("ascii") === "WEBP";
      if (!buffer.length || buffer.length > config.max || !config.mime.includes(mimeType) || !config.ext.includes(ext) || !validSignature) {
        return res.status(400).json({ error: kind === "manual" ? "Envie um PDF valido de ate 25 MB" : "Envie uma imagem JPG, PNG ou WebP valida de ate 10 MB", errorCode: "SG_PROGRAM_DOCUMENT_INVALID" });
      }
      await fsp.mkdir(documentsDir, { recursive: true });
      const storedName = `${kind}-${program.id}-${crypto.randomUUID()}${ext}`;
      await fsp.writeFile(path.join(documentsDir, storedName), buffer, { flag: "wx" });
      const previousName = program[`${kind === "manual" ? "manual" : "nameplate"}_stored_name`];
      try {
        const updated = await repo.updateProgramDocument(program.id, kind, { storedName, originalName, mimeType, fileSize: buffer.length }, actorOf(req));
        if (previousName) await fsp.unlink(path.join(documentsDir, path.basename(previousName))).catch(() => {});
        res.status(201).json({ program: updated });
      } catch (err) {
        await fsp.unlink(path.join(documentsDir, storedName)).catch(() => {});
        throw err;
      }
    })
  ];

  router.put("/:id/manual", ...uploadDocument("manual"));
  router.put("/:id/nameplate", ...uploadDocument("nameplate"));

  router.get("/:id/documents/:kind", asyncHandler(async (req, res) => {
    const kind = req.params.kind === "manual" ? "manual" : req.params.kind === "nameplate" ? "nameplate" : null;
    if (!kind) return res.status(404).json({ error: "Documento nao encontrado" });
    const program = await repo.getProgram(Number(req.params.id));
    if (!program) return res.status(404).json(notFound);
    const storedName = program[`${kind}_stored_name`];
    if (!storedName) return res.status(404).json({ error: "Documento nao encontrado" });
    const filePath = path.join(documentsDir, path.basename(storedName));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo nao encontrado" });
    res.setHeader("Content-Type", program[`${kind}_mime_type`] || "application/octet-stream");
    res.setHeader("Content-Disposition", `${kind === "manual" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(program[`${kind}_original_name`] || storedName)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    fs.createReadStream(filePath).pipe(res);
  }));

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const program = await repo.getProgram(Number(req.params.id));
      const result = await repo.softDeleteProgram(Number(req.params.id), actorOf(req));
      if (result.notFound) return res.status(404).json(notFound);
      if (result.blocked) {
        return res.status(409).json({
          error: `Programa usado por equipamentos de ${result.clientCount} clientes (${result.clientNames.join(", ")}). ` +
            "Exclua os planos por cliente antes de remover o programa.",
          errorCode: "SG_PROGRAM_CROSS_CLIENT",
          clientCount: result.clientCount,
          clientNames: result.clientNames
        });
      }
      for (const storedName of [program?.manual_stored_name, program?.nameplate_stored_name].filter(Boolean)) {
        await fsp.unlink(path.join(documentsDir, path.basename(storedName))).catch(() => {});
      }
      res.status(204).end();
    })
  );

  // Equipamentos que casam com o escopo do programa (para a tela "Gerar Planos").
  router.get(
    "/:id/scope-equipment",
    asyncHandler(async (req, res) => {
      const program = await repo.getProgram(Number(req.params.id));
      if (!program) return res.status(404).json(notFound);
      if (!program.contract_id || !program.contract_client_id) return res.status(409).json(contractRequired);
      const equipment = await equipmentRepo.listByProgramScope(program);
      res.json({ equipment, total: equipment.length });
    })
  );

  // Gera um plano por equipamento selecionado, com um item por ocorrência (datas).
  router.post(
    "/:id/generate-plans",
    asyncHandler(async (req, res) => {
      const program = await repo.getProgram(Number(req.params.id));
      if (!program) return res.status(404).json(notFound);
      if (!program.contract_id || !program.contract_client_id) return res.status(409).json(contractRequired);
      let input;
      try {
        input = parseGeneratePlansInput(req.body);
      } catch (err) {
        return res.status(400).json(toValidationError(err));
      }
      try {
        const allowedEquipment = await equipmentRepo.listByProgramScope(program);
        const allowedIds = new Set(allowedEquipment.map((item) => Number(item.id)));
        const outsideScope = input.equipmentIds.filter((id) => !allowedIds.has(Number(id)));
        if (outsideScope.length) {
          return res.status(400).json({
            error: "Um ou mais equipamentos nao pertencem ao cliente do contrato ou estao fora do escopo do programa",
            errorCode: "SG_EQUIPMENT_OUTSIDE_PROGRAM_SCOPE",
            equipmentIds: outsideScope
          });
        }
        const result = await plansRepo.generatePlansForProgram({
          programId: program.id,
          equipmentIds: input.equipmentIds,
          plans: input.plans,
          actor: actorOf(req)
        });
        res.status(201).json(result);
      } catch (err) {
        if (err && err.code === "SG_EQUIPMENT_INVALID") return res.status(400).json({ error: "Equipamento invalido ou inexistente", errorCode: "SG_EQUIPMENT_INVALID" });
        if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
        throw err;
      }
    })
  );

  return router;
}

module.exports = { createMaintenanceProgramsRouter };
