import { Injectable } from '@nestjs/common';
import type { DiagnosticProfile } from '@prisma/client';
import type { RequestedPidDescriptor } from '../types/structured-diagnostic-summary.type';

interface BuildPlanInput {
  profile: DiagnosticProfile;
  supportedFullCodes: Set<string>;
}

@Injectable()
export class DiagnosticPlannerService {
  public buildPlan(input: BuildPlanInput): {
    requestedPids: RequestedPidDescriptor[];
    includeDtcs: boolean;
    plannerNotes: string;
  } {
    const requestedPids = this.parseRequestedPids(input.profile.defaultRequestedPidsJson)
      .filter((entry) => input.supportedFullCodes.has(`${entry.mode}${entry.pid}`))
      .sort((left, right) => left.priority - right.priority);

    const totalRequested = this.parseRequestedPids(input.profile.defaultRequestedPidsJson).length;
    const filteredOut = totalRequested - requestedPids.length;

    return {
      requestedPids,
      includeDtcs: input.profile.includeDtcsByDefault,
      plannerNotes:
        filteredOut > 0
          ? `Filtered ${filteredOut} unsupported PID(s) based on the stored capability matrix.`
          : 'All profile PIDs were supported by the vehicle capability matrix.',
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
      .filter((entry): entry is RequestedPidDescriptor => entry !== null);
  }
}
