import type { CapabilityDiscoveryCommand, DiagnosticCommand } from "./contracts";
import {
  buildCapabilityErrorResponse,
  buildCapabilitySuccessResponse,
  buildDiagnosticErrorResponse,
  buildDiagnosticSuccessResponse,
  type CapabilityResponse,
  type DiagnosticResponse,
} from "./contracts";
import { MEASUREMENT_LIBRARY, SUPPORTED_PID_CODES } from "./mode01-reference";

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

export function buildDiagnosticScenarioOutcome(
  command: DiagnosticCommand,
  generatedAt: Date,
  options: ScenarioOptions,
): ScenarioOutcome<DiagnosticResponse> {
  const generatedAtIso = generatedAt.toISOString();
  const { requestId, deviceId, carId } = command;
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
        deviceId,
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
        deviceId,
        carId,
        generatedAt: generatedAtIso,
        code: "INVALID_REQUEST",
        message: `delayMs exceeds max allowed value of ${options.maxDelayMs}.`,
      }),
    };
  }

  const random = createRequestRandom(command, generatedAt);
  const measurements = buildMeasurements(command, random);
  const dtcs = (command.includeDtcs ?? true) ? buildDtcs() : [];

  return {
    kind: "respond",
    delayMs: simulate.mode === "delay" ? simulate.delayMs : 0,
    response: buildDiagnosticSuccessResponse({
      requestId,
      planId: command.planId,
      deviceId,
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
      deviceId: command.deviceId,
      carId: command.carId,
      generatedAt: generatedAt.toISOString(),
      supportWindows: command.supportWindows ?? ["0100", "0120", "0140"],
      supportedPidCodes: [...SUPPORTED_PID_CODES],
    }),
  };
}

function buildMeasurements(command: DiagnosticCommand, random: () => number) {
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
      decoded: randomizeMeasurement(entry.key, entry.decoded, random),
    };
  });
}

function randomizeMeasurement(
  key: string,
  baseValue: number | string | boolean | Record<string, unknown>,
  random: () => number,
): number | string | boolean | Record<string, unknown> {
  if (typeof baseValue === "number") {
    return randomNumberForKey(key, baseValue, random);
  }

  if (typeof baseValue === "string") {
    return randomStringForKey(key, baseValue, random);
  }

  if (typeof baseValue === "boolean") {
    return random() > 0.5;
  }

  return randomObjectForKey(key, baseValue, random);
}

function randomNumberForKey(key: string, fallback: number, random: () => number): number {
  switch (key) {
    case "coolant_temp_c":
      return randomInt(82, 112, random);
    case "coolant_temp_sensor_2_c":
      return randomInt(78, 108, random);
    case "engine_oil_temp_c":
      return randomInt(85, 126, random);
    case "intake_air_temp_c":
      return randomInt(18, 48, random);
    case "ambient_air_temp_c":
      return randomInt(15, 42, random);
    case "catalyst_temp_b1s1_c":
    case "catalyst_temp_b2s1_c":
    case "catalyst_temp_b1s2_c":
    case "catalyst_temp_b2s2_c":
      return randomInt(350, 780, random);
    case "fuel_pressure_kpa":
      return randomInt(240, 420, random);
    case "fuel_rail_pressure_relative_kpa":
      return randomInt(260, 550, random);
    case "fuel_rail_pressure_direct_kpa":
      return randomInt(3500, 16000, random);
    case "fuel_rail_absolute_pressure_kpa":
      return randomInt(4000, 18000, random);
    case "intake_manifold_pressure_kpa":
      return randomInt(20, 95, random);
    case "barometric_pressure_kpa":
      return randomInt(88, 103, random);
    case "engine_rpm":
      return randomInt(720, 3200, random);
    case "vehicle_speed":
      return randomInt(0, 130, random);
    case "engine_load":
    case "absolute_engine_load_pct":
    case "throttle_position_pct":
    case "relative_throttle_position_pct":
    case "absolute_throttle_position_b_pct":
    case "commanded_throttle_actuator_pct":
    case "relative_accelerator_pedal_pct":
    case "ethanol_fuel_pct":
    case "hybrid_battery_pack_life_pct":
    case "fuel_tank_level_pct":
    case "egr_commanded_pct":
      return roundTo(randomFloat(0, 100, random), 1);
    case "egr_error_pct":
      return roundTo(randomFloat(-18, 18, random), 1);
    case "timing_advance_deg":
      return roundTo(randomFloat(-2, 28, random), 1);
    case "maf_g_s":
      return roundTo(randomFloat(2, 65, random), 1);
    case "short_term_fuel_trim_bank1":
    case "long_term_fuel_trim_bank1":
    case "short_term_fuel_trim_bank2":
    case "long_term_fuel_trim_bank2":
      return roundTo(randomFloat(-18, 18, random), 1);
    case "runtime_since_engine_start_s":
      return randomInt(30, 5400, random);
    case "distance_with_mil_on_km":
    case "distance_since_codes_cleared_km":
      return randomInt(0, 1500, random);
    case "warmups_since_codes_cleared":
      return randomInt(0, 60, random);
    case "control_module_voltage_v":
      return roundTo(randomFloat(11.5, 14.7, random), 2);
    case "commanded_air_fuel_ratio_lambda":
      return roundTo(randomFloat(0.92, 1.08, random), 3);
    case "time_with_mil_on_min":
    case "time_since_codes_cleared_min":
      return randomInt(0, 3000, random);
    case "fuel_injection_timing_deg":
      return roundTo(randomFloat(-8, 18, random), 1);
    case "engine_fuel_rate_lph":
      return roundTo(randomFloat(0.6, 15, random), 2);
    default:
      return roundTo(randomFloat(Math.max(0, fallback * 0.7), Math.max(1, fallback * 1.3), random), 2);
  }
}

function randomStringForKey(key: string, fallback: string, random: () => number): string {
  switch (key) {
    case "freeze_frame_dtc":
      return pick(["P0172", "P0171", "P0300", "P0217", "P0420", "P0562"], random);
    case "secondary_air_status":
      return pick(["inactive", "upstream", "downstream", "commanded_on"], random);
    case "obd_standard":
      return pick(["OBD-II / EOBD", "EOBD", "OBD and OBD-II"], random);
    case "fuel_type":
      return pick(["Gasoline", "Diesel", "Flex fuel"], random);
    default:
      return fallback;
  }
}

function randomObjectForKey(
  key: string,
  fallback: Record<string, unknown>,
  random: () => number,
): Record<string, unknown> {
  switch (key) {
    case "monitor_status_mil":
      return {
        milOn: random() > 0.7,
        storedDtcCount: randomInt(0, 3, random),
        readiness: {
          misfire: random() > 0.15,
          fuelSystem: random() > 0.15,
          catalyst: random() > 0.25,
        },
      };
    case "fuel_system_status":
      return {
        bank1: pick(["open_loop", "closed_loop", "open_loop_fault"], random),
        bank2: pick(["open_loop", "closed_loop", "open_loop_fault"], random),
      };
    case "oxygen_sensors_present":
      return {
        bank1: randomInt(1, 2, random),
        bank2: randomInt(0, 2, random),
      };
    case "o2_sensor_b1s1":
    case "o2_sensor_b1s2":
    case "o2_sensor_b1s3":
    case "o2_sensor_b1s4":
    case "o2_sensor_b2s1":
    case "o2_sensor_b2s2":
      return {
        voltageV: roundTo(randomFloat(0.05, 0.95, random), 3),
        trimPct: roundTo(randomFloat(-18, 18, random), 1),
      };
    default:
      return fallback;
  }
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

function createRequestRandom(command: DiagnosticCommand, generatedAt: Date): () => number {
  const seedInput = `${command.requestId}|${command.carId}|${generatedAt.toISOString()}|${command.pids
    ?.map((pid) => `${pid.mode}${pid.pid}`)
    .join(",")}`;
  let seed = 0;
  for (const char of seedInput) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function randomFloat(min: number, max: number, random: () => number): number {
  return min + (max - min) * random();
}

function randomInt(min: number, max: number, random: () => number): number {
  return Math.floor(randomFloat(min, max + 1, random));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}
