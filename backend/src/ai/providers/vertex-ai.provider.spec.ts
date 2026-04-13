import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
        body: expect.any(String),
      }),
    );
    expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual(
      expect.objectContaining({
        systemInstruction: expect.objectContaining({
          parts: [
            expect.objectContaining({
              text: expect.stringContaining('You classify car-diagnostic complaints'),
            }),
          ],
        }),
        generationConfig: expect.objectContaining({
          responseMimeType: 'application/json',
          responseJsonSchema: expect.any(Object),
        }),
      }),
    );
    expect(result.profileCode).toBe('overheating');
  });

  it('uses project id from the configured service-account file when env project id is missing', async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'vertex-ai-provider-'));
    try {
      const keyFilePath = join(tempDirectory, 'service-account.json');
      writeFileSync(
        keyFilePath,
        JSON.stringify({
          type: 'service_account',
          project_id: 'file-project-id',
          client_email: 'vertex@example.com',
          private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
        }),
      );

      const fileProjectConfig = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const values: Record<string, string> = {
            VERTEX_LOCATION: 'us-central1',
            VERTEX_MODEL: 'gemini-2.5-flash',
            VERTEX_SERVICE_ACCOUNT_PATH: keyFilePath,
          };
          return values[key] ?? defaultValue;
        }),
      };

      const fileProjectProvider = new VertexAiProvider(fileProjectConfig as unknown as ConfigService);
      (
        fileProjectProvider as unknown as { getAccessToken: () => Promise<string> }
      ).getAccessToken = jest.fn().mockResolvedValue('vertex-access-token');

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Summary',
                      possibleCauses: ['Cause A'],
                      nextSteps: ['Step A'],
                      caveats: ['Caveat A'],
                      confidence: 0.8,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as Response);

      await fileProjectProvider.generateReport({
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
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/projects/file-project-id/locations/us-central1/'),
        expect.any(Object),
      );
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('throws when project id is missing from env and credentials', async () => {
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
    (
      missingProjectProvider as unknown as { buildGoogleAuth: () => { getProjectId: () => Promise<string> } }
    ).buildGoogleAuth = jest.fn().mockReturnValue({
      getProjectId: jest.fn().mockRejectedValue(new Error('no inferred project id')),
    });

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
