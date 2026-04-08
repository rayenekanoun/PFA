import { describe, expect, it } from "vitest";
import {
  buildCapabilitySuccessResponse,
  buildDiagnosticErrorResponse,
  buildDiagnosticSuccessResponse,
  CapabilityDiscoveryCommandSchema,
  CapabilityResponseSchema,
  DiagnosticCommandSchema,
  DiagnosticResponseSchema,
  parseCapabilityCommandFromPayload,
  parseDiagnosticCommandFromPayload,
} from "../src/contracts";

describe("Diagnostic command contract", () => {
  it("accepts a valid diagnostic command with planner metadata", () => {
    const payload = {
      requestId: "req-100",
      planId: "plan-100",
      correlationId: "run-100",
      carId: "car-1",
      type: "diagnostic",
      includeDtcs: true,
      pids: [
        { key: "engine_rpm", mode: "01", pid: "0C" },
        { key: "vehicle_speed", mode: "01", pid: "0D" },
      ],
    };

    const parsed = DiagnosticCommandSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("defaults simulate mode to success when omitted", () => {
    const payload = {
      requestId: "req-101",
      carId: "car-1",
      type: "diagnostic",
      pids: [],
    };

    const parsed = DiagnosticCommandSchema.parse(payload);
    expect(parsed.simulate.mode).toBe("success");
  });

  it("rejects payload when topic carId differs", () => {
    const payloadText = JSON.stringify({
      requestId: "req-102",
      carId: "car-A",
      type: "diagnostic",
      pids: [],
    });

    const result = parseDiagnosticCommandFromPayload(payloadText, "car-B");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("does not match topic carId");
    }
  });
});

describe("Capability discovery contract", () => {
  it("accepts a valid capability discovery command", () => {
    const payload = {
      requestId: "req-200",
      carId: "car-2",
      type: "capability_discovery",
      supportWindows: ["0100", "0120"],
    };

    const parsed = CapabilityDiscoveryCommandSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed capability command payloads", () => {
    const payload = {
      requestId: "req-201",
      type: "capability_discovery",
    };

    const parsed = CapabilityDiscoveryCommandSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects capability payload when topic carId differs", () => {
    const payloadText = JSON.stringify({
      requestId: "req-202",
      carId: "car-A",
      type: "capability_discovery",
      supportWindows: ["0100"],
    });

    const result = parseCapabilityCommandFromPayload(payloadText, "car-B");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("does not match topic carId");
    }
  });
});

describe("Response contracts", () => {
  it("accepts valid diagnostic success response shape", () => {
    const response = buildDiagnosticSuccessResponse({
      requestId: "req-300",
      planId: "plan-300",
      carId: "car-3",
      generatedAt: new Date().toISOString(),
      measurements: [
        {
          mode: "01",
          pid: "0C",
          key: "engine_rpm",
          label: "Engine RPM",
          unit: "rpm",
          status: "ok",
          raw: "41 0C 0D 70",
          decoded: 860,
        },
      ],
      dtcs: [],
    });

    const parsed = DiagnosticResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });

  it("accepts valid diagnostic error response shape", () => {
    const response = buildDiagnosticErrorResponse({
      requestId: "req-301",
      carId: "car-3",
      generatedAt: new Date().toISOString(),
      code: "OBD_TIMEOUT",
      message: "Timeout while reading OBD data.",
    });

    const parsed = DiagnosticResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });

  it("accepts valid capability success response shape", () => {
    const response = buildCapabilitySuccessResponse({
      requestId: "req-400",
      carId: "car-4",
      generatedAt: new Date().toISOString(),
      supportWindows: ["0100", "0120"],
      supportedPidCodes: ["010C", "010D", "0110"],
    });

    const parsed = CapabilityResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });
});
