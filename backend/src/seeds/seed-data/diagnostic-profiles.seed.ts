export interface ProfilePidSelection {
  key: string;
  mode: string;
  pid: string;
  priority: number;
}

export const DIAGNOSTIC_PROFILES_SEED: Array<{
  code: string;
  name: string;
  description: string;
  includeDtcsByDefault: boolean;
  defaultRequestedPidsJson: ProfilePidSelection[];
}> = [
  {
    code: 'fuel_consumption',
    name: 'Fuel Consumption',
    description: 'Checks airflow, trims, throttle, and temperature signals related to high fuel consumption.',
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: [
      { key: 'engine_rpm', mode: '01', pid: '0C', priority: 1 },
      { key: 'vehicle_speed', mode: '01', pid: '0D', priority: 2 },
      { key: 'throttle_position_pct', mode: '01', pid: '11', priority: 3 },
      { key: 'maf_g_s', mode: '01', pid: '10', priority: 4 },
      { key: 'short_term_fuel_trim_bank1', mode: '01', pid: '06', priority: 5 },
      { key: 'long_term_fuel_trim_bank1', mode: '01', pid: '07', priority: 6 },
      { key: 'coolant_temp_c', mode: '01', pid: '05', priority: 7 },
      { key: 'intake_air_temp_c', mode: '01', pid: '0F', priority: 8 },
      { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 9 },
    ],
  },
  {
    code: 'overheating',
    name: 'Overheating',
    description: 'Focuses on temperature, load, airflow, and cooling-adjacent signals.',
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: [
      { key: 'coolant_temp_c', mode: '01', pid: '05', priority: 1 },
      { key: 'intake_air_temp_c', mode: '01', pid: '0F', priority: 2 },
      { key: 'engine_rpm', mode: '01', pid: '0C', priority: 3 },
      { key: 'vehicle_speed', mode: '01', pid: '0D', priority: 4 },
      { key: 'engine_load', mode: '01', pid: '04', priority: 5 },
      { key: 'maf_g_s', mode: '01', pid: '10', priority: 6 },
      { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 7 },
    ],
  },
  {
    code: 'rough_idle',
    name: 'Rough Idle',
    description: 'Captures idle-related airflow, trims, load, and throttle signals.',
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: [
      { key: 'engine_rpm', mode: '01', pid: '0C', priority: 1 },
      { key: 'engine_load', mode: '01', pid: '04', priority: 2 },
      { key: 'throttle_position_pct', mode: '01', pid: '11', priority: 3 },
      { key: 'short_term_fuel_trim_bank1', mode: '01', pid: '06', priority: 4 },
      { key: 'long_term_fuel_trim_bank1', mode: '01', pid: '07', priority: 5 },
      { key: 'maf_g_s', mode: '01', pid: '10', priority: 6 },
      { key: 'coolant_temp_c', mode: '01', pid: '05', priority: 7 },
    ],
  },
  {
    code: 'battery_issue',
    name: 'Battery / Charging Issue',
    description: 'Checks module voltage and supporting operating conditions for charging problems.',
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: [
      { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 1 },
      { key: 'engine_rpm', mode: '01', pid: '0C', priority: 2 },
      { key: 'coolant_temp_c', mode: '01', pid: '05', priority: 3 },
      { key: 'engine_load', mode: '01', pid: '04', priority: 4 },
    ],
  },
];
