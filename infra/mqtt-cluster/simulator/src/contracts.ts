import { z } from "zod";

const REQUEST_ID_SCHEMA = z.string().min(1).max(128);
const CAR_ID_SCHEMA = z.string().min(1).max(128);
const SIMPLE_ID_SCHEMA = z.string().min(1).max(128);

export const SIMULATE_MODE_VALUES = [
  "success",
  "delay",
  "error",
  "timeout",
] as const;

export const SIMULATOR_ERROR_CODE_VALUES = [
  "OBD_TIMEOUT",
  "ELM327_DISCONNECTED",
  "UNSUPPORTED_PID",
  "INTERNAL_SIM_ERROR",
] as const;

export const RESPONSE_ERROR_CODE_VALUES = [
  ...SIMULATOR_ERROR_CODE_VALUES,
  "INVALID_REQUEST",
] as const;

export const SimulateModeSchema = z.enum(SIMULATE_MODE_VALUES);
export const SimulatorErrorCodeSchema = z.enum(SIMULATOR_ERROR_CODE_VALUES);
export const ResponseErrorCodeSchema = z.enum(RESPONSE_ERROR_CODE_VALUES);

const RequestedPidSchema = z
  .object({
    key: z.string().min(1).max(128),
    mode: z.string().min(1).max(8),
    pid: z.string().min(1).max(8),
  })
  .strict();

const SimulateSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("success") }).strict(),
  z.object({ mode: z.literal("timeout") }).strict(),
  z
    .object({
      mode: z.literal("delay"),
      delayMs: z.number().int().min(1).max(30_000),
    })
    .strict(),
  z
    .object({
      mode: z.literal("error"),
      errorCode: SimulatorErrorCodeSchema,
      message: z.string().min(1).max(400).optional(),
    })
    .strict(),
]);

export const DiagnosticCommandSchema = z
  .object({
    requestId: REQUEST_ID_SCHEMA,
    planId: SIMPLE_ID_SCHEMA.optional(),
    carId: CAR_ID_SCHEMA,
    type: z.literal("diagnostic"),
    correlationId: SIMPLE_ID_SCHEMA.optional(),
    includeDtcs: z.boolean().default(true),
    timeoutMs: z.number().int().min(1).max(120_000).optional(),
    pids: z.array(RequestedPidSchema).default([]),
    simulate: SimulateSchema.optional().default({ mode: "success" }),
  })
  .strict();

export const CapabilityDiscoveryCommandSchema = z
  .object({
    requestId: REQUEST_ID_SCHEMA,
    carId: CAR_ID_SCHEMA,
    type: z.literal("capability_discovery"),
    correlationId: SIMPLE_ID_SCHEMA.optional(),
    supportWindows: z
      .array(z.string().regex(/^01[0-9A-F]{2}$/i))
      .min(1)
      .default(["0100", "0120", "0140"]),
  })
  .strict();

export const DiagnosticMeasurementSchema = z
  .object({
    mode: z.string().min(1).max(8),
    pid: z.string().min(1).max(8),
    key: z.string().min(1).max(128),
    label: z.string().min(1).max(240),
    unit: z.string().min(1).max(32).nullable().optional(),
    status: z.enum(["ok", "unsupported", "timeout", "error"]),
    raw: z.string().min(1).max(240).nullable().optional(),
    decoded: z.union([z.number(), z.string(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())]).nullable().optional(),
  })
  .strict();

export const DiagnosticDtcSchema = z
  .object({
    code: z.string().min(1).max(16),
    description: z.string().min(1).max(240),
    severity: z.enum(["low", "medium", "high"]).nullable().optional(),
    state: z.enum(["stored", "pending", "permanent"]).default("stored"),
    sourceMode: z.string().min(1).max(8).nullable().optional(),
  })
  .strict();

const ResponseBaseSchema = z
  .object({
    requestId: REQUEST_ID_SCHEMA,
    carId: CAR_ID_SCHEMA,
    generatedAt: z.string().datetime({ offset: true }),
    simulated: z.literal(true),
  })
  .strict();

export const DiagnosticSuccessResponseSchema = ResponseBaseSchema.extend({
  planId: SIMPLE_ID_SCHEMA.optional(),
  status: z.literal("ok"),
  measurements: z.array(DiagnosticMeasurementSchema).default([]),
  dtcs: z.array(DiagnosticDtcSchema).default([]),
}).strict();

export const DiagnosticErrorResponseSchema = ResponseBaseSchema.extend({
  planId: SIMPLE_ID_SCHEMA.optional(),
  status: z.literal("error"),
  measurements: z.array(DiagnosticMeasurementSchema).default([]),
  dtcs: z.array(DiagnosticDtcSchema).default([]),
  error: z
    .object({
      code: ResponseErrorCodeSchema,
      message: z.string().min(1).max(500),
    })
    .strict(),
}).strict();

export const DiagnosticResponseSchema = z.discriminatedUnion("status", [
  DiagnosticSuccessResponseSchema,
  DiagnosticErrorResponseSchema,
]);

export const CapabilitySuccessResponseSchema = ResponseBaseSchema.extend({
  status: z.literal("ok"),
  supportWindows: z.array(z.string().regex(/^01[0-9A-F]{2}$/i)).default([]),
  supportedPidCodes: z.array(z.string().regex(/^01[0-9A-F]{2}$/i)).default([]),
}).strict();

export const CapabilityErrorResponseSchema = ResponseBaseSchema.extend({
  status: z.literal("error"),
  supportWindows: z.array(z.string().regex(/^01[0-9A-F]{2}$/i)).default([]),
  supportedPidCodes: z.array(z.string().regex(/^01[0-9A-F]{2}$/i)).default([]),
  error: z
    .object({
      code: ResponseErrorCodeSchema,
      message: z.string().min(1).max(500),
    })
    .strict(),
}).strict();

export const CapabilityResponseSchema = z.discriminatedUnion("status", [
  CapabilitySuccessResponseSchema,
  CapabilityErrorResponseSchema,
]);

export type DiagnosticCommand = z.input<typeof DiagnosticCommandSchema>;
export type CapabilityDiscoveryCommand = z.input<typeof CapabilityDiscoveryCommandSchema>;
export type DiagnosticResponse = z.output<typeof DiagnosticResponseSchema>;
export type CapabilityResponse = z.output<typeof CapabilityResponseSchema>;

type ParseResult<TCommand> =
  | { ok: true; command: TCommand }
  | { ok: false; requestId: string; carId: string; reason: string };

export function diagnosticResponseTopicForCar(carId: string): string {
  return `cars/${carId}/telemetry/diagnostic/response`;
}

export function capabilityResponseTopicForCar(carId: string): string {
  return `cars/${carId}/telemetry/capabilities/response`;
}

export function parseDiagnosticCommandFromPayload(
  payloadText: string,
  topicCarId: string,
): ParseResult<DiagnosticCommand> {
  return parseCommandFromPayload(payloadText, topicCarId, DiagnosticCommandSchema);
}

export function parseCapabilityCommandFromPayload(
  payloadText: string,
  topicCarId: string,
): ParseResult<CapabilityDiscoveryCommand> {
  return parseCommandFromPayload(payloadText, topicCarId, CapabilityDiscoveryCommandSchema);
}

export function buildDiagnosticSuccessResponse(input: {
  requestId: string;
  planId?: string;
  carId: string;
  generatedAt: string;
  measurements: z.infer<typeof DiagnosticMeasurementSchema>[];
  dtcs: z.infer<typeof DiagnosticDtcSchema>[];
}): z.infer<typeof DiagnosticSuccessResponseSchema> {
  return DiagnosticSuccessResponseSchema.parse({
    requestId: input.requestId,
    planId: input.planId,
    carId: input.carId,
    status: "ok",
    generatedAt: input.generatedAt,
    simulated: true,
    measurements: input.measurements,
    dtcs: input.dtcs,
  });
}

export function buildDiagnosticErrorResponse(input: {
  requestId: string;
  planId?: string;
  carId: string;
  generatedAt: string;
  code: z.infer<typeof ResponseErrorCodeSchema>;
  message: string;
}): z.infer<typeof DiagnosticErrorResponseSchema> {
  return DiagnosticErrorResponseSchema.parse({
    requestId: input.requestId,
    planId: input.planId,
    carId: input.carId,
    status: "error",
    generatedAt: input.generatedAt,
    simulated: true,
    measurements: [],
    dtcs: [],
    error: {
      code: input.code,
      message: input.message,
    },
  });
}

export function buildCapabilitySuccessResponse(input: {
  requestId: string;
  carId: string;
  generatedAt: string;
  supportWindows: string[];
  supportedPidCodes: string[];
}): z.infer<typeof CapabilitySuccessResponseSchema> {
  return CapabilitySuccessResponseSchema.parse({
    requestId: input.requestId,
    carId: input.carId,
    status: "ok",
    generatedAt: input.generatedAt,
    simulated: true,
    supportWindows: input.supportWindows,
    supportedPidCodes: input.supportedPidCodes,
  });
}

export function buildCapabilityErrorResponse(input: {
  requestId: string;
  carId: string;
  generatedAt: string;
  supportWindows: string[];
  code: z.infer<typeof ResponseErrorCodeSchema>;
  message: string;
}): z.infer<typeof CapabilityErrorResponseSchema> {
  return CapabilityErrorResponseSchema.parse({
    requestId: input.requestId,
    carId: input.carId,
    status: "error",
    generatedAt: input.generatedAt,
    simulated: true,
    supportWindows: input.supportWindows,
    supportedPidCodes: [],
    error: {
      code: input.code,
      message: input.message,
    },
  });
}

function parseCommandFromPayload<TCommand extends { carId: string }>(
  payloadText: string,
  topicCarId: string,
  schema: z.ZodType<TCommand>,
): ParseResult<TCommand> {
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(payloadText);
  } catch {
    return {
      ok: false,
      requestId: `invalid-${Date.now()}`,
      carId: topicCarId,
      reason: "Payload is not valid JSON.",
    };
  }

  const requestId = extractStringValue(rawPayload, "requestId") ?? `invalid-${Date.now()}`;
  const payloadCarId = extractStringValue(rawPayload, "carId");

  if (typeof payloadCarId === "string" && payloadCarId !== topicCarId) {
    return {
      ok: false,
      requestId,
      carId: topicCarId,
      reason: `Payload carId '${payloadCarId}' does not match topic carId '${topicCarId}'.`,
    };
  }

  const parsed = schema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      requestId,
      carId: topicCarId,
      reason: formatZodIssues(parsed.error.issues),
    };
  }

  if (parsed.data.carId !== topicCarId) {
    return {
      ok: false,
      requestId,
      carId: topicCarId,
      reason: `Payload carId '${parsed.data.carId}' does not match topic carId '${topicCarId}'.`,
    };
  }

  return { ok: true, command: parsed.data };
}

function extractStringValue(rawPayload: unknown, fieldName: string): string | undefined {
  if (typeof rawPayload !== "object" || rawPayload === null) {
    return undefined;
  }

  const candidate = (rawPayload as Record<string, unknown>)[fieldName];
  return typeof candidate === "string" ? candidate : undefined;
}

function formatZodIssues(issues: z.ZodIssue[]): string {
  if (issues.length === 0) {
    return "Invalid request payload.";
  }

  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
