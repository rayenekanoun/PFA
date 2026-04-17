export type AuthMode = 'login' | 'register';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Device {
  id: string;
  serialNumber: string;
  firmwareVersion: string | null;
  status: string;
  capabilitiesDiscoveredAt: string | null;
  lastSeenAt: string | null;
}

export interface Vehicle {
  id: string;
  mqttCarId: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  createdAt: string;
  device?: Device | null;
}

export interface DiagnosticProfile {
  code: string;
  name: string;
  description?: string | null;
  confidence?: number | null;
  rationale?: string | null;
}

export interface DiagnosticRunSummary {
  id: string;
  status: string;
  createdAt: string;
}

export interface DiagnosticRequestSummary {
  id: string;
  complaintText: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  hasReport: boolean;
  profile: DiagnosticProfile | null;
  latestRun: DiagnosticRunSummary | null;
  vehicle: {
    id: string;
    mqttCarId: string;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
  };
}

export interface DiagnosticMeasurement {
  key: string;
  label: string;
  value: number | string | boolean | Record<string, unknown> | null;
  unit: string | null;
  status: string;
}

export interface DiagnosticDtc {
  code: string;
  description: string;
  severity: string | null;
  state: string;
  system: string;
  humanTitle: string;
  humanExplanation: string;
}

export interface DiagnosticRunDetail {
  id: string;
  status: string;
  errorMessage: string | null;
  measurements: DiagnosticMeasurement[];
  dtcs: DiagnosticDtc[];
}

export interface DiagnosticRequestDetail {
  requestId: string;
  status: string;
  complaintText: string;
  createdAt: string;
  vehicle: {
    id: string;
    mqttCarId: string;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
  };
  profile: DiagnosticProfile | null;
  latestRun: DiagnosticRunDetail | null;
  plan: {
    includeDtcs: boolean;
    requestedMeasurements: Array<{ key: string; mode: string; pid: string }>;
    plannerNotes: string | null;
  } | null;
}

export interface ReportPayload {
  summary: string;
  possibleCauses: string[];
  nextSteps: string[];
  caveats: string[];
  confidence: number;
}

export interface ReportResponse {
  id: string;
  requestId: string;
  runId: string;
  createdAt: string;
  updatedAt: string;
  vehicle: {
    id: string;
    mqttCarId: string;
    vin: string | null;
  };
  profile: DiagnosticProfile | null;
  reportJson: ReportPayload;
  reportText: string;
}

export interface SupportedPidRow {
  id: string;
  isSupported: boolean;
  checkedAt: string;
  pid: {
    key: string;
    label: string;
    fullCode: string;
    unit: string | null;
  };
}

export interface SupportedPidResponse {
  vehicleId: string;
  lastDiscoveryAt: string | null;
  supportedPids: SupportedPidRow[];
}
