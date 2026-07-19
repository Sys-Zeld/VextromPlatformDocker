const express = require("express");
const reportsService = require("../services/reportsService");
const exporter = require("../services/reportsExport");

// Relatórios gerenciais — read-only. Cada relatório responde nos quatro formatos
// via ?format=json|xlsx|csv|pdf; json alimenta a SPA, os demais baixam arquivo.

const posInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Só aceita valores conhecidos: evita que texto livre chegue ao WHERE como filtro.
const enumOf = (value, allowed) => (allowed.includes(String(value)) ? String(value) : "");

const STATUSES = Object.keys(reportsService.STATUS_LABEL);
const TYPES = Object.keys(reportsService.TYPE_LABEL);

function collectFilters(req) {
  const q = req.query;
  return {
    year: posInt(q.year),
    month: posInt(q.month),
    clientId: posInt(q.clientId),
    siteId: posInt(q.siteId),
    equipmentId: posInt(q.equipmentId),
    technicianId: posInt(q.technicianId),
    status: enumOf(q.status, STATUSES),
    maintenanceType: enumOf(q.maintenanceType, TYPES),
    includeCancelled: String(q.includeCancelled || "") === "true"
  };
}

const SLUG = (doc) => `${doc.key}-${doc.period.label.replace(/[^\w]+/g, "-").toLowerCase()}`;

function createReportsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler || ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));

  const handle = (kind) =>
    asyncHandler(async (req, res) => {
      const doc = await reportsService.buildReport(kind, collectFilters(req));
      const format = String(req.query.format || "json").toLowerCase();

      if (format === "xlsx") {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${SLUG(doc)}.xlsx"`);
        return res.send(exporter.buildXlsxBuffer(doc));
      }
      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${SLUG(doc)}.csv"`);
        // BOM para o Excel abrir acentuação corretamente.
        return res.send(`﻿${exporter.buildCsv(doc)}`);
      }
      if (format === "pdf") {
        const pdf = await exporter.buildPdfBuffer(doc);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${SLUG(doc)}.pdf"`);
        return res.send(pdf);
      }
      return res.json(doc);
    });

  router.get("/equipment-schedule", handle("equipment-schedule"));
  router.get("/technician-orders", handle("technician-orders"));
  router.get("/client-schedule", handle("client-schedule"));

  return router;
}

module.exports = { createReportsRouter };
