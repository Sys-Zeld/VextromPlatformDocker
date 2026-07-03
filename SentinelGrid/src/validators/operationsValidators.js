const { z } = require("zod");

const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());
const optionalId = nullable(z.coerce.number().int().positive());
const optionalDate = nullable(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"));
const optionalDateTime = nullable(z.string().trim().datetime({ offset: true }));
const text = (max) => z.string().trim().max(max).optional().default("");

const measurementInputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  technicianId: text(160),
  measuredAt: optionalDateTime,
  metric: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(240),
  unit: text(40),
  notes: text(1000)
});

const replacedPartInputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  partDescription: z.string().trim().min(1).max(240),
  partCode: text(120),
  manufacturer: text(160),
  quantity: z.coerce.number().positive().optional().default(1),
  reason: text(1000),
  removedCondition: text(1000),
  newPartInstalled: z.boolean().optional().default(true),
  evidence: text(1000)
});

const associatedReportInputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  reportCode: text(120),
  title: z.string().trim().min(1).max(240),
  issuedAt: optionalDateTime,
  technician: text(160),
  reportType: text(120),
  fileRef: text(1000),
  externalLink: text(1000),
  externalId: text(160),
  notes: text(1000)
});

const eventInputSchema = z.object({
  equipmentId: z.coerce.number().int().positive(),
  generatedOrderId: optionalId,
  eventType: z.string().trim().min(1).max(120),
  severity: z.string().trim().max(80).optional().default("media"),
  occurredAt: optionalDateTime,
  description: z.string().trim().min(1).max(2000),
  actionTaken: text(2000)
});

const attachmentInputSchema = z.object({
  entityType: z.enum(["equipment", "order", "recommendation", "report", "event"]),
  entityId: z.coerce.number().int().positive(),
  fileRef: z.string().trim().min(1).max(1000),
  kind: text(120),
  label: text(240),
  notes: text(1000)
});

const calendarGenerateInputSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  equipmentId: optionalId
});

const recommendationInputSchema = z.object({
  equipmentId: z.coerce.number().int().positive(),
  orderId: optionalId,
  reportId: optionalId,
  description: z.string().trim().min(1).max(3000),
  technicalReason: text(3000),
  criticality: z.string().trim().min(1).max(80).optional().default("media"),
  dueDate: optionalDate,
  responsible: text(160),
  status: z.string().trim().min(1).max(80).optional().default("aberta"),
  evidence: text(1000),
  notes: text(2000)
});

const recommendationStatusInputSchema = z.object({
  status: z.string().trim().min(1).max(80),
  notes: text(2000)
});

function parseMeasurementInput(body) { return measurementInputSchema.parse(body ?? {}); }
function parseReplacedPartInput(body) { return replacedPartInputSchema.parse(body ?? {}); }
function parseAssociatedReportInput(body) { return associatedReportInputSchema.parse(body ?? {}); }
function parseEventInput(body) { return eventInputSchema.parse(body ?? {}); }
function parseAttachmentInput(body) { return attachmentInputSchema.parse(body ?? {}); }
function parseCalendarGenerateInput(body) { return calendarGenerateInputSchema.parse(body ?? {}); }
function parseRecommendationInput(body) { return recommendationInputSchema.parse(body ?? {}); }
function parseRecommendationStatusInput(body) { return recommendationStatusInputSchema.parse(body ?? {}); }

module.exports = {
  parseMeasurementInput,
  parseReplacedPartInput,
  parseAssociatedReportInput,
  parseEventInput,
  parseAttachmentInput,
  parseCalendarGenerateInput,
  parseRecommendationInput,
  parseRecommendationStatusInput
};
