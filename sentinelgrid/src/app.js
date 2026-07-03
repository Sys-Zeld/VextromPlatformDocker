const { createSentinelGridV2Router } = require("./routes/apiV2");

// Registro do módulo no hub central (specflow/app.js), espelhando
// registerReportService. Monta apenas a façade JSON sob a mesma sessão/CSRF do
// admin — sem camada de views (ADR: módulo 100% React/Vite).
function registerSentinelGrid(app, deps) {
  app.use(
    "/admin/api/v2/sentinelgrid",
    deps.requireAdminAuth,
    deps.csrfProtection,
    createSentinelGridV2Router(deps)
  );
}

module.exports = { registerSentinelGrid };
