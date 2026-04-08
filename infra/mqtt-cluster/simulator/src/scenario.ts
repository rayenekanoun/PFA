import type { CapabilityDiscoveryCommand, DiagnosticCommand } from "./contracts";
import {
  buildCapabilityErrorResponse,
  buildCapabilitySuccessResponse,
  buildDiagnosticErrorResponse,
  buildDiagnosticSuccessResponse,
  type CapabilityResponse,
  type DiagnosticResponse,
} from "./contracts";

export type ScenarioOutcome<TResponse> =
  | {
      kind: "respond";
      delayMs: number;
      response: TResponse;
    }
  | {
      kind: "silent";
      reason: "timeout";
    };

export interface ScenarioOptions {
  maxDelayMs: number;
}

const SUPPORTED_PID_CODES = [
  "0104",
  "0105",
  "0106",
  "0107",
  "010B",
  "010C",
  "010D",
  "010F",
  "0110",
  "0111",
  "0142",
] as const;

const MEASUREMENT_LIBRARY: Record<
  string,
  {
    key: string;
    label: string;
    unit: string | null;
    raw: string;
    decoded: number | string | boolean;
  }
> = {
  "0104": {
    key: "engine_load",
    label: "Calculated Engine Load",
    unit: "%",
    raw: "41 04 42",
    decoded: 26,
  },
  "0105": {
    key: "coolant_temp_c",
    label: "Engine Coolant Temperature",
    unit: "C",
    raw: "41 05 85",
    decoded: 93,
  },
  "0106": {
    key: "short_term_fuel_trim_bank1",
    label: "Short Term Fuel Trim Bank 1",
    unit: "%",
    raw: "41 06 7C",
    decoded: -3.1,
  },
  "0107": {
    key: "long_term_fuel_trim_bank1",
    label: "Long Term Fuel Trim Bank 1",
    unit: "%",
    raw: "41 07 84",
    decoded: 3.1,
  },
  "010B": {
    key: "intake_manifold_pressure_kpa",
    label: "Intake Manifold Pressure",
    unit: "kPa",
    raw: "41 0B 1F",
    decoded: 31,
  },
  "010C": {
    key: "engine_rpm",
    label: "Engine RPM",
    unit: "rpm",
    raw: "41 0C 0D 70",
    decoded: 860,
  },
  "010D": {
    key: "vehicle_speed",
    label: "Vehicle Speed",
    unit: "km/h",
    raw: "41 0D 4E",
    decoded: 78,
  },
  "010F": {
    key: "intake_air_temp_c",
    label: "Intake Air Temperature",
    unit: "C",
    raw: "41 0F 48",
    decoded: 32,
  },
  "0110": {
    key: "maf_g_s",
    label: "Mass Air Flow",
    unit: "g/s",
    raw: "41 10 04 D8",
    decoded: 12.4,
  },
  "0111": {
    key: "throttle_position_pct",
    label: "Throttle Position",
    unit: "%",
    raw: "41 11 2F",
    decoded: 18.4,
  },
  "0142": {
    key: "control_module_voltage_v",
    label: "Control Module Voltage",
    unit: "V",
    raw: "41 42 35 E8",
    decoded: 13.8,
  },
};

export function buildDiagnosticScenarioOutcome(
  command: DiagnosticCommand,
  generatedAt: Date,
  options: ScenarioOptions,
): ScenarioOutcome<DiagnosticResponse> {
  const generatedAtIso = generatedAt.toISOString();
  const { requestId, carId } = command;
  const simulate = command.simulate ?? { mode: "success" as const };

  if (simulate.mode === "timeout") {
    return {
      kind: "silent",
      reason: "timeout",
    };
  }

  if (simulate.mode === "error") {
    return {
      kind: "respond",
      delayMs: 0,
      response: buildDiagnosticErrorResponse({
        requestId,
        planId: command.planId,
        carId,
        generatedAt: generatedAtIso,
        code: simulate.errorCode,
        message: simulate.message ?? defaultMessageForError(simulate.errorCode),
      }),
    };
  }

  if (simulate.mode === "delay" && simulate.delayMs > options.maxDelayMs) {
    return {
      kind: "respond",
      delayMs: 0,
      response: buildDiagnosticErrorResponse({
        requestId,
        planId: command.planId,
        carId,
        generatedAt: generatedAtIso,
        code: "INVALID_REQUEST",
        message: `delayMs exceeds max allowed value of ${options.maxDelayMs}.`,
      }),
    };
  }

  const measurements = buildMeasurements(command);
  const dtcs = (command.includeDtcs ?? true) ? buildDtcs() : [];

  return {
    kind: "respond",
    delayMs: simulate.mode === "delay" ? simulate.delayMs : 0,
    response: buildDiagnosticSuccessResponse({
      requestId,
      planId: command.planId,
      carId,
      generatedAt: generatedAtIso,
      measurements,
      dtcs,
    }),
  };
}

export function buildCapabilityScenarioOutcome(
  command: CapabilityDiscoveryCommand,
  generatedAt: Date,
): ScenarioOutcome<CapabilityResponse> {
  return {
    kind: "respond",
    delayMs: 0,
    response: buildCapabilitySuccessResponse({
      requestId: command.requestId,
      carId: command.carId,
      generatedAt: generatedAt.toISOString(),
      supportWindows: command.supportWindows ?? ["0100", "0120", "0140"],
      supportedPidCodes: [...SUPPORTED_PID_CODES],
    }),
  };
}

function buildMeasurements(command: DiagnosticCommand) {
  const requested = (command.pids ?? []).length > 0 ? command.pids ?? [] : defaultRequestedPids();

  return requested.map((requestedPid) => {
    const fullCode = `${requestedPid.mode}${requestedPid.pid}`.toUpperCase();
    const entry = MEASUREMENT_LIBRARY[fullCode];
    if (!entry) {
      return {
        mode: requestedPid.mode,
        pid: requestedPid.pid,
        key: requestedPid.key,
        label: requestedPid.key,
        unit: null,
        status: "unsupported" as const,
        raw: null,
        decoded: null,
      };
    }

    return {
      mode: requestedPid.mode,
      pid: requestedPid.pid,
      key: requestedPid.key || entry.key,
      label: entry.label,
      unit: entry.unit,
      status: "ok" as const,
      raw: entry.raw,
      decoded: entry.decoded,
    };
  });
}

function buildDtcs() {
  return [
    {
      code: "P0172",
      description: "System Too Rich",
      severity: "medium" as const,
      state: "stored" as const,
      sourceMode: "03",
    },
    {
      code: "P0420",
      description: "Catalyst Efficiency Below Threshold",
      severity: "low" as const,
      state: "pending" as const,
      sourceMode: "07",
    },
  ];
}

function defaultRequestedPids() {
  return [
    { key: "engine_rpm", mode: "01", pid: "0C" },
    { key: "vehicle_speed", mode: "01", pid: "0D" },
    { key: "coolant_temp_c", mode: "01", pid: "05" },
    { key: "maf_g_s", mode: "01", pid: "10" },
    { key: "control_module_voltage_v", mode: "01", pid: "42" },
  ];
}

function defaultMessageForError(errorCode: string): string {
  switch (errorCode) {
    case "OBD_TIMEOUT":
      return "OBD adapter did not return data in the expected time window.";
    case "ELM327_DISCONNECTED":
      return "ELM327 adapter appears disconnected.";
    case "UNSUPPORTED_PID":
      return "Requested PID is not supported by this vehicle.";
    case "INTERNAL_SIM_ERROR":
      return "Simulator encountered an internal processing error.";
    default:
      return "Simulator returned an unspecified error.";
  }
}
