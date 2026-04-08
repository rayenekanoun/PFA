import { MeasurementStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DiagnosticNormalizerService } from './diagnostic-normalizer.service';

describe('DiagnosticNormalizerService', () => {
  let service: DiagnosticNormalizerService;

  const txMock = {
    diagnosticMeasurement: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    diagnosticDtc: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const prismaMock = {
    obdPidCatalog: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (tx: typeof txMock) => Promise<void>) => callback(txMock)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    txMock.diagnosticMeasurement.deleteMany.mockResolvedValue({ count: 0 });
    txMock.diagnosticMeasurement.create.mockResolvedValue({});
    txMock.diagnosticDtc.deleteMany.mockResolvedValue({ count: 0 });
    txMock.diagnosticDtc.create.mockResolvedValue({});
    service = new DiagnosticNormalizerService(prismaMock as unknown as PrismaService);
  });

  it('persists measurements, marks missing requested keys, and stores dtcs', async () => {
    prismaMock.obdPidCatalog.findMany.mockResolvedValue([
      {
        id: 'pid-rpm',
        fullCode: '010C',
        key: 'engine_rpm',
        label: 'Engine RPM',
        unit: 'rpm',
      },
      {
        id: 'pid-maf',
        fullCode: '0110',
        key: 'maf',
        label: 'Mass Air Flow',
        unit: 'g/s',
      },
    ]);

    const response = {
      requestId: 'req-1',
      planId: 'plan-1',
      carId: 'sim-demo',
      generatedAt: '2026-04-08T10:00:00.000Z',
      status: 'ok' as const,
      measurements: [
        {
          mode: '01',
          pid: '0C',
          key: 'engine_rpm',
          label: 'Engine RPM',
          unit: 'rpm',
          status: 'ok' as const,
          raw: '1AF8',
          decoded: 1726,
        },
      ],
      dtcs: [
        {
          code: 'P0172',
          description: 'System Too Rich',
          severity: 'high',
          state: 'stored' as const,
          sourceMode: '03',
        },
      ],
    };

    const result = await service.persistDiagnosticResponse(
      'run-1',
      response,
      [
        { key: 'engine_rpm', mode: '01', pid: '0C', priority: 1 },
        { key: 'maf', mode: '01', pid: '10', priority: 2 },
      ],
      MeasurementStatus.MISSING,
    );

    expect(txMock.diagnosticMeasurement.deleteMany).toHaveBeenCalledWith({
      where: { diagnosticRunId: 'run-1' },
    });
    expect(txMock.diagnosticMeasurement.create).toHaveBeenCalledTimes(2);
    expect(txMock.diagnosticDtc.create).toHaveBeenCalledTimes(1);
    expect(result.measurementCount).toBe(1);
    expect(result.dtcCount).toBe(1);
    expect(result.missingKeys).toEqual(['maf']);

    const createdMeasurementCalls = txMock.diagnosticMeasurement.create.mock.calls;
    expect(createdMeasurementCalls[0][0].data).toEqual(
      expect.objectContaining({
        diagnosticRunId: 'run-1',
        measurementKey: 'engine_rpm',
        status: MeasurementStatus.OK,
        valueNumber: 1726,
      }),
    );
    expect(createdMeasurementCalls[1][0].data).toEqual(
      expect.objectContaining({
        diagnosticRunId: 'run-1',
        measurementKey: 'maf',
        status: MeasurementStatus.MISSING,
      }),
    );
  });
});
