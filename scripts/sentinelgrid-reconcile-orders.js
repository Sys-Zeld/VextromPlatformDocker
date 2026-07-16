// Reconcilia o vínculo OM → OS entre SentinelGrid e Service Report.
//
// A exclusão de OS no Service Report é DELETE físico e não há FK entre os bancos: o carimbo
// rs_service_order_id na OM pode apontar para uma OS que não existe mais. Este script confirma
// cada carimbo no RS e desfaz os órfãos — a OM volta a ser pendente e pode gerar uma OS nova.
//
// Uso: npm run sentinelgrid:reconcile-orders [-- --dry-run]

const { clearOrphanServiceOrderLinks } = require("../sentinelgrid/src/services/reportServiceIntegration");
const pool = require("../sentinelgrid/src/db");
const rs = require("../report_service/src/services/serviceReportService");

const dryRun = process.argv.includes("--dry-run");

async function report() {
  const stamped = (await pool.query(
    `SELECT id, order_number, rs_service_order_id, rs_service_order_code
       FROM sg_maintenance_orders
      WHERE rs_service_order_id IS NOT NULL AND deleted_at IS NULL`
  )).rows;
  const rsIds = [...new Set(stamped.map((om) => Number(om.rs_service_order_id)))];
  const alive = new Set((await rs.listExistingOrderIds(rsIds)).map(Number));
  return {
    checked: stamped.length,
    orphans: stamped.filter((om) => !alive.has(Number(om.rs_service_order_id)))
  };
}

async function run() {
  if (dryRun) {
    const { checked, orphans } = await report();
    // eslint-disable-next-line no-console
    console.log(`[dry-run] ${checked} OM(s) carimbada(s); ${orphans.length} órfã(s).`);
    orphans.forEach((om) => {
      // eslint-disable-next-line no-console
      console.log(`  ${om.order_number} → OS ${om.rs_service_order_code || `#${om.rs_service_order_id}`} (inexistente)`);
    });
    return;
  }
  const { checked, cleared } = await clearOrphanServiceOrderLinks({}, "script:reconcile");
  // eslint-disable-next-line no-console
  console.log(`${checked} OM(s) carimbada(s) verificada(s); ${cleared.length} vínculo(s) órfão(s) desfeito(s).`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Falha ao reconciliar vínculos OM → OS:", err.message);
    process.exit(1);
  });
