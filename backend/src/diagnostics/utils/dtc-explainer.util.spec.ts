import { explainDtc } from './dtc-explainer.util';

describe('explainDtc', () => {
  it('expands P0217 into a human-readable explanation', () => {
    const result = explainDtc('P0217', 'Engine Overtemperature Condition');

    expect(result.system).toBe('Powertrain');
    expect(result.humanTitle).toContain('overtemperature');
    expect(result.humanExplanation.toLowerCase()).toContain('engine got hotter');
  });

  it('provides a generic fallback explanation for unknown codes', () => {
    const result = explainDtc('C1234', 'Wheel speed sensor fault');

    expect(result.system).toBe('Chassis');
    expect(result.humanExplanation).toContain('Plain English');
  });
});
