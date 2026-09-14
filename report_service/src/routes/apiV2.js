const express = require("express");
const { createReportServiceV2Controller } = require("../controllers/createReportV2Controller");

// Façade JSON para o SPA React (Fase 0). Montado sob /admin/api/v2 com a MESMA
// auth de sessão/CSRF do admin legado. Reusa os services/repositories existentes.
function createReportServiceV2Router(deps) {
  const router = express.Router();
  const asyncHandler = deps.asyncHandler;
  const controller = createReportServiceV2Controller(deps);

  // Token CSRF para o cliente do SPA (csurf valida via header X-CSRF-Token).
  router.get("/csrf-token", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ csrfToken: req.csrfToken() });
  });

  router.get("/session", asyncHandler(controller.session));

  // Customers + Sites (piloto Fase 2) — CRUD JSON reusando services/repositories.
  router.get("/customers", asyncHandler(controller.listCustomers));
  router.post("/customers", asyncHandler(controller.createCustomer));
  router.put("/customers/:id", asyncHandler(controller.updateCustomer));
  router.delete("/customers/:id", asyncHandler(controller.deleteCustomer));
  router.post("/customer-areas", asyncHandler(controller.createCustomerArea));
  router.put("/customer-areas/:id", asyncHandler(controller.updateCustomerArea));
  router.delete("/customer-areas/:id", asyncHandler(controller.deleteCustomerArea));
  router.post("/sites", asyncHandler(controller.createSite));
  router.put("/sites/:id", asyncHandler(controller.updateSite));
  router.delete("/sites/:id", asyncHandler(controller.deleteSite));

  // Orders (lista + criação/edição/exclusão)
  router.get("/orders", asyncHandler(controller.listOrders));
  router.post("/orders", asyncHandler(controller.createOrder));
  router.put("/orders/:id", asyncHandler(controller.updateOrderRegistration));
  router.delete("/orders/:id", asyncHandler(controller.deleteOrder));

  // Order editor (cabeçalho + timesheet + equipamentos/equipe da OS)
  router.get("/orders/:id/editor", asyncHandler(controller.getOrderEditor));
  router.post("/orders/:id/validate", asyncHandler(controller.validateOrder));
  router.post("/orders/:id/revalidate", asyncHandler(controller.revalidateOrder));
  router.post("/orders/:id/timesheet", asyncHandler(controller.addTimesheet));
  router.put("/orders/:id/timesheet/:entryId", asyncHandler(controller.updateTimesheet));
  router.delete("/orders/:id/timesheet/:entryId", asyncHandler(controller.deleteTimesheet));
  router.post("/orders/:id/equipments", asyncHandler(controller.attachOrderEquipment));
  router.delete("/orders/:id/equipments/:equipmentId", asyncHandler(controller.detachOrderEquipment));
  router.post("/orders/:id/technicians", asyncHandler(controller.linkOrderTechnician));
  router.delete("/orders/:id/technicians/:techId", asyncHandler(controller.unlinkOrderTechnician));
  router.post("/orders/:id/instruments", asyncHandler(controller.linkOrderInstrument));
  router.delete("/orders/:id/instruments/:instrId", asyncHandler(controller.unlinkOrderInstrument));
  router.post("/orders/:id/components", asyncHandler(controller.addOrderComponent));
  router.get("/orders/:id/components/spare-list", asyncHandler(controller.getOrderComponentSpareList));
  router.put("/orders/:id/components/:componentId", asyncHandler(controller.updateOrderComponent));
  router.delete("/orders/:id/components/:componentId", asyncHandler(controller.deleteOrderComponent));

  const csvRaw = express.raw({ type: ["text/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"], limit: "10mb" });
  const xlsxRaw = express.raw({ type: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"], limit: "25mb" });

  // Ensaios / Medições (tabelas @ensaios)
  router.get("/orders/:id/measurements", asyncHandler(controller.listMeasurements));
  router.post("/orders/:id/measurements", asyncHandler(controller.saveMeasurement));
  router.delete("/orders/:id/measurements/:measurementId", asyncHandler(controller.deleteMeasurement));

  // Dados UPS: Leituras Alber (CSV) + Medições UPS (XLSX) + Event Logs (XLSX)
  router.get("/orders/:id/ups-data", asyncHandler(controller.getUpsData));
  router.post("/orders/:id/ups-data/alber/import", csvRaw, asyncHandler(controller.importAlber));
  router.delete("/orders/:id/ups-data/alber/:leituraId", asyncHandler(controller.deleteAlber));
  router.post("/orders/:id/ups-data/ups-measures/import", xlsxRaw, asyncHandler(controller.importUpsMeasures));
  router.delete("/orders/:id/ups-data/ups-measures/:upsId", asyncHandler(controller.deleteUpsMeasures));
  router.post("/orders/:id/ups-data/event-logs/import", xlsxRaw, asyncHandler(controller.importEventLog));
  router.delete("/orders/:id/ups-data/event-logs/:eventLogId", asyncHandler(controller.deleteEventLog));

  router.post("/orders/:id/components/style-ai", asyncHandler(controller.componentsStyleAi));
  router.post("/orders/:id/components/style-reset", asyncHandler(controller.componentsStyleReset));
  router.post("/orders/:id/components/style-default", asyncHandler(controller.componentsStyleDefault));

  // Anexos da OS (upload aceita qualquer tipo de arquivo, corpo raw até 50 MB)
  router.get("/orders/:id/attachments", asyncHandler(controller.listOrderAttachments));
  router.post("/orders/:id/attachments", express.raw({ type: () => true, limit: "50mb" }), asyncHandler(controller.uploadOrderAttachment));
  router.delete("/orders/:id/attachments/:attachmentId", asyncHandler(controller.deleteOrderAttachment));
  router.get("/orders/:id/attachments/:attachmentId/download", asyncHandler(controller.downloadOrderAttachment));
  router.post("/orders/:id/send-os-email", asyncHandler(controller.sendOsCreatedEmail));

  // Report editor — capítulos/seções (rota :sectionKey vem por último para não capturar as fixas)
  router.get("/orders/:id/report-editor", asyncHandler(controller.getReportEditor));
  router.get("/orders/:id/preview-html", asyncHandler(controller.getReportPreviewHtml));
  router.post("/orders/:id/translate/start", asyncHandler(controller.startTranslateReportJob));
  router.get("/orders/:id/translate/jobs/:jobId", asyncHandler(controller.getTranslateReportJob));
  router.post("/orders/:id/sections", asyncHandler(controller.createReportSection));
  router.post("/orders/:id/sections/reorder", asyncHandler(controller.reorderReportSections));
  router.post("/orders/:id/sections/revise-text", asyncHandler(controller.reviseSectionText));
  router.get("/orders/:id/toc-tables", asyncHandler(controller.getTocTables));
  router.post("/orders/:id/toc-tables/rename", asyncHandler(controller.renameTocTables));
  router.put("/orders/:id/sections/:sectionKey", asyncHandler(controller.saveReportSection));
  router.delete("/orders/:id/sections/:sectionKey", asyncHandler(controller.deleteReportSection));

  // Report editor — banco de imagens (@img). Upload aceita png/jpg/webp/gif (corpo raw).
  router.post(
    "/orders/:id/images",
    express.raw({ type: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/octet-stream"], limit: "15mb" }),
    asyncHandler(controller.uploadReportImage)
  );
  router.put("/orders/:id/images/:imageId/caption", asyncHandler(controller.updateReportImageCaption));
  router.put("/orders/:id/images/:imageId/rotation", asyncHandler(controller.updateReportImageRotation));
  router.delete("/orders/:id/images/:imageId", asyncHandler(controller.deleteReportImage));

  // Report editor — assinatura eletrônica: links (sign-requests)
  router.post("/orders/:id/sign-requests", asyncHandler(controller.createSignRequest));
  router.put("/orders/:id/sign-requests/:requestId", asyncHandler(controller.updateSignRequest));
  router.post("/orders/:id/sign-requests/:requestId/cancel", asyncHandler(controller.cancelSignRequest));
  router.delete("/orders/:id/sign-requests/:requestId", asyncHandler(controller.deleteSignRequest));

  // Assinatura do técnico Vextrom (tela de assinar)
  router.get("/orders/:id/sign-report", asyncHandler(controller.getSignReport));
  router.post("/orders/:id/sign-report", asyncHandler(controller.createTechnicianSignature));
  router.delete("/orders/:id/signatures/:signatureId", asyncHandler(controller.deleteTechnicianSignature));
  router.post("/orders/:id/daily-logs", asyncHandler(controller.saveDailyLog));
  router.delete("/orders/:id/daily-logs/:dailyLogId", asyncHandler(controller.deleteDailyLog));
  router.post("/orders/:id/daily-logs/revise-text", asyncHandler(controller.reviseDailyLogText));
  router.post("/orders/:id/daily-logs/generate-conclusion", asyncHandler(controller.generateConclusion));

  // Equipments (CRUD)
  router.get("/equipments", asyncHandler(controller.listEquipments));
  router.post("/equipments", asyncHandler(controller.createEquipment));
  router.put("/equipments/:id", asyncHandler(controller.updateEquipment));
  router.delete("/equipments/:id", asyncHandler(controller.deleteEquipment));

  // Anexos do equipamento (manuais, parâmetros, etc. — corpo raw até 50 MB)
  router.get("/equipments/:id/attachments", asyncHandler(controller.listEquipmentAttachments));
  router.post("/equipments/:id/attachments", express.raw({ type: () => true, limit: "50mb" }), asyncHandler(controller.uploadEquipmentAttachment));
  router.delete("/equipments/:id/attachments/:attachmentId", asyncHandler(controller.deleteEquipmentAttachment));
  router.get("/equipments/:id/attachments/:attachmentId/download", asyncHandler(controller.downloadEquipmentAttachment));

  // Analytics (dashboard)
  router.get("/analytics", asyncHandler(controller.analytics));

  // Spare parts (catálogo)
  router.get("/spare-parts", asyncHandler(controller.listSpareParts));
  router.get("/spare-parts/ai-config", asyncHandler(controller.sparePartsAiConfig));
  router.post("/spare-parts/ai-extract", asyncHandler(controller.aiExtractSpareParts));
  router.post("/spare-parts/bulk-import", asyncHandler(controller.bulkImportSpareParts));
  router.post("/spare-parts", asyncHandler(controller.createSparePart));
  router.put("/spare-parts/:id", asyncHandler(controller.updateSparePart));
  router.delete("/spare-parts/:id", asyncHandler(controller.deleteSparePart));

  // Spare parts: vínculo por equipamento (novo modelo de snapshots editáveis)
  router.get("/spare-parts/by-equipment", asyncHandler(controller.listSparesGroupedByEquipment));
  router.get("/spare-parts/equipment/:equipmentId", asyncHandler(controller.getEquipmentSpares));
  router.post("/spare-parts/equipment/:equipmentId/link", asyncHandler(controller.linkSparePart));
  router.post("/spare-parts/equipment/:equipmentId/copy-from", asyncHandler(controller.copyEquipmentSpares));
  router.post("/spare-parts/equipment/:equipmentId/spares", asyncHandler(controller.createEquipmentSpare));
  router.put("/spare-parts/equipment-spares/:id", asyncHandler(controller.updateEquipmentSpare));
  router.delete("/spare-parts/equipment-spares/:id", asyncHandler(controller.deleteEquipmentSpare));

  // Config do relatório
  router.get("/config", asyncHandler(controller.getConfig));
  router.put("/config", asyncHandler(controller.saveConfig));

  // Assets globais (técnicos + instrumentos)
  router.get("/assets", asyncHandler(controller.listAssets));
  router.post("/assets/technicians", asyncHandler(controller.createTechnician));
  router.put("/assets/technicians/:id", asyncHandler(controller.updateTechnician));
  router.delete("/assets/technicians/:id", asyncHandler(controller.deleteTechnician));
  router.post("/assets/instruments", asyncHandler(controller.createInstrument));
  router.put("/assets/instruments/:id", asyncHandler(controller.updateInstrument));
  router.delete("/assets/instruments/:id", asyncHandler(controller.deleteInstrument));

  // Ferramentas por técnico
  router.get("/assets/technicians/:techId/tools", asyncHandler(controller.listTechnicianTools));
  router.post("/assets/technicians/:techId/tools", asyncHandler(controller.createTechnicianTool));
  router.put("/assets/technicians/:techId/tools/:toolId", asyncHandler(controller.updateTechnicianTool));
  router.delete("/assets/technicians/:techId/tools/:toolId", asyncHandler(controller.deleteTechnicianTool));

  // Estilos de tabela (status + reset)
  router.get("/table-styles", asyncHandler(controller.listTableStyles));
  router.post("/table-styles/:tableType/style-ai", asyncHandler(controller.tableStyleAi));
  router.post("/table-styles/:tableType/style-reset", asyncHandler(controller.resetTableStyleWithPreview));
  router.post("/table-styles/:tableType/reset", asyncHandler(controller.resetTableStyle));

  // Histórico de PDFs por OS
  router.get("/orders/:id/pdf-history", asyncHandler(controller.listPdfHistory));
  router.delete("/orders/:id/pdf-history/:entryId", asyncHandler(controller.deletePdfHistory));

  return router;
}

module.exports = { createReportServiceV2Router };
