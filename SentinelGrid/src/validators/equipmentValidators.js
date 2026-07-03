const { z } = require("zod");
const { CRITICALITY, OPERATIONAL_STATUS } = require("../constants");

// Vazio/ausente → null (para FKs opcionais, inteiros e datas).
const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());

const optionalId = nullable(z.coerce.number().int().positive());
const optionalInt = nullable(z.coerce.number().int().nonnegative());
const optionalDate = nullable(z.string().trim());
const text = (max) => z.string().trim().max(max).optional().default("");

// Entrada de Equipamento: só `areaId` define a hierarquia; o service deriva
// site_id e client_id a partir da área (consistência §28.2).
const equipmentInputSchema = z.object({
  areaId: z.coerce.number().int().positive("Área é obrigatória"),
  tag: text(120),
  equipmentTypeId: optionalId,
  manufacturerId: optionalId,
  modelId: optionalId,
  serialNumber: text(120),
  ratedPower: text(60),
  inputVoltage: text(60),
  outputVoltage: text(60),
  dcVoltage: text(60),
  frequency: text(60),
  redundancyConfig: text(120),
  moduleCount: optionalInt,
  batteryType: text(120),
  installDate: optionalDate,
  commissionDate: optionalDate,
  criticality: z.enum(CRITICALITY).optional().default("media"),
  operationalStatus: z.enum(OPERATIONAL_STATUS).optional().default("operacional_normal"),
  internalTechnician: text(200),
  notes: z.string().trim().max(2000).optional().default("")
});

function parseEquipmentInput(body) {
  return equipmentInputSchema.parse(body ?? {});
}

module.exports = { equipmentInputSchema, parseEquipmentInput };
