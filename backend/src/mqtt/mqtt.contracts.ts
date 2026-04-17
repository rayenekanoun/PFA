import { z } from 'zod';

export const diagnosticMeasurementResponseSchema = z.object({
  mode: z.string().min(1),
  pid: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1).optional(),
  unit: z.string().min(1).optional().nullable(),
  status: z.enum(['ok', 'unsupported', 'timeout', 'error']),
  raw: z.string().min(1).optional().nullable(),
  decoded: z.union([z.number(), z.string(), z.boolean(), z.record(z.string(), z.unknown())]).optional().nullable(),
});

export const diagnosticDtcResponseSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  severity: z.string().optional().nullable(),
  state: z.enum(['stored', 'pending', 'permanent']).default('stored'),
  sourceMode: z.string().optional().nullable(),
});

export const diagnosticDeviceResponseSchema = z.object({
  requestId: z.string().min(1),
  planId: z.string().optional(),
  deviceId: z.string().min(1),
  carId: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  simulated: z.boolean().optional(),
  status: z.enum(['ok', 'error']),
  measurements: z.array(diagnosticMeasurementResponseSchema).default([]),
  dtcs: z.array(diagnosticDtcResponseSchema).default([]),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1),
    })
    .optional(),
});

export const capabilityDiscoveryResponseSchema = z.object({
  requestId: z.string().min(1),
  deviceId: z.string().min(1),
  carId: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  simulated: z.boolean().optional(),
  status: z.enum(['ok', 'error']),
  supportedPidCodes: z.array(z.string().min(1)).default([]),
  supportWindows: z.array(z.string().min(1)).default([]),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1),
    })
    .optional(),
});

export type DiagnosticDeviceResponse = z.infer<typeof diagnosticDeviceResponseSchema>;
export type CapabilityDiscoveryResponse = z.infer<typeof capabilityDiscoveryResponseSchema>;

export interface PublishDiagnosticCommandInput {
  requestId: string;
  planId: string;
  deviceId: string;
  carId: string;
  correlationId: string;
  includeDtcs: boolean;
  timeoutMs: number;
  pids: Array<{ key: string; mode: string; pid: string }>;
  simulate?: {
    mode: 'success' | 'delay' | 'error' | 'timeout';
    delayMs?: number;
    errorCode?: 'OBD_TIMEOUT' | 'ELM327_DISCONNECTED' | 'UNSUPPORTED_PID' | 'INTERNAL_SIM_ERROR';
    message?: string;
  };
}

export interface PublishCapabilityDiscoveryInput {
  requestId: string;
  deviceId: string;
  carId: string;
  correlationId: string;
  supportWindows: string[];
}
