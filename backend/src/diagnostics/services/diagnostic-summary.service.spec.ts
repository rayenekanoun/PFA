import { DiagnosticRequestStatus, MeasurementStatus } from '@prisma/client';
import { DiagnosticSummaryService } from './diagnostic-summary.service';

describe('DiagnosticSummaryService', () => {
  const service = new DiagnosticSummaryService();

  it('builds structured summary with derived observations and missing fields', () => {
    const summary = service.buildSummary({
      request: {
        id: 'req-1',
        userId: 'user-1',
        vehicleId: 'veh-1',
        complaintText: 'Engine seems hot and battery weak',
        classifiedProfileId: 'profile-1',
        classificationConfidence: 0.83,
        classificationRationale: 'Matched overheating and voltage keywords.',
        status: DiagnosticRequestStatus.GENERATING_REPORT,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        debugConfigJson: null,
        vehicle: {
          id: 'veh-1',
          userId: 'user-1',
          mqttCarId: 'sim-demo',
          vin: null,
          make: null,
          model: null,
          year: null,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never,
        classifiedProfile: {
          id: 'profile-1',
          code: 'overheating',
          name: 'Overheating',
          description: 'Cooling-system temperature issue.',
          defaultRequestedPidsJson: [],
          includeDtcsByDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as never,
      plan: {
        requestedPidsJson: [
          { key: 'coolant_temp_c', mode: '01', pid: '05', priority: 1 },
          { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 2 },
          { key: 'engine_rpm', mode: '01', pid: '0C', priority: 3 },
        ],
      },
      run: {
        id: 'run-1',
        diagnosticPlanId: 'plan-1',
        deviceId: 'dev-1',
        mqttJobId: 'mqtt-1',
        status: 'RESPONDED',
        mqttCommandJson: null,
        rawResponseJson: null,
        errorMessage: null,
        startedAt: new Date(),
        respondedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        measurements: [
          {
            measurementKey: 'coolant_temp_c',
            label: 'Coolant Temperature',
            valueNumber: 109,
            valueText: null,
            valueBoolean: null,
            valueJson: null,
            unit: 'C',
            status: MeasurementStatus.OK,
            rawValue: '95',
          },
          {
            measurementKey: 'control_module_voltage_v',
            label: 'Control Module Voltage',
            valueNumber: 11.7,
            valueText: null,
            valueBoolean: null,
            valueJson: null,
            unit: 'V',
            status: MeasurementStatus.OK,
            rawValue: '2ED',
          },
          {
            measurementKey: 'engine_rpm',
            label: 'Engine RPM',
            valueNumber: null,
            valueText: null,
            valueBoolean: null,
            valueJson: null,
            unit: 'rpm',
            status: MeasurementStatus.TIMEOUT,
            rawValue: null,
          },
        ],
        dtcs: [
          {
            code: 'P0117',
            description: 'Engine Coolant Temperature Circuit Low Input',
            severity: 'high',
            state: 'STORED',
          },
        ],
      } as never,
    });

    expect(summary.requestId).toBe('req-1');
    expect(summary.requestedMeasurements.map((entry) => entry.key)).toEqual([
      'coolant_temp_c',
      'control_module_voltage_v',
      'engine_rpm',
    ]);
    expect(summary.missing).toContain('engine_rpm');
    expect(summary.observations.join(' ')).toContain('Coolant temperature is elevated');
    expect(summary.observations.join(' ')).toContain('Control module voltage is low');
    expect(summary.observations.join(' ')).toContain('diagnostic trouble code');
    expect(summary.profile?.description).toBe('Cooling-system temperature issue.');
    expect(summary.dtcs[0]?.humanExplanation).toContain('Plain English');
  });
});
