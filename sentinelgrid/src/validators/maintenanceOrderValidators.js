const { z } = require("zod");
const { MAINTENANCE_TYPE, ORDER_STATUS, CORRECTIVE_CLASS } = require("../constants");

const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());

const optionalId = nullable(z.coerce.number().int().positive());
const optionalDate = nullable(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"));
const optionalDateTime = nullable(z.string().trim().datetime({ offset: true }));
const text = (max) => z.string().trim().max(max).optional().default("");

const correctiveDetailsSchema = z.object({
  symptom: text(2000),
  alarm: text(1000),
  operationalImpact: text(2000),
  probableCause: text(2000),
  rootCause: text(2000),
  actionTaken: text(3000),
  urgency: text(120),
  correctiveClass: z.enum(CORRECTIVE_CLASS).optional().default("programada")
});

const orderApprovalInputSchema = z.object({
  clientManagerId: optionalId,
  approverName: text(180),
  approvedAt: optionalDateTime,
  authorizedWindow: text(500),
  restrictions: text(1000),
  releaseCondition: text(1000),
  finalAccept: z.boolean().optional().default(false),
  notes: text(1000)
}).superRefine((value, ctx) => {
  if (!value.clientManagerId && !value.approverName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approverName"],
      message: "Informe um gestor ou nome do aprovador"
    });
  }
});

const orderStatusInputSchema = z.object({
  status: z.enum(ORDER_STATUS),
  finalCondition: text(2000),
  notes: text(2000)
});

const orderFromPlanInputSchema = z.object({
  planId: z.coerce.number().int().positive("Plano e obrigatorio"),
  planItemId: optionalId,
  checklistId: optionalId,
  priority: z.string().trim().max(80).optional().default("normal"),
  plannedDate: optionalDate,
  scheduledDate: optionalDateTime,
  technicianId: text(160),
  clientManagerId: optionalId,
  scope: text(3000),
  notes: text(2000)
});

const maintenanceOrderInputSchema = z.object({
  equipmentId: z.coerce.number().int().positive("Equipamento e obrigatorio"),
  planId: optionalId,
  planItemId: optionalId,
  checklistId: optionalId,
  maintenanceType: z.enum(MAINTENANCE_TYPE),
  status: z.enum(ORDER_STATUS).optional(),
  priority: z.string().trim().max(80).optional().default("normal"),
  plannedDate: optionalDate,
  scheduledDate: optionalDateTime,
  executedDate: optionalDateTime,
  technicianId: text(160),
  clientManagerId: optionalId,
  scope: text(3000),
  finalCondition: text(2000),
  notes: text(2000),
  correctiveDetails: correctiveDetailsSchema.optional().nullable()
}).superRefine((value, ctx) => {
  if (value.maintenanceType === "corretiva") {
    const details = value.correctiveDetails;
    if (!details || !details.symptom || !details.operationalImpact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctiveDetails"],
        message: "Corretiva exige sintoma e impacto operacional"
      });
    }
  }
});

function parseMaintenanceOrderInput(body) {
  return maintenanceOrderInputSchema.parse(body ?? {});
}

function parseOrderApprovalInput(body) {
  return orderApprovalInputSchema.parse(body ?? {});
}

function parseOrderStatusInput(body) {
  return orderStatusInputSchema.parse(body ?? {});
}

function parseOrderFromPlanInput(body) {
  return orderFromPlanInputSchema.parse(body ?? {});
}

module.exports = {
  maintenanceOrderInputSchema,
  correctiveDetailsSchema,
  orderApprovalInputSchema,
  orderStatusInputSchema,
  orderFromPlanInputSchema,
  parseMaintenanceOrderInput,
  parseOrderApprovalInput,
  parseOrderStatusInput,
  parseOrderFromPlanInput
};
