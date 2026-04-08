import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';

describe('GeminiProvider', () => {
  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        AI_API_KEY: 'test-gemini-key',
        AI_BASE_URL: 'https://generativelanguage.googleapis.com',
        AI_MODEL: 'gemini-2.5-flash',
      };
      return values[key] ?? defaultValue;
    }),
  };

  const provider = new GeminiProvider(configServiceMock as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('classifies complaint from Gemini JSON response', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    profileCode: 'fuel_consumption',
                    confidence: 0.82,
                    rationale: 'Matched fuel-related words.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const result = await provider.classifyComplaint({
      complaintText: 'My car consumes too much gasoline.',
      availableProfiles: [
        { code: 'fuel_consumption', name: 'Fuel', description: null },
        { code: 'overheating', name: 'Heat', description: null },
      ],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.profileCode).toBe('fuel_consumption');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('throws when Gemini response is not valid JSON', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'not-json',
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    await expect(
      provider.generateReport({
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
    ).rejects.toThrow('Gemini response was not valid JSON');
  });
});
