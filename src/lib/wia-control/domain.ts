import { z } from "zod";

export * from "@/lib/wia-control/domain-core";

export const shiftStatusSchema = z.enum([
  "PLANNED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "UNCOVERED",
  "COVERED",
  "CANCELLED",
]);

export const clockEventTypeSchema = z.enum([
  "CLOCK_IN",
  "BREAK_START",
  "BREAK_END",
  "CLOCK_OUT",
]);

export const clockMethodSchema = z.enum(["MOBILE", "QR", "PIN", "NFC", "KIOSK", "MANUAL"]);
export const incidentStatusSchema = z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]);
export const correctionStatusSchema = z.enum(["PENDING", "APPROVED", "DISPUTED", "REJECTED"]);

const identifier = z.string().trim().min(1).max(160);
const isoDateTime = z.string().datetime({ offset: true });
const coordinate = z.number().finite();

export const worksiteInputSchema = z.object({
  customerId: identifier.optional(),
  name: z.string().trim().min(2).max(140),
  address: z.string().trim().min(4).max(240),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(12).optional(),
  latitude: coordinate.min(-90).max(90).optional(),
  longitude: coordinate.min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(20).max(2_000).default(100),
  timezone: z.string().trim().min(3).max(80).default("Europe/Madrid"),
  verificationMode: z.enum(["QR_LOCATION", "QR", "PIN", "NFC", "LOCATION"]).default("QR_LOCATION"),
});

export const worksiteUpdateSchema = worksiteInputSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, "You must specify at least one change.");

export const plannedShiftInputSchema = z
  .object({
    worksiteId: identifier,
    employeeId: identifier.optional(),
    serviceId: identifier.optional(),
    title: z.string().trim().min(2).max(160),
    scheduledStart: isoDateTime,
    scheduledEnd: isoDateTime,
    requiredSkills: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    gracePeriodMinutes: z.number().int().min(0).max(120).default(5),
  })
  .superRefine((value, context) => {
    if (new Date(value.scheduledEnd).getTime() <= new Date(value.scheduledStart).getTime()) {
      context.addIssue({
        code: "custom",
        path: ["scheduledEnd"],
        message: "The end time must be later than the start time.",
      });
    }
  });

export const plannedShiftUpdateSchema = z
  .object({
    employeeId: identifier.nullable().optional(),
    title: z.string().trim().min(2).max(160).optional(),
    scheduledStart: isoDateTime.optional(),
    scheduledEnd: isoDateTime.optional(),
    requiredSkills: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    gracePeriodMinutes: z.number().int().min(0).max(120).optional(),
    status: z.literal("CANCELLED").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "You must specify at least one change.");

export const clockCommandSchema = z.object({
  shiftId: identifier,
  type: clockEventTypeSchema,
  method: clockMethodSchema.default("MOBILE"),
  occurredAt: isoDateTime,
  idempotencyKey: identifier,
  deviceId: z.string().trim().max(200).optional(),
  latitude: coordinate.min(-90).max(90).optional(),
  longitude: coordinate.min(-180).max(180).optional(),
  accuracyMeters: z.number().finite().min(0).max(10_000).optional(),
  isOffline: z.boolean().default(false),
});

export const correctionRequestSchema = z.object({
  clockEventId: identifier,
  proposedOccurredAt: isoDateTime,
  reason: z.string().trim().min(10).max(1_000),
});

export const correctionReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().min(5).max(1_000).optional(),
});

export const correctionAcknowledgementSchema = z
  .object({
    accepted: z.boolean(),
    disagreementReason: z.string().trim().min(10).max(1_000).optional(),
  })
  .superRefine((value, context) => {
    if (!value.accepted && !value.disagreementReason) {
      context.addIssue({
        code: "custom",
        path: ["disagreementReason"],
        message: "Explain the reason for the disagreement.",
      });
    }
  });

const incidentStatusUpdateSchema = z
  .object({
    status: z.enum(["ACKNOWLEDGED", "RESOLVED", "DISMISSED"]),
    resolutionNotes: z.string().trim().min(5).max(1_000).optional(),
  })
  .superRefine((value, context) => {
    if (["RESOLVED", "DISMISSED"].includes(value.status) && !value.resolutionNotes) {
      context.addIssue({
        code: "custom",
        path: ["resolutionNotes"],
        message: "The resolution requires a note.",
      });
    }
  });

const incidentAssignSchema = z.object({
  action: z.literal("ASSIGN"),
  // Omitted means "assign to me" — the server resolves it from the caller's
  // own identity rather than trusting a client-supplied id for that case.
  ownerId: z.string().min(1).optional(),
});

const incidentEscalateSchema = z.object({
  action: z.literal("ESCALATE"),
  note: z.string().trim().min(5).max(1_000),
});

/**
 * Stage 3: an incident update is either a status transition (unchanged
 * shape, kept backward compatible with the existing caller) or one of the
 * two new actions, assign and escalate.
 */
export const incidentUpdateSchema = z.union([
  incidentStatusUpdateSchema,
  incidentAssignSchema,
  incidentEscalateSchema,
]);

/**
 * Stage 5: a communication can be either resent by a coordinator (after
 * it has FAILED) or acknowledged by its recipient employee.
 */
export const communicationActionSchema = z.union([
  z.object({ action: z.literal("RESEND") }),
  z.object({ action: z.literal("ACKNOWLEDGE") }),
]);

/**
 * Closes the Stage 4 follow-up gap: lets an admin/manager configure the
 * exact fields the coverage-recommendation hard constraints depend on
 * (skills, zones, availability, working-time limits) from inside the
 * app, instead of only via direct database access. Every field is
 * optional so a partial update (e.g. only skills) never clears the rest.
 */
export const employeeProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(160).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  zones: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  availability: z
    .object({
      daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
      startMinute: z.number().int().min(0).max(1440).optional(),
      endMinute: z.number().int().min(0).max(1440).optional(),
    })
    .nullable()
    .optional(),
  maxHoursPerDay: z.number().int().min(1).max(24).nullable().optional(),
  maxJobsPerDay: z.number().int().min(1).max(50).nullable().optional(),
  fieldStatus: z.enum(["AVAILABLE", "ASSIGNED", "VACATION", "SICK_LEAVE", "INACTIVE"]).optional(),
});

/**
 * Creates a new employee -- both a login (Supabase Auth) and a company
 * profile (Postgres) -- from inside the app, closing the gap where an
 * employee could previously only be provisioned by direct database and
 * Supabase Admin API access.
 */
export const employeeCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  position: z.string().trim().max(80).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  zones: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

export const coverageDecisionSchema = z.object({
  shiftId: identifier,
  incidentId: identifier,
  selectedEmployeeId: identifier,
  overrideReason: z.string().trim().min(5).max(1_000).optional(),
});

export const coverageRecommendationSchema = z.object({
  incidentId: identifier,
});

export const companySettingsSchema = z.object({
  timezone: z.string().trim().min(3).max(80),
  clockRetentionYears: z.number().int().min(4).max(10),
  crmEnabled: z.boolean(),
  // Stage 3 incident policy. Optional so the existing settings form, which
  // does not send these, continues to work — omitted fields are left
  // untouched rather than reset to a default.
  lateSeverityThresholdMinutes: z.number().int().min(1).max(480).optional(),
  incidentDueMinutesCritical: z.number().int().min(5).max(10_080).optional(),
  incidentDueMinutesHigh: z.number().int().min(5).max(10_080).optional(),
  incidentDueMinutesMedium: z.number().int().min(5).max(10_080).optional(),
  incidentDueMinutesLow: z.number().int().min(5).max(10_080).optional(),
});

export type WorksiteInput = z.infer<typeof worksiteInputSchema>;
export type WorksiteUpdateInput = z.infer<typeof worksiteUpdateSchema>;
export type PlannedShiftInput = z.infer<typeof plannedShiftInputSchema>;
export type PlannedShiftUpdateInput = z.infer<typeof plannedShiftUpdateSchema>;
export type ClockCommand = z.infer<typeof clockCommandSchema>;
export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;
export type CorrectionReviewInput = z.infer<typeof correctionReviewSchema>;
export type CorrectionAcknowledgementInput = z.infer<typeof correctionAcknowledgementSchema>;
export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;
export type CoverageDecisionInput = z.infer<typeof coverageDecisionSchema>;
export type CoverageRecommendationInput = z.infer<typeof coverageRecommendationSchema>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
