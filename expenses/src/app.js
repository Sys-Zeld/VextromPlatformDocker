const { createExpensesV2Router } = require("./routes/apiV2");
const { createEmailService } = require("./services/emailService");
const { createAuthService } = require("./services/authService");
const { createAccountService } = require("./services/accountService");

// Registro do módulo no hub central (specflow/app.js). O módulo tem LOGIN
// PRÓPRIO: a API fica em /api/expenses (fora de /admin/api/v2, que exige a
// sessão do hub) e é protegida pela sessão do módulo + CSRF.
//
// Devolve { resolveActor } para o hub proteger o SPA em /app/expenses.
function registerExpenses(app, deps) {
  const email = createEmailService(deps);
  const auth = createAuthService({ email });
  const accounts = createAccountService({ auth });
  app.use("/api/expenses", createExpensesV2Router(deps, { auth, accounts, email }));
  return { resolveActor: auth.resolveActor };
}

module.exports = { registerExpenses };
