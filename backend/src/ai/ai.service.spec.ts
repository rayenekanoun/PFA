import { ConfigService } from '@nestjs/config';
import type { AiProvider } from './providers/ai-provider.interface';
import { StubAiProvider } from './providers/stub-ai.provider';
import { AiService } from './ai.service';

describe('AiService', () => {
  const providerMock: jest.Mocked<AiProvider> = {
    classifyComplaint: jest.fn(),
    generateReport: jest.fn(),
  };

  const stubProviderMock = {
    classifyComplaint: jest.fn(),
    generateReport: jest.fn(),
  };

  const configValues: Record<string, unknown> = {
    AI_PROVIDER: 'vertex',
    AI_ALLOW_STUB_FALLBACK: false,
  };

  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key in configValues) {
        return configValues[key];
      }
      return defaultValue;
    }),
  };

  let service: AiService;

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.AI_PROVIDER = 'vertex';
    configValues.AI_ALLOW_STUB_FALLBACK = false;

    service = new AiService(
      providerMock,
      configServiceMock as unknown as ConfigService,
      stubProviderMock as unknown as StubAiProvider,
    );
  });

  it('returns provider classification when provider succeeds', async () => {
    providerMock.classifyComplaint.mockResolvedValue({
      profileCode: 'fuel_consumption',
      confidence: 0.84,
      rationale: 'Fuel-related complaint terms were dominant.',
    });

    const result = await service.classifyComplaint({
      complaintText: 'My car consumes too much gasoline',
      availableProfiles: [
        { code: 'fuel_consumption', name: 'Fuel Consumption', description: null },
      ],
    });

    expect(result.profileCode).toBe('fuel_consumption');
    expect(stubProviderMock.classifyComplaint).not.toHaveBeenCalled();
  });

  it('normalizes string confidence values from provider output', async () => {
    providerMock.classifyComplaint.mockResolvedValue({
      profileCode: 'fuel_consumption',
      confidence: '82%',
      rationale: 'Fuel-related complaint terms were dominant.',
    } as unknown as Awaited<ReturnType<AiProvider['classifyComplaint']>>);

    const result = await service.classifyComplaint({
      complaintText: 'My car consumes too much gasoline',
      availableProfiles: [
        { code: 'fuel_consumption', name: 'Fuel Consumption', description: null },
      ],
    });

    expect(result.confidence).toBeCloseTo(0.82, 3);
  });

  it('normalizes qualitative confidence labels from provider output', async () => {
    providerMock.classifyComplaint.mockResolvedValue({
      profileCode: 'fuel_consumption',
      confidence: 'high',
      rationale: 'Fuel-related complaint terms were dominant.',
    } as unknown as Awaited<ReturnType<AiProvider['classifyComplaint']>>);

    const result = await service.classifyComplaint({
      complaintText: 'My car consumes too much gasoline',
      availableProfiles: [
        { code: 'fuel_consumption', name: 'Fuel Consumption', description: null },
      ],
    });

    expect(result.confidence).toBeCloseTo(0.85, 3);
  });

  it('throws when non-stub provider fails and fallback is disabled', async () => {
    providerMock.classifyComplaint.mockRejectedValue(new Error('vertex failed'));

    await expect(
      service.classifyComplaint({
        complaintText: 'My car consumes too much gasoline',
        availableProfiles: [
          { code: 'fuel_consumption', name: 'Fuel Consumption', description: null },
        ],
      }),
    ).rejects.toThrow("AI provider 'vertex' failed during complaint classification");

    expect(stubProviderMock.classifyComplaint).not.toHaveBeenCalled();
  });

  it('falls back to stub provider when explicitly enabled', async () => {
    configValues.AI_ALLOW_STUB_FALLBACK = true;
    providerMock.generateReport.mockRejectedValue(new Error('vertex failed'));
    stubProviderMock.generateReport.mockResolvedValue({
      summary: 'Fallback summary',
      possibleCauses: ['Cause A'],
      nextSteps: ['Step A'],
      caveats: ['Caveat A'],
      confidence: 0.51,
    });

    const result = await service.generateReport({
      summary: {
        requestId: 'req-1',
        runId: 'run-1',
        complaintText: 'fuel issue',
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
    });

    expect(result.summary).toBe('Fallback summary');
    expect(stubProviderMock.generateReport).toHaveBeenCalledTimes(1);
  });

  it('normalizes report payload shapes from provider output', async () => {
    providerMock.generateReport.mockResolvedValue({
      summary: { text: 'Fuel mix seems rich at idle.' },
      possibleCauses: [{ cause: 'Dirty air filter' }, { text: 'O2 sensor drift' }],
      nextSteps: 'Inspect intake path\nCheck oxygen sensor live data',
      caveats: 'Single capture only',
      confidence: '87%',
    } as unknown as Awaited<ReturnType<AiProvider['generateReport']>>);

    const result = await service.generateReport({
      summary: {
        requestId: 'req-1',
        runId: 'run-1',
        complaintText: 'fuel issue',
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
    });

    expect(result.summary).toBe('Fuel mix seems rich at idle.');
    expect(result.possibleCauses).toEqual(['Dirty air filter', 'O2 sensor drift']);
    expect(result.nextSteps).toEqual(['Inspect intake path', 'Check oxygen sensor live data']);
    expect(result.caveats).toEqual(['Single capture only']);
    expect(result.confidence).toBeCloseTo(0.87, 3);
  });
});
