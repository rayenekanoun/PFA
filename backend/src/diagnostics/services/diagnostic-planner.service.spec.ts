import { DiagnosticPlannerService } from './diagnostic-planner.service';

describe('DiagnosticPlannerService', () => {
  const service = new DiagnosticPlannerService();

  it('filters unsupported pids out of the plan', () => {
    const result = service.buildPlan({
      profile: {
        id: 'profile-1',
        code: 'fuel_consumption',
        name: 'Fuel Consumption',
        description: null,
        defaultRequestedPidsJson: [
          { key: 'engine_rpm', mode: '01', pid: '0C', priority: 1 },
          { key: 'vehicle_speed', mode: '01', pid: '0D', priority: 2 },
        ],
        includeDtcsByDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      supportedFullCodes: new Set(['010C']),
    });

    expect(result.includeDtcs).toBe(true);
    expect(result.requestedPids).toEqual([
      { key: 'engine_rpm', mode: '01', pid: '0C', priority: 1 },
    ]);
    expect(result.plannerNotes).toContain('Filtered 1 unsupported PID');
  });
});
