import { StubAiProvider } from './stub-ai.provider';

describe('StubAiProvider', () => {
  const provider = new StubAiProvider();

  it('classifies fuel complaints into the fuel_consumption profile', async () => {
    const result = await provider.classifyComplaint({
      complaintText: 'My car consumes too much gasoline lately',
      availableProfiles: [
        { code: 'fuel_consumption', name: 'Fuel Consumption', description: null },
        { code: 'battery_issue', name: 'Battery Issue', description: null },
      ],
    });

    expect(result.profileCode).toBe('fuel_consumption');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('generates a structured report from normalized summary input', async () => {
    const report = await provider.generateReport({
      summary: {
        requestId: 'req-1',
        runId: 'run-1',
        complaintText: 'battery problem',
        requestStatus: 'COMPLETED',
        profile: {
          code: 'battery_issue',
          name: 'Battery Issue',
          confidence: 0.8,
          rationale: 'Matched battery terms.',
        },
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

    expect(report.summary.length).toBeGreaterThan(0);
    expect(Array.isArray(report.nextSteps)).toBe(true);
  });
});
