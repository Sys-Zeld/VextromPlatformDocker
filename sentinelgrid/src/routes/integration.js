const express = require("express");
const sync = require("../services/registrySync");

// Troca de cadastros com o Service Report. O SentinelGrid é o dono do contrato de
// integração (ver services/registrySync.js): tanto o "importar do RS" (consumido pela
// tela de Clientes do SG) quanto o "exportar para o RS" (consumido pela tela de
// Clientes do RS) passam por aqui, mantendo toda a lógica cross-módulo num só lugar.
function createIntegrationRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");

  const NOT_FOUND_CODES = new Set(["SG_RS_CUSTOMER_INVALID", "SG_CLIENT_INVALID", "SG_RS_EQUIPMENT_INVALID", "SG_EQUIPMENT_INVALID"]);

  function handleError(err, res) {
    if (err && NOT_FOUND_CODES.has(err.code)) {
      return res.status(404).json({ error: err.message, errorCode: err.code });
    }
    if (err && err.code === "SG_SYNC_INVALID") {
      return res.status(400).json({ error: err.message, errorCode: err.code });
    }
    if (err && err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, errorCode: "SG_RS_CONTRACT_ERROR" });
    }
    throw err;
  }

  // ---- RS → SG : importar para o SentinelGrid ----
  router.get(
    "/report-service/importable",
    asyncHandler(async (_req, res) => {
      res.json({ customers: await sync.listReportServiceImportable() });
    })
  );
  router.post(
    "/report-service/import",
    asyncHandler(async (req, res) => {
      const rsCustomerId = Number(req.body && req.body.rsCustomerId);
      if (!rsCustomerId) {
        return res.status(400).json({ error: "rsCustomerId é obrigatório", errorCode: "SG_RS_CUSTOMER_REQUIRED" });
      }
      try {
        const result = await sync.importCustomerFromReportService(
          {
            rsCustomerId,
            withSites: req.body.withSites !== false,
            withEquipment: req.body.withEquipment !== false
          },
          actorOf(req)
        );
        res.json({ result });
      } catch (err) {
        return handleError(err, res);
      }
    })
  );

  // ---- SG → RS : exportar do SentinelGrid para o Service Report ----
  router.get(
    "/report-service/exportable",
    asyncHandler(async (_req, res) => {
      res.json({ clients: await sync.listReportServiceExportable() });
    })
  );
  router.post(
    "/report-service/export",
    asyncHandler(async (req, res) => {
      const sgClientId = Number(req.body && req.body.sgClientId);
      if (!sgClientId) {
        return res.status(400).json({ error: "sgClientId é obrigatório", errorCode: "SG_CLIENT_REQUIRED" });
      }
      try {
        const result = await sync.exportClientToReportService(
          {
            sgClientId,
            withSites: req.body.withSites !== false,
            withEquipment: req.body.withEquipment !== false
          },
          actorOf(req)
        );
        res.json({ result });
      } catch (err) {
        return handleError(err, res);
      }
    })
  );

  // ---- Equipamento: RS → SG (importar) ----
  router.get(
    "/report-service/importable-equipment",
    asyncHandler(async (_req, res) => {
      res.json({ equipment: await sync.listReportServiceImportableEquipment() });
    })
  );
  router.post(
    "/report-service/import-equipment",
    asyncHandler(async (req, res) => {
      const rsEquipmentId = Number(req.body && req.body.rsEquipmentId);
      if (!rsEquipmentId) {
        return res.status(400).json({ error: "rsEquipmentId é obrigatório", errorCode: "SG_RS_EQUIPMENT_REQUIRED" });
      }
      try {
        const result = await sync.importEquipmentFromReportService({ rsEquipmentId }, actorOf(req));
        res.json({ result });
      } catch (err) {
        return handleError(err, res);
      }
    })
  );

  // ---- Equipamento: SG → RS (exportar) ----
  router.get(
    "/report-service/exportable-equipment",
    asyncHandler(async (_req, res) => {
      res.json({ equipment: await sync.listReportServiceExportableEquipment() });
    })
  );
  router.post(
    "/report-service/export-equipment",
    asyncHandler(async (req, res) => {
      const sgEquipmentId = Number(req.body && req.body.sgEquipmentId);
      if (!sgEquipmentId) {
        return res.status(400).json({ error: "sgEquipmentId é obrigatório", errorCode: "SG_EQUIPMENT_REQUIRED" });
      }
      try {
        const result = await sync.exportEquipmentToReportService({ sgEquipmentId }, actorOf(req));
        res.json({ result });
      } catch (err) {
        return handleError(err, res);
      }
    })
  );

  return router;
}

module.exports = { createIntegrationRouter };
