// Seed de dados de exemplo do SentinelGrid.
// Reutiliza os repositories/validators do módulo (respeita FKs, unicidade e a
// derivação de escopo do equipamento). Idempotente: se o cliente de exemplo já
// existe, não faz nada (rode `npm run db:reset` antes para recriar do zero).

const env = require("../specflow/config/env");
const { ensureDatabaseExists } = require("../specflow/db/ensure-database");
const { migrateSentinelGrid } = require("./migrate");
const pool = require("./src/db");

const clientsRepo = require("./src/repositories/clientsRepository");
const sitesRepo = require("./src/repositories/sitesRepository");
const areasRepo = require("./src/repositories/areasRepository");
const { lookupRepo } = require("./src/repositories/lookupRepository");
const modelsRepo = require("./src/repositories/equipmentModelsRepository");
const equipmentRepo = require("./src/repositories/equipmentRepository");
const programsRepo = require("./src/repositories/maintenanceProgramsRepository");
const plansRepo = require("./src/repositories/equipmentPlansRepository");
const checklistsRepo = require("./src/repositories/checklistsRepository");
const managersRepo = require("./src/repositories/clientManagersRepository");
const contractsRepo = require("./src/repositories/contractsRepository");
const ordersRepo = require("./src/repositories/maintenanceOrdersRepository");

const { parseMaintenanceProgramInput } = require("./src/validators/maintenanceProgramValidators");
const { parseEquipmentPlanInput, parsePlanItemInput } = require("./src/validators/equipmentPlanValidators");
const { parseChecklistInput, parseChecklistItemInput } = require("./src/validators/checklistValidators");
const { parseMaintenanceOrderInput } = require("./src/validators/maintenanceOrderValidators");

const ACTOR = "seed";
const SEED_CLIENT_NAME = "ACME Energia (seed)";

async function alreadySeeded() {
  const r = await pool.query("SELECT 1 FROM sg_clients WHERE name = $1 AND deleted_at IS NULL LIMIT 1", [SEED_CLIENT_NAME]);
  return r.rowCount > 0;
}

// Lookups (fabricante/tipo) têm nome único: reaproveita se já existir.
async function ensureLookup(repo, name) {
  const found = (await repo.list({ search: name, limit: 20 })).items.find((i) => i.name.toLowerCase() === name.toLowerCase());
  return found || repo.create({ name, notes: "" }, ACTOR);
}

async function ensureModel(manufacturerId, equipmentTypeId, name) {
  const found = (await modelsRepo.listModels({ manufacturerId, search: name })).models.find((m) => m.name.toLowerCase() === name.toLowerCase());
  return found || modelsRepo.createModel({ manufacturerId, equipmentTypeId, name, notes: "" }, ACTOR);
}

async function seedSentinelGrid() {
  await ensureDatabaseExists({ connectionString: env.databases.sentinelgrid.url, ssl: env.databases.sentinelgrid.ssl });
  await migrateSentinelGrid();

  if (await alreadySeeded()) {
    // eslint-disable-next-line no-console
    console.log("SentinelGrid seed: dados de exemplo já existem — nada a fazer (rode 'npm run db:reset' para recriar).");
    return;
  }

  // Catálogo (find-or-create) ------------------------------------------------
  const mans = lookupRepo("sg_manufacturers");
  const types = lookupRepo("sg_equipment_types");
  const vertiv = await ensureLookup(mans, "Vertiv");
  await ensureLookup(mans, "Schneider");
  const typeUps = await ensureLookup(types, "UPS");
  await ensureLookup(types, "Banco de Baterias");
  const modelApm = await ensureModel(vertiv.id, typeUps.id, "Liebert APM");

  // Hierarquia Cliente → Site → Área -----------------------------------------
  const client = await clientsRepo.createClient(
    { name: SEED_CLIENT_NAME, taxId: "12.345.678/0001-90", segment: "Data Center", status: "ativo", notes: "Cliente de exemplo (seed)" },
    ACTOR
  );
  const site = await sitesRepo.createSite(
    { clientId: client.id, name: "Data Center São Paulo", siteType: "data center", location: "São Paulo/SP", localContact: "NOC 24h", notes: "" },
    ACTOR
  );
  const area = await areasRepo.createArea(
    { siteId: site.id, name: "Sala de UPS", areaType: "sala de UPS", classification: "crítica", accessRestrictions: "acesso controlado", envConditions: "climatizada 22°C", notes: "" },
    ACTOR
  );

  // Equipamento (deriva client/site da área) ---------------------------------
  const equipment = await equipmentRepo.createEquipment(
    {
      areaId: area.id, tag: "UPS-DC-01", equipmentTypeId: typeUps.id, manufacturerId: vertiv.id, modelId: modelApm.id,
      serialNumber: "SN-0001", ratedPower: "120 kVA", inputVoltage: "380 V", outputVoltage: "220 V", dcVoltage: "480 V",
      frequency: "60 Hz", redundancyConfig: "N+1", moduleCount: 4, batteryType: "VRLA", installDate: "2021-03-15",
      commissionDate: "2021-04-01", criticality: "missao_critica", operationalStatus: "operacional_normal",
      internalTechnician: "", notes: "Equipamento de exemplo (seed)"
    },
    ACTOR
  );

  // Gestor + Contrato --------------------------------------------------------
  await managersRepo.createManager(
    { clientId: client.id, siteId: site.id, name: "Maria Fiscal", roleType: "fiscal técnico", email: "maria@acme.example", phone: "+55 11 90000-0000", notes: "" },
    ACTOR
  );
  await contractsRepo.createContract(
    { clientId: client.id, name: "Contrato ACME 2026", validFrom: "2026-01-01", validTo: "2026-12-31", maintPerYear: 2, slaCorrective: "24h", requiresReport: true, requiresApproval: true, scope: "UPS e bancos de baterias", notes: "" },
    ACTOR
  );

  // Programa + Plano + item --------------------------------------------------
  const program = await programsRepo.createProgram(
    parseMaintenanceProgramInput({ name: "Preventiva Semestral UPS", description: "Programa padrão de UPS", equipmentTypeId: typeUps.id, maintenanceType: "preventiva_sem_parada", periodicity: "semestral" }),
    ACTOR
  );
  const plan = await plansRepo.createPlan(
    parseEquipmentPlanInput({ equipmentId: equipment.id, programId: program.id, name: "Plano UPS-DC-01", maintenanceType: "preventiva_sem_parada", periodicity: "semestral", initialNextDueDate: "2026-09-01" }),
    ACTOR
  );
  await plansRepo.createPlanItem(
    plan.id,
    parsePlanItemInput({ title: "Inspeção semestral da UPS", maintenanceType: "preventiva_sem_parada", periodicity: "semestral", nextDueDate: "2026-09-01" }),
    ACTOR
  );

  // Checklist + itens --------------------------------------------------------
  const checklist = await checklistsRepo.createChecklist(
    parseChecklistInput({ name: "Checklist UPS", equipmentTypeId: typeUps.id, maintenanceType: "preventiva_sem_parada" }),
    ACTOR
  );
  for (const title of ["Verificar alarmes ativos", "Medir tensão de saída", "Verificar ventiladores", "Verificar estado das baterias"]) {
    await checklistsRepo.createChecklistItem(checklist.id, parseChecklistItemInput({ title }), ACTOR);
  }

  // Ordem de manutenção (planejada) ------------------------------------------
  const order = await ordersRepo.createOrder(
    parseMaintenanceOrderInput({ equipmentId: equipment.id, maintenanceType: "preventiva_sem_parada", planId: plan.id, checklistId: checklist.id, plannedDate: "2026-09-01", scope: "Preventiva semestral programada" }),
    ACTOR
  );

  // eslint-disable-next-line no-console
  console.log(`SentinelGrid seed OK: cliente #${client.id}, equipamento ${equipment.tag} #${equipment.id}, programa #${program.id}, plano #${plan.id}, checklist #${checklist.id}, ordem #${order.id}.`);
}

module.exports = { seedSentinelGrid };

if (require.main === module) {
  seedSentinelGrid()
    .then(() => process.exit(0))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("SentinelGrid seed falhou:", err.message);
      process.exit(1);
    });
}
