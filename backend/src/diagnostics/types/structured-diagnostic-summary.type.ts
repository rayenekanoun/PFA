import type { Prisma } from '@prisma/client';

export interface RequestedPidDescriptor {
  key: string;
  mode: string;
  pid: string;
  priority: number;
}

export interface StructuredDiagnosticSummary {
  requestId: string;
  runId: string;
  complaintText: string;
  requestStatus: string;
  profile: {
    code: string;
    name: string;
    confidence: number | null;
    rationale: string | null;
  } | null;
  vehicle: {
    id: string;
    mqttCarId: string;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
  };
  requestedMeasurements: RequestedPidDescriptor[];
  measurements: Array<{
    key: string;
    label: string;
    value: number | string | boolean | Prisma.JsonValue | null;
    unit: string | null;
    status: string;
    rawValue: string | null;
  }>;
  dtcs: Array<{
    code: string;
    description: string;
    severity: string | null;
    state: string;
  }>;
  missing: string[];
  observations: string[];
}
