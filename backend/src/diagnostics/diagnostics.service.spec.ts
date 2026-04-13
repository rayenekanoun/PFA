import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiagnosticRequestStatus, DiagnosticRunStatus, UserRole } from '@prisma/client';
import { Queue } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { JOB_EXECUTE_DIAGNOSTIC_REQUEST } from '../common/queue.constants';
import { MqttService } from '../mqtt/mqtt.service';
import { PidCatalogService } from '../pid-catalog/pid-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ReportsService } from '../reports/reports.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { DiagnosticNormalizerService } from './services/diagnostic-normalizer.service';
import { DiagnosticPlannerService } from './services/diagnostic-planner.service';
import { DiagnosticSummaryService } from './services/diagnostic-summary.service';
import { DiagnosticsService } from './diagnostics.service';

describe('DiagnosticsService', () => {
  let service: DiagnosticsService;

  const prismaMock = {
    diagnosticRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    diagnosticRun: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    diagnosticPlan: {
      upsert: jest.fn(),
    },
  };

  const configServiceMock = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const vehiclesServiceMock = {
    getVehicle: jest.fn(),
  };

  const profilesServiceMock = {
    listCandidateProfilesForComplaint: jest.fn(),
    findByCode: jest.fn(),
  };
  const pidCatalogServiceMock = {
    hasFreshSupportedPids: jest.fn(),
    getSupportedCodesForVehicle: jest.fn(),
  };
  const mqttServiceMock = {};
  const aiServiceMock = {
    classifyComplaint: jest.fn(),
  };
  const reportsServiceMock = {
    createOrUpdateReport: jest.fn(),
  };
  const plannerServiceMock = {
    buildPlan: jest.fn(),
  };
  const normalizerServiceMock = {};
  const summaryServiceMock = {};
  const queueMock = {
    add: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiagnosticsService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
      vehiclesServiceMock as unknown as VehiclesService,
      profilesServiceMock as unknown as ProfilesService,
      pidCatalogServiceMock as unknown as PidCatalogService,
      mqttServiceMock as MqttService,
      aiServiceMock as unknown as AiService,
      reportsServiceMock as unknown as ReportsService,
      plannerServiceMock as unknown as DiagnosticPlannerService,
      normalizerServiceMock as DiagnosticNormalizerService,
      summaryServiceMock as DiagnosticSummaryService,
      queueMock as unknown as Queue,
    );
  });

  it('completes with an undiagnosable report when the selected profile has no requestable pids', async () => {
    const selectedProfile = {
      id: 'prof-1',
      code: 'brake_mechanical_issue',
      name: 'Brake Mechanical Issue',
      description: 'Complaint likely needs manual inspection rather than OBD live data.',
    };

    prismaMock.diagnosticRequest.findUnique.mockResolvedValue({
      id: 'req-2',
      vehicleId: 'veh-1',
      complaintText: 'the brakes are weak',
      vehicle: {
        id: 'veh-1',
        mqttCarId: 'sim-demo',
        vin: null,
        make: 'Toyota',
        model: 'Yaris',
        year: 2012,
        device: { id: 'dev-1' },
      },
    });
    pidCatalogServiceMock.hasFreshSupportedPids.mockResolvedValue(true);
    profilesServiceMock.listCandidateProfilesForComplaint.mockResolvedValue([selectedProfile]);
    aiServiceMock.classifyComplaint.mockResolvedValue({
      profileCode: selectedProfile.code,
      confidence: 0.91,
      rationale: 'Brake complaint best matches a non-OBD mechanical profile.',
    });
    profilesServiceMock.findByCode.mockResolvedValue(selectedProfile);
    pidCatalogServiceMock.getSupportedCodesForVehicle.mockResolvedValue(new Set(['010C']));
    plannerServiceMock.buildPlan.mockReturnValue({
      requestedPids: [],
      includeDtcs: true,
      plannerNotes: 'OBD visibility is limited for this complaint.',
    });
    prismaMock.diagnosticPlan.upsert.mockResolvedValue({ id: 'plan-1' });
    prismaMock.diagnosticRequest.update.mockResolvedValue({});
    prismaMock.diagnosticRun.create.mockResolvedValue({ id: 'run-2' });
    reportsServiceMock.createOrUpdateReport.mockResolvedValue({ id: 'report-1' });

    const result = await service.handleExecuteDiagnosticRequestJob({ requestId: 'req-2' });

    expect(prismaMock.diagnosticRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DiagnosticRunStatus.FAILED,
          errorMessage: expect.stringContaining('cannot be diagnosed reliably'),
        }),
      }),
    );
    expect(reportsServiceMock.createOrUpdateReport).toHaveBeenCalledWith(
      'req-2',
      'run-2',
      expect.objectContaining({
        requestedMeasurements: [],
        measurements: [],
      }),
      expect.objectContaining({
        summary: expect.stringContaining('not able to diagnose'),
      }),
    );
    expect(queueMock.add).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requestId: 'req-2', runId: 'run-2' }),
      expect.anything(),
    );
    expect(result).toEqual({
      requestId: 'req-2',
      runId: 'run-2',
      status: DiagnosticRunStatus.FAILED,
    });
  });

  it('rejects request creation when vehicle has no linked device', async () => {
    vehiclesServiceMock.getVehicle.mockResolvedValue({
      id: 'veh-1',
      device: null,
    });

    await expect(
      service.createRequest(
        { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
        {
          vehicleId: 'veh-1',
          complaintText: 'my car shakes at idle',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates request and enqueues execution job', async () => {
    vehiclesServiceMock.getVehicle.mockResolvedValue({
      id: 'veh-1',
      device: {
        id: 'dev-1',
      },
    });
    prismaMock.diagnosticRequest.create.mockResolvedValue({
      id: 'req-1',
      status: DiagnosticRequestStatus.CREATED,
    });
    queueMock.add.mockResolvedValue({ id: 'job-1' });

    const result = await service.createRequest(
      { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
      {
        vehicleId: 'veh-1',
        complaintText: 'fuel consumption is high',
      },
    );

    expect(prismaMock.diagnosticRequest.create).toHaveBeenCalled();
    expect(queueMock.add).toHaveBeenCalledWith(
      JOB_EXECUTE_DIAGNOSTIC_REQUEST,
      { requestId: 'req-1' },
      expect.objectContaining({
        jobId: 'diagnostic-req-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        requestId: 'req-1',
        status: DiagnosticRequestStatus.CREATED,
      }),
    );
  });

  it('denies run detail access for non-owner users', async () => {
    prismaMock.diagnosticRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: DiagnosticRunStatus.RESPONDED,
      errorMessage: null,
      startedAt: new Date(),
      respondedAt: new Date(),
      createdAt: new Date(),
      rawResponseJson: null,
      mqttCommandJson: null,
      dtcs: [],
      measurements: [],
      diagnosticPlan: {
        diagnosticRequest: {
          userId: 'another-user',
          vehicle: {
            id: 'veh-1',
            mqttCarId: 'sim-demo',
          },
        },
      },
    });

    await expect(
      service.getRunDetail(
        { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
        'run-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admins to read any run detail', async () => {
    prismaMock.diagnosticRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: DiagnosticRunStatus.RESPONDED,
      errorMessage: null,
      startedAt: new Date(),
      respondedAt: new Date(),
      createdAt: new Date(),
      rawResponseJson: { status: 'ok' },
      mqttCommandJson: { requestId: 'req-1' },
      dtcs: [],
      measurements: [],
      diagnosticPlan: {
        diagnosticRequest: {
          userId: 'another-user',
          vehicle: {
            id: 'veh-1',
            mqttCarId: 'sim-demo',
          },
        },
      },
    });

    const result = await service.getRunDetail(
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN },
      'run-1',
    );

    expect(result.id).toBe('run-1');
    expect(result.vehicle.mqttCarId).toBe('sim-demo');
  });
});
