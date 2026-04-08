import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DtcState, MeasurementStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DiagnosticDeviceResponse } from '../../mqtt/mqtt.contracts';
import type { RequestedPidDescriptor } from '../types/structured-diagnostic-summary.type';

@Injectable()
export class DiagnosticNormalizerService {
  public constructor(private readonly prisma: PrismaService) {}

  public async persistDiagnosticResponse(
    diagnosticRunId: string,
    response: DiagnosticDeviceResponse,
    requestedPids: RequestedPidDescriptor[],
    defaultMissingStatus: MeasurementStatus,
  ): Promise<{ measurementCount: number; dtcCount: number; missingKeys: string[] }> {
    const involvedFullCodes = new Set<string>(requestedPids.map((pid) => `${pid.mode}${pid.pid}`));
    for (const measurement of response.measurements) {
      involvedFullCodes.add(`${measurement.mode}${measurement.pid}`);
    }

    const catalogEntries = await this.prisma.obdPidCatalog.findMany({
      where: { fullCode: { in: [...involvedFullCodes] } },
    });
    const catalogByCode = new Map(catalogEntries.map((entry) => [entry.fullCode, entry]));
    const respondedKeys = new Set<string>();
    const measuredAt = new Date(response.generatedAt);

    await this.prisma.$transaction(async (tx) => {
      await tx.diagnosticMeasurement.deleteMany({ where: { diagnosticRunId } });
      await tx.diagnosticDtc.deleteMany({ where: { diagnosticRunId } });

      for (const measurement of response.measurements) {
        const fullCode = `${measurement.mode}${measurement.pid}`;
        const catalog = catalogByCode.get(fullCode);
        const decoded = measurement.decoded ?? null;
        respondedKeys.add(catalog?.key ?? measurement.key);

        await tx.diagnosticMeasurement.create({
          data: {
            id: randomUUID(),
            diagnosticRunId,
            pidCatalogId: catalog?.id,
            measurementKey: catalog?.key ?? measurement.key,
            label: measurement.label ?? catalog?.label ?? measurement.key,
            valueNumber: typeof decoded === 'number' ? decoded : null,
            valueText: typeof decoded === 'string' ? decoded : null,
            valueBoolean: typeof decoded === 'boolean' ? decoded : null,
            valueJson: decoded !== null && typeof decoded === 'object' ? (decoded as Prisma.InputJsonValue) : undefined,
            unit: measurement.unit ?? catalog?.unit ?? null,
            status: this.mapMeasurementStatus(measurement.status),
            rawValue: measurement.raw ?? null,
            measuredAt,
          },
        });
      }

      for (const pid of requestedPids) {
        if (respondedKeys.has(pid.key)) {
          continue;
        }

        const fullCode = `${pid.mode}${pid.pid}`;
        const catalog = catalogByCode.get(fullCode);
        await tx.diagnosticMeasurement.create({
          data: {
            id: randomUUID(),
            diagnosticRunId,
            pidCatalogId: catalog?.id,
            measurementKey: catalog?.key ?? pid.key,
            label: catalog?.label ?? pid.key,
            unit: catalog?.unit ?? null,
            status: defaultMissingStatus,
            rawValue: null,
            measuredAt,
          },
        });
      }

      for (const dtc of response.dtcs) {
        await tx.diagnosticDtc.create({
          data: {
            id: randomUUID(),
            diagnosticRunId,
            code: dtc.code,
            description: dtc.description,
            severity: dtc.severity ?? null,
            state: this.mapDtcState(dtc.state),
            sourceMode: dtc.sourceMode ?? null,
          },
        });
      }
    });

    const missingKeys = requestedPids
      .map((pid) => pid.key)
      .filter((key) => !respondedKeys.has(key));

    return {
      measurementCount: response.measurements.length,
      dtcCount: response.dtcs.length,
      missingKeys,
    };
  }

  private mapMeasurementStatus(status: 'ok' | 'unsupported' | 'timeout' | 'error'): MeasurementStatus {
    switch (status) {
      case 'ok':
        return MeasurementStatus.OK;
      case 'unsupported':
        return MeasurementStatus.UNSUPPORTED;
      case 'timeout':
        return MeasurementStatus.TIMEOUT;
      case 'error':
      default:
        return MeasurementStatus.ERROR;
    }
  }

  private mapDtcState(state: 'stored' | 'pending' | 'permanent'): DtcState {
    switch (state) {
      case 'pending':
        return DtcState.PENDING;
      case 'permanent':
        return DtcState.PERMANENT;
      case 'stored':
      default:
        return DtcState.STORED;
    }
  }
}
