const { initialize, invalidateAllAdminSessions } = require("../specflow/services/adminSessionState");

async function run() {
  await initialize();
  const cutOff = invalidateAllAdminSessions();
  // eslint-disable-next-line no-console
  console.log(`Todas as sessoes admin foram invalidadas. Corte: ${new Date(cutOff).toISOString()}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Falha ao invalidar sessoes admin:", err.message);
    process.exit(1);
  });
