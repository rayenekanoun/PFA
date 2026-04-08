import { ConfigService } from '@nestjs/config';
import { VertexAiProvider } from './vertex-ai.provider';

describe('VertexAiProvider', () => {
  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        VERTEX_PROJECT_ID: 'pfa-e4',
        VERTEX_LOCATION: 'us-central1',
        VERTEX_MODEL: 'gemini-2.5-flash',
      };
      return values[key] ?? defaultValue;
    }),
  };

  const provider = new VertexAiProvider(configServiceMock as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls Vertex endpoint and parses classification JSON', async () => {
    (provider as unknown as { getAccessToken: () => Promise<string> }).getAccessToken = jest
      .fn()
      .mockResolvedValue('vertex-access-token');

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    profileCode: 'overheating',
                    confidence: 0.9,
                    rationale: 'Temperature terms matched.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const result = await provider.classifyComplaint({
      complaintText: 'engine is too hot',
      availableProfiles: [
        { code: 'overheating', name: 'Overheating', description: null },
        { code: 'fuel_consumption', name: 'Fuel', description: null },
      ],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '/v1/projects/pfa-e4/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent',
      ),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer vertex-access-token',
        }),
      }),
    );
    expect(result.profileCode).toBe('overheating');
  });

  it('throws when project id is missing', async () => {
    const missingProjectConfig = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'VERTEX_PROJECT_ID') return undefined;
        return defaultValue;
      }),
    };

    const missingProjectProvider = new VertexAiProvider(
      missingProjectConfig as unknown as ConfigService,
    );
    (
      missingProjectProvider as unknown as { getAccessToken: () => Promise<string> }
    ).getAccessToken = jest.fn().mockResolvedValue('vertex-access-token');

    await expect(
      missingProjectProvider.generateReport({
        summary: {
          requestId: 'req-1',
          runId: 'run-1',
          complaintText: 'test',
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
      }),
    ).rejects.toThrow('VERTEX_PROJECT_ID is required');
  });
});
