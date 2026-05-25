const express = require("express");
const { createReportWebController } = require("../controllers/createReportWebController");
const { createAnalyticsWebController } = require("../controllers/analyticsController");

function createReportServiceWebRouter(deps) {
  const router = express.Router();
  const asyncHandler = deps.asyncHandler;
  const controller = createReportWebController(deps);
  const analyticsController = createAnalyticsWebController(deps);

  router.get("/", deps.requireAdminAuth, asyncHandler(controller.home));
  router.get("/analytics", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(analyticsController.dashboard));
  router.get("/analytics/data", deps.requireAdminAuth, asyncHandler(analyticsController.dashboardData));
  router.get("/analytics/export-pdf", deps.requireAdminAuth, asyncHandler(analyticsController.exportPdf));
  router.get("/orders", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.listOrders));
  router.post("/orders", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createOrder));
  router.post("/orders/:id/update-registration", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateOrderRegistration));
  router.post("/orders/:id/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteOrder));
  router.post("/orders/:id/validate-os", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.validateOrder));
  router.post("/orders/:id/revalidate-os", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.revalidateOrder));
  router.get("/orders/:id", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.orderEditor));
  router.get("/orders/:id/measurements", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.measurementsEditor));
  router.get("/orders/:id/alber", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.alberEditor));
  router.post(
    "/orders/:id/alber/import",
    express.raw({ type: ["text/csv", "application/octet-stream", "text/plain"], limit: "5mb" }),
    deps.csrfProtection,
    deps.requireAdminAuth,
    asyncHandler(controller.importAlberFile)
  );
  router.post("/orders/:id/alber/:leituraId/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateAlberLeitura));
  router.post("/orders/:id/alber/:leituraId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteAlberLeitura));
  router.post("/orders/:id/alber/:leituraId/style-ai", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.alberStyleAi));
  router.post("/orders/:id/alber/:leituraId/style-default", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.alberStyleDefault));
  router.post("/orders/:id/alber/:leituraId/style-reset", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.alberStyleReset));
  router.get("/orders/:id/discharge", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.dischargeEditor));
  router.post(
    "/orders/:id/discharge/import",
    express.raw({ type: ["text/csv", "application/octet-stream", "text/plain"], limit: "5mb" }),
    deps.csrfProtection,
    deps.requireAdminAuth,
    asyncHandler(controller.importDischargeTest)
  );
  router.post("/orders/:id/discharge/:testId/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateDischargeTest));
  router.post("/orders/:id/discharge/:testId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteDischargeTest));
  router.post("/orders/:id/discharge/:testId/style-ai", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.dischargeStyleAi));
  router.post("/orders/:id/discharge/:testId/style-default", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.dischargeStyleDefault));
  router.post("/orders/:id/discharge/:testId/style-reset", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.dischargeStyleReset));
  router.post("/orders/:id/discharge/:testId/chart-style-ai", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.dischargeChartStyleAi));
  router.post("/orders/:id/discharge/:testId/chart-style-default", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.dischargeChartStyleDefault));
  router.post("/orders/:id/discharge/:testId/chart-style-reset", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.dischargeChartStyleReset));
  router.get("/orders/:id/report-editor", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.reportOrderEditor));
  router.get("/orders/:id/sign-report", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.signReportPage));
  router.post("/orders/:id/sign-report", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.signReport));
  router.get("/table-styles", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.tableStylesPage));
  router.post("/table-styles/:tableType/style-ai", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.tableStyleAi));
  router.post("/table-styles/:tableType/style-reset", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.tableStyleReset));
  router.get("/config", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.reportConfigPage));
  router.post("/config", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.saveReportConfig));
  router.post(
    "/config/logo-upload",
    express.raw({ type: ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "application/octet-stream"], limit: "5mb" }),
    deps.csrfProtection,
    deps.requireAdminAuth,
    asyncHandler(controller.uploadConfigLogo)
  );
  router.post(
    "/config/image-upload",
    express.raw({ type: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/octet-stream"], limit: "10mb" }),
    deps.csrfProtection,
    deps.requireAdminAuth,
    asyncHandler(controller.uploadConfigImage)
  );
  router.post("/orders/:id/equipments", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.attachEquipment));
  router.post("/orders/:id/equipments/:equipmentId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.detachEquipment));
  router.post("/orders/:id/timesheet", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.addTimesheet));
  router.post("/orders/:id/timesheet/:entryId/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateTimesheet));
  router.post("/orders/:id/timesheet/:entryId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteTimesheet));
  router.post("/orders/:id/daily-logs", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.addDailyLog));
  router.post("/orders/:id/daily-logs/:dailyLogId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteDailyLog));
  router.post("/orders/:id/daily-logs/revise-text", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.reviseDailyLogText));
  router.post("/orders/:id/daily-logs/generate-conclusion", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.generateConclusionFromLogs));
  router.post("/orders/:id/sections/revise-text", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.reviseSectionText));
  router.post("/orders/:id/translate", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.translateReport));
  router.post("/orders/:id/translate/start", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.startTranslateReportJob));
  router.get("/orders/:id/translate/jobs/:jobId", deps.requireAdminAuth, asyncHandler(controller.getTranslateReportJob));
  router.post("/orders/:id/sections", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createSection));
  router.get("/orders/:id/toc-tables", deps.requireAdminAuth, asyncHandler(controller.getTocTables));
  router.post("/orders/:id/sections/reorder", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.reorderSections));
  router.post("/orders/:id/sections/:sectionKey", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.saveSection));
  router.post("/orders/:id/sections/:sectionKey/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteSection));
  router.post("/orders/:id/components", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.addComponent));
  router.post("/orders/:id/components/:componentId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteComponent));
  router.post("/orders/:id/components/style-ai", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.componentsStyleAi));
  router.post("/orders/:id/components/style-default", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.componentsStyleDefault));
  router.post("/orders/:id/components/style-reset", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.componentsStyleReset));
  router.post("/orders/:id/measurements", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.saveMeasurementTable));
  router.post("/orders/:id/measurements/:measurementId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteMeasurementTable));
  router.post("/orders/:id/measurements/:measurementId/style-ai", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.measurementStyleAi));
  router.post("/orders/:id/measurements/:measurementId/style-default", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.measurementStyleDefault));
  router.post("/orders/:id/measurements/:measurementId/style-reset", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.measurementStyleReset));
  router.post("/orders/:id/signatures", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.addSignature));
  router.post("/orders/:id/signatures/:signatureId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteSignature));
  router.post("/orders/:id/sign-requests", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createSignRequest));
  router.post("/orders/:id/sign-requests/:requestId/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateSignRequest));
  router.post("/orders/:id/sign-requests/:requestId/cancel", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.cancelSignRequest));
  router.post("/orders/:id/sign-requests/:requestId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteSignRequest));
  router.get("/orders/:id/signed-pdf-status", deps.requireAdminAuth, asyncHandler(controller.getSignedPdfStatus));
  router.post("/orders/:id/send-signed-email", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.sendSignedReportByEmail));
  router.post("/orders/:id/send-os-email", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.sendOsCreatedEmail));
  router.get("/assets", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.listAssetsGlobal));
  router.post("/assets/technicians", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createGlobalTechnician));
  router.post("/assets/technicians/:techId/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateGlobalTechnician));
  router.post("/assets/technicians/:techId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteGlobalTechnician));
  router.post("/assets/instruments", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createGlobalInstrument));
  router.post("/assets/instruments/:instrId/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateGlobalInstrument));
  router.post("/assets/instruments/:instrId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteGlobalInstrument));

  router.get("/orders/:id/assets", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.assetsEditor));
  router.post("/orders/:id/assets/technicians/link", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.linkTechnicianToOrder));
  router.post("/orders/:id/assets/technicians/:techId/unlink", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.unlinkTechnicianFromOrder));
  router.post("/orders/:id/assets/instruments/link", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.linkInstrumentToOrder));
  router.post("/orders/:id/assets/instruments/:instrId/unlink", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.unlinkInstrumentFromOrder));
  router.post("/orders/:id/technicians", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.addTechnician));
  router.post("/orders/:id/technicians/link", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.linkTechnicianToOrderEditor));
  router.post("/orders/:id/technicians/:techId/unlink", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.unlinkTechnicianFromOrderEditor));
  router.post("/orders/:id/instruments", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.addInstrument));
  router.post(
    "/orders/:id/images/import",
    express.raw({ type: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/octet-stream"], limit: "10mb" }),
    deps.csrfProtection,
    deps.requireAdminAuth,
    asyncHandler(controller.importImage)
  );
  router.post("/orders/:id/images/:imageId/label", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateImageLabel));
  router.post("/orders/:id/images/:imageId/rotate", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateImageRotation));
  router.post("/orders/:id/images/:imageId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteImage));
  router.get("/orders/:id/pdf-history", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.pdfHistoryPage));
  router.post("/orders/:id/pdf-history/:entryId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deletePdfHistory));
  router.get("/orders/:id/pdf-history/:entryId/download", deps.requireAdminAuth, asyncHandler(controller.downloadPdfHistory));

  router.get("/orders/:id/attachments", deps.requireAdminAuth, asyncHandler(controller.listOrderAttachments));
  router.post(
    "/orders/:id/attachments",
    express.raw({ type: "*/*", limit: "50mb" }),
    deps.csrfProtection,
    deps.requireAdminAuth,
    asyncHandler(controller.uploadOrderAttachment)
  );
  router.post("/orders/:id/attachments/:attachmentId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteOrderAttachment));
  router.get("/orders/:id/attachments/:attachmentId/download", deps.requireAdminAuth, asyncHandler(controller.downloadOrderAttachment));

  router.get("/orders/:id/preview", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.previewPage));
  router.get("/orders/:id/preview-html", deps.requireAdminAuth, asyncHandler(controller.previewHtmlPage));
  router.get("/orders/:id/preview-html/template/:templateKey", deps.requireAdminAuth, asyncHandler(controller.previewHtmlByTemplatePage));
  router.get("/orders/:id/pdf-preview", deps.requireAdminAuth, asyncHandler(controller.pdfPreview));
  router.post("/orders/:id/generate-pdf", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.generatePdf));
  router.post("/orders/:id/generate-pdf-for-email", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.generatePdfForEmail));
  router.get("/reports/:id/editor", deps.requireAdminAuth, asyncHandler(controller.reportEditor));
  router.get("/reports/:id/preview", deps.requireAdminAuth, asyncHandler(controller.reportPreview));
  router.post("/reports/:id/generate-pdf", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.reportGeneratePdf));

  router.get("/customers", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.listCustomers));
  router.post("/customers", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createCustomer));
  router.post("/customers/:id/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateCustomer));
  router.post("/customers/:id/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteCustomer));
  router.post("/sites", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createSite));
  router.post("/sites/:id/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateSite));
  router.post("/sites/:id/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteSite));

  router.get("/equipments", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.listEquipments));
  router.post("/equipments", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createEquipment));
  router.post("/equipments/create-inline", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createEquipmentInline));
  router.post("/equipments/:id/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateEquipment));
  router.post("/equipments/:id/update-inline", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateEquipmentInline));
  router.post("/equipments/:id/delete-inline", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteEquipmentInline));

  router.get("/spare-parts", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.listSpareParts));
  router.get("/spare-parts/ai-config", deps.requireAdminAuth, asyncHandler(controller.getSparePartsAiConfig));
  router.post("/spare-parts", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.createSparePart));
  router.post("/spare-parts/ai-extract", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.extractSparePartsFromPdf));
  router.post("/spare-parts/bulk-import", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.bulkImportSpareParts));
  router.post("/spare-parts/:id/update", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateSparePart));
  router.post("/spare-parts/:id/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.deleteSparePart));
  router.post("/spare-parts/equipment-links", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.linkSparePartToEquipment));
  router.post("/spare-parts/equipment-links/import", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.importLinkedSpareParts));
  router.post("/spare-parts/equipment-links/auto-family", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.autoLinkSparePartsByFamily));
  router.post("/spare-parts/equipment-links/:equipmentId/:sparePartId/quantity", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.updateSparePartQuantityByEquipment));
  router.post("/spare-parts/equipment-links/:equipmentId/:sparePartId/delete", deps.csrfProtection, deps.requireAdminAuth, asyncHandler(controller.unlinkSparePartFromEquipment));

  return router;
}

module.exports = {
  createReportServiceWebRouter
};
