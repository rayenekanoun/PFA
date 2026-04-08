import { Injectable } from '@nestjs/common';
import { type DiagnosticProfile, type DiagnosticRequest, type DiagnosticRun, type MeasurementStatus, type Prisma, type Vehicle } from '@prisma/client';
import type { RequestedPidDescriptor, StructuredDiagnosticSummary } from '../types/structured-diagnostic-summary.type';

interface BuildSummaryInput {
  request: DiagnosticRequest & {
    vehicle: Vehicle;
    classifiedProfile: DiagnosticProfile | null;
  };
  plan: {
    requestedPidsJson: unknown;
  };
  run: DiagnosticRun & {
    measurements: Array<{
      measurementKey: string;
      label: string;
      valueNumber: number | null;
      valueText: string | null;
      valueBoolean: boolean | null;
      valueJson: Prisma.JsonValue | null;
      unit: string | null;
      status: MeasurementStatus;
      rawValue: string | null;
    }>;
    dtcs: Array<{
      code: string;
      description: string;
      severity: string | null;
      state: string;
    }>;
  };
}

@Injectable()
export class DiagnosticSummaryService {
  public buildSummary(input: BuildSummaryInput): StructuredDiagnosticSummary {
    const requestedMeasurements = this.parseRequestedPids(input.plan.requestedPidsJson);
    const measurements = input.run.measurements.map((measurement) => ({
      key: measurement.measurementKey,
      label: measurement.label,
      value:
        measurement.valueNumber ??
        measurement.valueText ??
        measurement.valueBoolean ??
        measurement.valueJson ??
        null,
      unit: measurement.unit,
      status: measurement.status.toLowerCase(),
      rawValue: measurement.rawValue,
    }));
    const missing = measurements
      .filter((measurement) => measurement.status !== 'ok')
      .map((measurement) => measurement.key);

    const observations: string[] = [];
    const coolant = measurements.find((measurement) => measurement.key === 'coolant_temp_c' && typeof measurement.value === 'number');
    const voltage = measurements.find((measurement) => measurement.key === 'control_module_voltage_v' && typeof measurement.value === 'number');

    if (coolant && typeof coolant.value === 'number' && coolant.value >= 105) {
      observations.push(`Coolant temperature is elevated at ${coolant.value}${coolant.unit ? ` ${coolant.unit}` : ''}.`);
    }

    if (voltage && typeof voltage.value === 'number' && voltage.value < 12) {
      observations.push(`Control module voltage is low at ${voltage.value}${voltage.unit ? ` ${voltage.unit}` : ''}.`);
    }

    if (input.run.dtcs.length > 0) {
      observations.push(`The run reported ${input.run.dtcs.length} diagnostic trouble code(s).`);
    }

    if (missing.length > 0) {
      observations.push(`Some requested measurements were unavailable or unsuccessful: ${missing.join(', ')}.`);
    }

    return {
      requestId: input.request.id,
      runId: input.run.id,
      complaintText: input.request.complaintText,
      requestStatus: input.request.status,
      profile: input.request.classifiedProfile
        ? {
            code: input.request.classifiedProfile.code,
            name: input.request.classifiedProfile.name,
            confidence: input.request.classificationConfidence ?? null,
            rationale: input.request.classificationRationale ?? null,
          }
        : null,
      vehicle: {
        id: input.request.vehicle.id,
        mqttCarId: input.request.vehicle.mqttCarId,
        vin: input.request.vehicle.vin ?? null,
        make: input.request.vehicle.make ?? null,
        model: input.request.vehicle.model ?? null,
        year: input.request.vehicle.year ?? null,
      },
      requestedMeasurements,
      measurements,
      dtcs: input.run.dtcs.map((dtc) => ({
        code: dtc.code,
        description: dtc.description,
        severity: dtc.severity,
        state: dtc.state.toLowerCase(),
      })),
      missing,
      observations,
    };
  }

  private parseRequestedPids(value: unknown): RequestedPidDescriptor[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).key === 'string' &&
          typeof (entry as Record<string, unknown>).mode === 'string' &&
          typeof (entry as Record<string, unknown>).pid === 'string'
        ) {
          return {
            key: String((entry as Record<string, unknown>).key),
            mode: String((entry as Record<string, unknown>).mode),
            pid: String((entry as Record<string, unknown>).pid),
            priority: Number((entry as Record<string, unknown>).priority ?? 999),
          };
        }

        return null;
      })
      .filter((entry): entry is RequestedPidDescriptor => entry !== null)
      .sort((left, right) => left.priority - right.priority);
  }
}
