import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  DiagnosticRequestStatus,
  DiagnosticRunStatus,
  MeasurementStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AiService } from '../ai/ai.service';
import {
  DIAGNOSTICS_QUEUE,
  JOB_EXECUTE_DIAGNOSTIC_REQUEST,
  JOB_GENERATE_DIAGNOSTIC_REPORT,
} from '../common/queue.constants';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { MqttService } from '../mqtt/mqtt.service';
import { PidCatalogService } from '../pid-catalog/pid-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ReportsService } from '../reports/reports.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { CreateDiagnosticRequestDto } from './dto/create-diagnostic-request.dto';
import { DiagnosticNormalizerService } from './services/diagnostic-normalizer.service';
import { DiagnosticPlannerService } from './services/diagnostic-planner.service';
import { DiagnosticSummaryService } from './services/diagnostic-summary.service';
import { explainDtc } from './utils/dtc-explainer.util';

@Injectable()
export class DiagnosticsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly vehiclesService: VehiclesService,
    private readonly profilesService: ProfilesService,
    private readonly pidCatalogService: PidCatalogService,
    private readonly mqttService: MqttService,
    private readonly aiService: AiService,
    private readonly reportsService: ReportsService,
    private readonly plannerService: DiagnosticPlannerService,
    private readonly normalizerService: DiagnosticNormalizerService,
    private readonly summaryService: DiagnosticSummaryService,
    @InjectQueue(DIAGNOSTICS_QUEUE) private readonly diagnosticsQueue: Queue,
  ) {}

  public async createRequest(user: AuthenticatedUser, dto: CreateDiagnosticRequestDto) {
    const vehicle = await this.vehiclesService.getVehicle(user, dto.vehicleId);
    if (!vehicle.device) {
      throw new BadRequestException('A vehicle must have a linked device before diagnostics can run.');
    }

    const request = await this.prisma.diagnosticRequest.create({
      data: {
        userId: user.sub,
        vehicleId: dto.vehicleId,
        complaintText: dto.complaintText,
        status: DiagnosticRequestStatus.CREATED,
      },
    });

    await this.diagnosticsQueue.add(
      JOB_EXECUTE_DIAGNOSTIC_REQUEST,
      { requestId: request.id },
      {
        jobId: `diagnostic-${request.id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    return {
      requestId: request.id,
      status: request.status,
      pollingUrl: `/api/diagnostic-requests/${request.id}`,
    };
  }

  public async listRequests(user: AuthenticatedUser) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();

    const requests = await this.prisma.diagnosticRequest.findMany({
      where: user.role === UserRole.ADMIN || bypassOwnership ? undefined : { userId: user.sub },
      include: {
        vehicle: true,
        classifiedProfile: true,
        report: true,
        plan: {
          include: {
            runs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => ({
      id: request.id,
      complaintText: request.complaintText,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      completedAt: request.completedAt,
      vehicle: {
        id: request.vehicle.id,
        mqttCarId: request.vehicle.mqttCarId,
        vin: request.vehicle.vin,
        make: request.vehicle.make,
        model: request.vehicle.model,
        year: request.vehicle.year,
      },
      profile: request.classifiedProfile,
      latestRun: request.plan?.runs[0] ?? null,
      hasReport: !!request.report,
    }));
  }

  public async getRequestDetail(user: AuthenticatedUser, requestId: string) {
    const request = await this.getOwnedRequest(user, requestId);
    return this.serializeRequestDetail(request);
  }

  public async getRunDetail(user: AuthenticatedUser, runId: string) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();

    const run = await this.prisma.diagnosticRun.findUnique({
      where: { id: runId },
      include: {
        diagnosticPlan: {
          include: {
            diagnosticRequest: {
              include: {
                vehicle: true,
              },
            },
          },
        },
        measurements: {
          orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }],
        },
        dtcs: true,
      },
    });

    if (!run) {
      throw new NotFoundException('Diagnostic run not found.');
    }

    const request = run.diagnosticPlan.diagnosticRequest;
    if (user.role !== UserRole.ADMIN && !bypassOwnership && request.userId !== user.sub) {
      throw new ForbiddenException('You do not have access to this diagnostic run.');
    }

      return {
        id: run.id,
        status: run.status,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      respondedAt: run.respondedAt,
      createdAt: run.createdAt,
      vehicle: {
        id: request.vehicle.id,
        mqttCarId: request.vehicle.mqttCarId,
      },
      measurements: run.measurements,
        dtcs: run.dtcs.map((dtc) => ({
          ...dtc,
          ...explainDtc(dtc.code, dtc.description),
        })),
        rawResponseJson: run.rawResponseJson,
        mqttCommandJson: run.mqttCommandJson,
      };
  }

  public async handleCapabilityDiscoveryJob(input: { vehicleId: string; deviceId?: string }) {
    const vehicle = await this.vehiclesService.getVehicleForExecution(input.vehicleId);
    const requestId = `cap-${vehicle.id}-${Date.now()}`;
    const response = await this.mqttService.publishCapabilityDiscovery({
      requestId,
      carId: vehicle.mqttCarId,
      correlationId: input.deviceId ?? vehicle.device!.id,
      supportWindows: ['0100', '0120', '0140'],
    });

    if (response.status === 'error') {
      await this.prisma.device.update({
        where: { vehicleId: vehicle.id },
        data: {
          capabilitiesResponseJson: response as Prisma.InputJsonValue,
        },
      });
      throw new ConflictException(response.error?.message ?? 'Capability discovery failed.');
    }

    await this.pidCatalogService.upsertVehicleSupportMatrix(vehicle.id, response.supportedPidCodes);
    await this.prisma.device.update({
      where: { vehicleId: vehicle.id },
      data: {
        capabilitiesDiscoveredAt: new Date(response.generatedAt),
        capabilitiesResponseJson: response as Prisma.InputJsonValue,
        lastSeenAt: new Date(response.generatedAt),
      },
    });

    return {
      vehicleId: vehicle.id,
      supportedCount: response.supportedPidCodes.length,
    };
  }

  public async handleExecuteDiagnosticRequestJob(input: { requestId: string }) {
    let runId: string | null = null;

    try {
      const request = await this.prisma.diagnosticRequest.findUnique({
        where: { id: input.requestId },
        include: {
          vehicle: {
            include: { device: true },
          },
        },
      });

      if (!request) {
        throw new NotFoundException('Diagnostic request not found.');
      }

      if (!request.vehicle.device) {
        throw new BadRequestException('Vehicle has no linked device.');
      }

      const staleHours = this.configService.get<number>('SUPPORTED_PID_STALE_HOURS', 24);
      const hasFreshCapabilities = await this.pidCatalogService.hasFreshSupportedPids(request.vehicleId, staleHours);
      if (!hasFreshCapabilities) {
        await this.prisma.diagnosticRequest.update({
          where: { id: request.id },
          data: { status: DiagnosticRequestStatus.DISCOVERING_CAPABILITIES },
        });
        await this.handleCapabilityDiscoveryJob({
          vehicleId: request.vehicleId,
          deviceId: request.vehicle.device.id,
        });
      }

      const candidateProfiles = await this.profilesService.listCandidateProfilesForComplaint(
        request.complaintText,
        48,
      );
      if (candidateProfiles.length === 0) {
        throw new ConflictException('No diagnostic profiles are available in the database.');
      }

      const classification = await this.aiService.classifyComplaint({
        complaintText: request.complaintText,
        availableProfiles: candidateProfiles.map((profile) => ({
          code: profile.code,
          name: profile.name,
          description: profile.description,
        })),
      });

      const selectedProfile =
        (await this.profilesService.findByCode(classification.profileCode)) ?? candidateProfiles[0];
      const supportedFullCodes = await this.pidCatalogService.getSupportedCodesForVehicle(request.vehicleId);
      const plan = this.plannerService.buildPlan({
        profile: selectedProfile,
        supportedFullCodes,
      });

      if (plan.requestedPids.length === 0 && !plan.includeDtcs) {
        throw new ConflictException('The selected profile produced no supported PIDs for this vehicle.');
      }

      const savedPlan = await this.prisma.diagnosticPlan.upsert({
        where: { diagnosticRequestId: request.id },
        update: {
          profileId: selectedProfile.id,
          requestedPidsJson: plan.requestedPids as unknown as Prisma.InputJsonValue,
          includeDtcs: plan.includeDtcs,
          plannerNotes: plan.plannerNotes,
        },
        create: {
          diagnosticRequestId: request.id,
          profileId: selectedProfile.id,
          requestedPidsJson: plan.requestedPids as unknown as Prisma.InputJsonValue,
          includeDtcs: plan.includeDtcs,
          plannerNotes: plan.plannerNotes,
        },
      });

      await this.prisma.diagnosticRequest.update({
        where: { id: request.id },
        data: {
          classifiedProfileId: selectedProfile.id,
          classificationConfidence: classification.confidence,
          classificationRationale: classification.rationale,
          status: DiagnosticRequestStatus.PLANNED,
        },
      });

      const run = await this.prisma.diagnosticRun.create({
        data: {
          diagnosticPlanId: savedPlan.id,
          deviceId: request.vehicle.device.id,
          mqttJobId: `mqtt-${request.id}-${Date.now()}`,
          status: DiagnosticRunStatus.QUEUED,
        },
      });
      runId = run.id;

      const mqttCommand = {
        requestId: request.id,
        planId: savedPlan.id,
        carId: request.vehicle.mqttCarId,
        correlationId: run.id,
        includeDtcs: plan.includeDtcs,
        timeoutMs: this.configService.get<number>('MQTT_REQUEST_TIMEOUT_MS', 15000),
        pids: plan.requestedPids.map((pid) => ({ key: pid.key, mode: pid.mode, pid: pid.pid })),
      };

      await this.prisma.diagnosticRun.update({
        where: { id: run.id },
        data: {
          status: DiagnosticRunStatus.SENT,
          startedAt: new Date(),
          mqttCommandJson: mqttCommand as Prisma.InputJsonValue,
        },
      });
      await this.prisma.diagnosticRequest.update({
        where: { id: request.id },
        data: { status: DiagnosticRequestStatus.DISPATCHED },
      });

      const response = await this.mqttService.publishDiagnosticCommand(mqttCommand);
      const missingStatus = response.status === 'error' ? MeasurementStatus.ERROR : MeasurementStatus.MISSING;
      const normalization = await this.normalizerService.persistDiagnosticResponse(
        run.id,
        response,
        plan.requestedPids,
        missingStatus,
      );

      const runStatus = this.resolveRunStatus(response.status, normalization.missingKeys.length);
      await this.prisma.diagnosticRun.update({
        where: { id: run.id },
        data: {
          status: runStatus,
          rawResponseJson: response as Prisma.InputJsonValue,
          errorMessage: response.error?.message ?? null,
          respondedAt: new Date(response.generatedAt),
        },
      });

      await this.prisma.diagnosticRequest.update({
        where: { id: request.id },
        data: { status: DiagnosticRequestStatus.GENERATING_REPORT },
      });

      await this.diagnosticsQueue.add(
        JOB_GENERATE_DIAGNOSTIC_REPORT,
        { requestId: request.id, runId: run.id },
        {
          jobId: `report-${request.id}-${run.id}`,
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );

      return {
        requestId: request.id,
        runId: run.id,
        status: runStatus,
      };
    } catch (error) {
      await this.handleExecutionFailure(input.requestId, runId, error);
      throw error;
    }
  }

  public async handleGenerateDiagnosticReportJob(input: { requestId: string; runId: string }) {
    try {
      const request = await this.prisma.diagnosticRequest.findUnique({
        where: { id: input.requestId },
        include: {
          vehicle: true,
          classifiedProfile: true,
          plan: true,
        },
      });

      if (!request || !request.plan) {
        throw new NotFoundException('Diagnostic request or plan not found for report generation.');
      }

      const run = await this.prisma.diagnosticRun.findUnique({
        where: { id: input.runId },
        include: {
          measurements: {
            orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }],
          },
          dtcs: true,
        },
      });

      if (!run) {
        throw new NotFoundException('Diagnostic run not found for report generation.');
      }

      const structuredSummary = this.summaryService.buildSummary({
        request,
        plan: request.plan,
        run,
      });
      const reportJson = await this.aiService.generateReport({ summary: structuredSummary });
      const report = await this.reportsService.createOrUpdateReport(
        input.requestId,
        input.runId,
        structuredSummary,
        reportJson,
      );

      await this.prisma.diagnosticRequest.update({
        where: { id: input.requestId },
        data: {
          status: DiagnosticRequestStatus.COMPLETED,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      return report;
    } catch (error) {
      await this.prisma.diagnosticRequest.update({
        where: { id: input.requestId },
        data: {
          status: DiagnosticRequestStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async handleExecutionFailure(requestId: string, runId: string | null, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (runId) {
      const run = await this.prisma.diagnosticRun.findUnique({
        where: { id: runId },
        include: { diagnosticPlan: true },
      });

      if (run) {
        const requestedPids = Array.isArray(run.diagnosticPlan.requestedPidsJson)
          ? (
              run.diagnosticPlan.requestedPidsJson as Array<{
                key: string;
                mode: string;
                pid: string;
                priority?: number;
              }>
            ).map((entry) => ({
              key: entry.key,
              mode: entry.mode,
              pid: entry.pid,
              priority: Number(entry.priority ?? 999),
            }))
          : [];

        const failureResponse = {
          requestId,
          planId: run.diagnosticPlanId,
          carId: 'unknown',
          generatedAt: new Date().toISOString(),
          status: 'error' as const,
          measurements: [],
          dtcs: [],
          error: {
            code: errorMessage.toLowerCase().includes('timed out') ? 'TIMEOUT' : 'EXECUTION_ERROR',
            message: errorMessage,
          },
        };

        await this.normalizerService.persistDiagnosticResponse(
          run.id,
          failureResponse,
          requestedPids,
          errorMessage.toLowerCase().includes('timed out') ? MeasurementStatus.TIMEOUT : MeasurementStatus.ERROR,
        );

        await this.prisma.diagnosticRun.update({
          where: { id: run.id },
          data: {
            status: errorMessage.toLowerCase().includes('timed out')
              ? DiagnosticRunStatus.TIMEOUT
              : DiagnosticRunStatus.FAILED,
            errorMessage,
            rawResponseJson: failureResponse as Prisma.InputJsonValue,
            respondedAt: new Date(),
          },
        });

        await this.prisma.diagnosticRequest.update({
          where: { id: requestId },
          data: { status: DiagnosticRequestStatus.GENERATING_REPORT },
        });

        await this.diagnosticsQueue.add(
          JOB_GENERATE_DIAGNOSTIC_REPORT,
          { requestId, runId: run.id },
          {
            jobId: `report-${requestId}-${run.id}-fallback`,
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );

        return;
      }
    }

    await this.prisma.diagnosticRequest.update({
      where: { id: requestId },
      data: {
        status: DiagnosticRequestStatus.FAILED,
        errorMessage,
      },
    });
  }

  private resolveRunStatus(responseStatus: 'ok' | 'error', missingCount: number): DiagnosticRunStatus {
    if (responseStatus === 'error') {
      return DiagnosticRunStatus.FAILED;
    }

    if (missingCount > 0) {
      return DiagnosticRunStatus.PARTIAL;
    }

    return DiagnosticRunStatus.RESPONDED;
  }

  private async getOwnedRequest(user: AuthenticatedUser, requestId: string) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();
    const canReadAll = user.role === UserRole.ADMIN || bypassOwnership;

    const request = await this.prisma.diagnosticRequest.findFirst({
      where: canReadAll ? { id: requestId } : { id: requestId, userId: user.sub },
      include: {
        vehicle: true,
        classifiedProfile: true,
        plan: {
          include: {
            runs: {
              include: {
                measurements: {
                  orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }],
                },
                dtcs: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        report: true,
      },
    });

    if (!request) {
      if (canReadAll) {
        throw new NotFoundException('Diagnostic request not found.');
      }
      throw new ForbiddenException('You do not have access to this diagnostic request.');
    }

    return request;
  }

  private shouldBypassOwnershipFilter() {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return false;
    }

    return this.configService.get<boolean>('DEV_DISABLE_OWNERSHIP_FILTER', false) === true;
  }

  private serializeRequestDetail(request: Awaited<ReturnType<DiagnosticsService['getOwnedRequest']>>) {
    const latestRun = request.plan?.runs[0] ?? null;
    const requestedMeasurements = Array.isArray(request.plan?.requestedPidsJson)
      ? request.plan.requestedPidsJson
      : [];

    return {
      requestId: request.id,
      status: request.status,
      complaintText: request.complaintText,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      completedAt: request.completedAt,
      vehicle: {
        id: request.vehicle.id,
        mqttCarId: request.vehicle.mqttCarId,
        vin: request.vehicle.vin,
        make: request.vehicle.make,
        model: request.vehicle.model,
        year: request.vehicle.year,
      },
      profile: request.classifiedProfile
        ? {
            id: request.classifiedProfile.id,
          code: request.classifiedProfile.code,
          name: request.classifiedProfile.name,
          description: request.classifiedProfile.description,
          confidence: request.classificationConfidence,
          rationale: request.classificationRationale,
        }
        : null,
      plan: request.plan
        ? {
            id: request.plan.id,
            includeDtcs: request.plan.includeDtcs,
            plannerNotes: request.plan.plannerNotes,
            requestedMeasurements,
          }
        : null,
      latestRun: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            startedAt: latestRun.startedAt,
            respondedAt: latestRun.respondedAt,
            errorMessage: latestRun.errorMessage,
            measurements: latestRun.measurements.map((measurement) => ({
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
            })),
            dtcs: latestRun.dtcs.map((dtc) => ({
              ...explainDtc(dtc.code, dtc.description),
              code: dtc.code,
              description: dtc.description,
              severity: dtc.severity,
              state: dtc.state.toLowerCase(),
            })),
          }
        : null,
      report: request.report
        ? {
            id: request.report.id,
            summary: (request.report.reportJson as Record<string, unknown>).summary ?? null,
            structuredSummary: request.report.structuredSummaryJson,
            reportJson: request.report.reportJson,
            reportText: request.report.reportText,
            createdAt: request.report.createdAt,
          }
        : null,
    };
  }
}
