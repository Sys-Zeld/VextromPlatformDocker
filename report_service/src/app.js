const { createReportServiceApiRouter } = require("./routes/api");
const { createReportServiceWebRouter } = require("./routes/web");
const { createReportPublicRouter } = require("./routes/public");
const { createReportServiceMobileRouter } = require("./routes/mobile");
const { createReportServiceV2Router } = require("./routes/apiV2");

const MOBILE_UA_RE = /Android|iPhone|iPad|iPod/i;

function mobileRedirect(req, res, next) {
  if (req.method !== "GET") return next();
  if (!MOBILE_UA_RE.test(req.headers["user-agent"] || "")) return next();
  if (req.path.includes("/preview-html")) return next();
  const subPath = req.path === "/" ? "" : req.path;
  const qs = req.originalUrl.split("?")[1];
  const target = `/admin/report-service/mobile${subPath}${qs ? "?" + qs : ""}`;
  return res.redirect(302, target);
}

function registerReportService(app, deps) {
  // Façade JSON do SPA React (Fase 0) — mesma sessão/CSRF do admin legado.
  app.use(
    "/admin/api/v2",
    deps.requireAdminAuth,
    deps.csrfProtection,
    createReportServiceV2Router(deps)
  );
  app.use("/api/report-service", createReportServiceApiRouter(deps));
  app.use("/admin/report-service/mobile", createReportServiceMobileRouter(deps));
  app.use("/admin/report-service", mobileRedirect);
  app.use("/admin/report-service", createReportServiceWebRouter(deps));
  app.use("/service-report", createReportServiceWebRouter(deps));
  app.use("/r", createReportPublicRouter(deps));
}

module.exports = {
  registerReportService
};
