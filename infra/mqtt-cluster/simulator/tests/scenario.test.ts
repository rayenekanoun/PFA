import { describe, expect, it } from "vitest";
import { buildCapabilityScenarioOutcome, buildDiagnosticScenarioOutcome } from "../src/scenario";
import type { CapabilityDiscoveryCommand, DiagnosticCommand } from "../src/contracts";

const baseDiagnosticCommand = {
  requestId: "req-300",
  carId: "car-3",
  type: "diagnostic",
  includeDtcs: true,
  pids: [{ key: "engine_rpm", mode: "01", pid: "0C" }],
} as const satisfies Omit<DiagnosticCommand, "simulate">;

describe("Diagnostic scenario engine", () => {
  it("returns success response for success mode", () => {
    const command: DiagnosticCommand = {
      ...baseDiagnosticCommand,
      simulate: {
        mode: "success",
      },
    };

    const result = buildDiagnosticScenarioOutcome(command, new Date("2026-01-01T00:00:00.000Z"), {
      maxDelayMs: 30_000,
    });

    expect(result.kind).toBe("respond");
    if (result.kind === "respond") {
      expect(result.delayMs).toBe(0);
      expect(result.response.status).toBe("ok");
      if (result.response.status === "ok") {
        expect(result.response.measurements).toHaveLength(1);
        expect(result.response.measurements[0]?.key).toBe("engine_rpm");
      }
    }
  });

  it("returns delayed success response for delay mode", () => {
    const command: DiagnosticCommand = {
      ...baseDiagnosticCommand,
      requestId: "req-301",
      simulate: {
        mode: "delay",
        delayMs: 1500,
      },
    };

    const result = buildDiagnosticScenarioOutcome(command, new Date("2026-01-01T00:00:00.000Z"), {
      maxDelayMs: 30_000,
    });

    expect(result.kind).toBe("respond");
    if (result.kind === "respond") {
      expect(result.delayMs).toBe(1500);
      expect(result.response.status).toBe("ok");
    }
  });

  it("returns error response for error mode", () => {
    const command: DiagnosticCommand = {
      ...baseDiagnosticCommand,
      requestId: "req-302",
      simulate: {
        mode: "error",
        errorCode: "ELM327_DISCONNECTED",
        message: "Adapter disconnected.",
      },
    };

    const result = buildDiagnosticScenarioOutcome(command, new Date("2026-01-01T00:00:00.000Z"), {
      maxDelayMs: 30_000,
    });

    expect(result.kind).toBe("respond");
    if (result.kind === "respond") {
      expect(result.response.status).toBe("error");
      if (result.response.status === "error") {
        expect(result.response.error.code).toBe("ELM327_DISCONNECTED");
      }
    }
  });

  it("returns no response for timeout mode", () => {
    const command: DiagnosticCommand = {
      ...baseDiagnosticCommand,
      requestId: "req-303",
      simulate: {
        mode: "timeout",
      },
    };

    const result = buildDiagnosticScenarioOutcome(command, new Date("2026-01-01T00:00:00.000Z"), {
      maxDelayMs: 30_000,
    });

    expect(result.kind).toBe("silent");
  });
});

describe("Capability scenario engine", () => {
  it("returns supported pid codes for capability discovery", () => {
    const command: CapabilityDiscoveryCommand = {
      requestId: "req-400",
      carId: "car-4",
      type: "capability_discovery",
      supportWindows: ["0100", "0120"],
    };

    const result = buildCapabilityScenarioOutcome(command, new Date("2026-01-01T00:00:00.000Z"));
    expect(result.kind).toBe("respond");
    if (result.kind === "respond") {
      expect(result.response.status).toBe("ok");
      if (result.response.status === "ok") {
        expect(result.response.supportedPidCodes).toContain("010C");
      }
    }
  });
});
