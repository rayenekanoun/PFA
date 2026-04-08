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
    },
    diagnosticRun: {
      findUnique: jest.fn(),
    },
  };

  const configServiceMock = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const vehiclesServiceMock = {
    getVehicle: jest.fn(),
  };

  const profilesServiceMock = {};
  const pidCatalogServiceMock = {};
  const mqttServiceMock = {};
  const aiServiceMock = {};
  const reportsServiceMock = {};
  const plannerServiceMock = {};
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
      profilesServiceMock as ProfilesService,
      pidCatalogServiceMock as PidCatalogService,
      mqttServiceMock as MqttService,
      aiServiceMock as AiService,
      reportsServiceMock as ReportsService,
      plannerServiceMock as DiagnosticPlannerService,
      normalizerServiceMock as DiagnosticNormalizerService,
      summaryServiceMock as DiagnosticSummaryService,
      queueMock as unknown as Queue,
    );
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
