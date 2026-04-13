import { DIAGNOSTIC_PROFILES_SEED } from '../seeds/seed-data/diagnostic-profiles.seed';
import { selectProfilesForComplaint } from './profile-matching.util';

describe('selectProfilesForComplaint', () => {
  it('keeps the generated seed at 1000 profiles', () => {
    expect(DIAGNOSTIC_PROFILES_SEED).toHaveLength(1000);
  });

  it('prioritizes brake-related profiles for a slow-stopping complaint', () => {
    const complaint = 'my brakes are slow and it takes a while to fully stop the car';
    const selected = selectProfilesForComplaint(DIAGNOSTIC_PROFILES_SEED, complaint, {
      limit: 20,
      maxPerFamily: 3,
    });

    expect(selected.length).toBeGreaterThan(0);
    expect(
      selected[0]?.code.startsWith('soft_brake_pedal') ||
      selected[0]?.code.startsWith('brake_pull_and_wheel_drag'),
    ).toBe(true);
    expect(selected.some((profile) => profile.code.startsWith('soft_brake_pedal'))).toBe(true);
    expect(
      selected.slice(0, 3).every((profile) =>
        profile.code.startsWith('soft_brake_pedal') ||
        profile.code.startsWith('brake_pull_and_wheel_drag') ||
        profile.code.startsWith('brake_noise_and_abs'),
      ),
    ).toBe(true);
  });
});
