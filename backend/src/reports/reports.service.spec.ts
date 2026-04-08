import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const prismaMock = {
    diagnosticReport: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it('renders a deterministic human-readable report text', () => {
    const text = service.renderReportText({
      summary: 'The measurements suggest a rich fuel mixture.',
      possibleCauses: ['Stuck injector', 'Faulty oxygen sensor'],
      nextSteps: ['Inspect fuel pressure regulator', 'Test O2 sensor response'],
      caveats: ['Single-run capture only'],
      confidence: 0.82,
    });

    expect(text).toContain('Summary: The measurements suggest a rich fuel mixture.');
    expect(text).toContain('Possible Causes:');
    expect(text).toContain('Confidence: 82%');
  });

  it('validates report schema before upsert', async () => {
    await expect(
      service.createOrUpdateReport(
        'req-1',
        'run-1',
        {
          requestId: 'req-1',
          runId: 'run-1',
          complaintText: 'Fuel consumption issue',
          requestStatus: 'COMPLETED',
          profile: null,
          vehicle: {
            id: 'veh-1',
            mqttCarId: 'sim-demo',
            vin: null,
            make: null,
            model: null,
            year: null,
          },
          requestedMeasurements: [],
          measurements: [],
          dtcs: [],
          missing: [],
          observations: [],
        },
        {
          summary: 'Invalid confidence payload',
          possibleCauses: [],
          nextSteps: [],
          caveats: [],
          confidence: 300,
        },
      ),
    ).rejects.toThrow();
  });

  it('denies report access for users without ownership', async () => {
    prismaMock.diagnosticReport.findFirst.mockResolvedValue(null);

    await expect(
      service.getReport(
        { sub: 'user-1', email: 'user@example.com', role: UserRole.USER },
        'req-404',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
