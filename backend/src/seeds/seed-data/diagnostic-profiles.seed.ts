export interface ProfilePidSelection {
  key: string;
  mode: string;
  pid: string;
  priority: number;
}

interface ProfilePlanTemplate {
  includeDtcsByDefault: boolean;
  defaultRequestedPidsJson: ProfilePidSelection[];
  scopeNote: string;
}

interface ProfileQualifierTemplate {
  slug: string;
  label: string;
  exampleSuffix: string;
}

type FamilyRow = [
  familyCode: string,
  familyName: string,
  system: string,
  planKey: keyof typeof PROFILE_PLAN_LIBRARY,
  familySummary: string,
  complaints: string[],
];

const PID_LIBRARY = {
  engine_load: { key: 'engine_load', mode: '01', pid: '04' },
  coolant_temp_c: { key: 'coolant_temp_c', mode: '01', pid: '05' },
  short_term_fuel_trim_bank1: { key: 'short_term_fuel_trim_bank1', mode: '01', pid: '06' },
  long_term_fuel_trim_bank1: { key: 'long_term_fuel_trim_bank1', mode: '01', pid: '07' },
  short_term_fuel_trim_bank2: { key: 'short_term_fuel_trim_bank2', mode: '01', pid: '08' },
  long_term_fuel_trim_bank2: { key: 'long_term_fuel_trim_bank2', mode: '01', pid: '09' },
  fuel_pressure_kpa: { key: 'fuel_pressure_kpa', mode: '01', pid: '0A' },
  intake_manifold_pressure_kpa: { key: 'intake_manifold_pressure_kpa', mode: '01', pid: '0B' },
  engine_rpm: { key: 'engine_rpm', mode: '01', pid: '0C' },
  vehicle_speed: { key: 'vehicle_speed', mode: '01', pid: '0D' },
  timing_advance_deg: { key: 'timing_advance_deg', mode: '01', pid: '0E' },
  intake_air_temp_c: { key: 'intake_air_temp_c', mode: '01', pid: '0F' },
  maf_g_s: { key: 'maf_g_s', mode: '01', pid: '10' },
  throttle_position_pct: { key: 'throttle_position_pct', mode: '01', pid: '11' },
  fuel_system_status: { key: 'fuel_system_status', mode: '01', pid: '03' },
  o2_sensor_b1s1: { key: 'o2_sensor_b1s1', mode: '01', pid: '14' },
  o2_sensor_b1s2: { key: 'o2_sensor_b1s2', mode: '01', pid: '15' },
  runtime_since_engine_start_s: { key: 'runtime_since_engine_start_s', mode: '01', pid: '1F' },
  fuel_rail_pressure_relative_kpa: { key: 'fuel_rail_pressure_relative_kpa', mode: '01', pid: '22' },
  fuel_rail_pressure_direct_kpa: { key: 'fuel_rail_pressure_direct_kpa', mode: '01', pid: '23' },
  egr_commanded_pct: { key: 'egr_commanded_pct', mode: '01', pid: '2C' },
  egr_error_pct: { key: 'egr_error_pct', mode: '01', pid: '2D' },
  evap_purge_commanded_pct: { key: 'evap_purge_commanded_pct', mode: '01', pid: '2E' },
  fuel_tank_level_pct: { key: 'fuel_tank_level_pct', mode: '01', pid: '2F' },
  barometric_pressure_kpa: { key: 'barometric_pressure_kpa', mode: '01', pid: '33' },
  catalyst_temp_b1s1_c: { key: 'catalyst_temp_b1s1_c', mode: '01', pid: '3C' },
  catalyst_temp_b1s2_c: { key: 'catalyst_temp_b1s2_c', mode: '01', pid: '3E' },
  control_module_voltage_v: { key: 'control_module_voltage_v', mode: '01', pid: '42' },
  absolute_engine_load_pct: { key: 'absolute_engine_load_pct', mode: '01', pid: '43' },
  commanded_air_fuel_ratio_lambda: { key: 'commanded_air_fuel_ratio_lambda', mode: '01', pid: '44' },
  relative_throttle_position_pct: { key: 'relative_throttle_position_pct', mode: '01', pid: '45' },
  ambient_air_temp_c: { key: 'ambient_air_temp_c', mode: '01', pid: '46' },
  absolute_throttle_position_b_pct: { key: 'absolute_throttle_position_b_pct', mode: '01', pid: '47' },
  commanded_throttle_actuator_pct: { key: 'commanded_throttle_actuator_pct', mode: '01', pid: '4C' },
  ethanol_fuel_pct: { key: 'ethanol_fuel_pct', mode: '01', pid: '52' },
  relative_accelerator_pedal_pct: { key: 'relative_accelerator_pedal_pct', mode: '01', pid: '5A' },
  engine_oil_temp_c: { key: 'engine_oil_temp_c', mode: '01', pid: '5C' },
  fuel_injection_timing_deg: { key: 'fuel_injection_timing_deg', mode: '01', pid: '5D' },
  engine_fuel_rate_lph: { key: 'engine_fuel_rate_lph', mode: '01', pid: '5E' },
  coolant_temp_sensor_2_c: { key: 'coolant_temp_sensor_2_c', mode: '01', pid: '67' },
  fuel_rail_absolute_pressure_kpa: { key: 'fuel_rail_absolute_pressure_kpa', mode: '01', pid: '68' },
} as const;

function selectPids(keys: Array<keyof typeof PID_LIBRARY>): ProfilePidSelection[] {
  return keys.map((key, index) => ({
    ...PID_LIBRARY[key],
    priority: index + 1,
  }));
}

const PROFILE_PLAN_LIBRARY = {
  cooling_core: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'coolant_temp_c',
      'coolant_temp_sensor_2_c',
      'engine_oil_temp_c',
      'ambient_air_temp_c',
      'intake_air_temp_c',
      'engine_rpm',
      'vehicle_speed',
      'engine_load',
      'absolute_engine_load_pct',
      'maf_g_s',
      'intake_manifold_pressure_kpa',
      'control_module_voltage_v',
      'runtime_since_engine_start_s',
    ]),
    scopeNote:
      'Diagnostic scope favors cooling-system temperatures, load, airflow, runtime, and charging context plus any available powertrain DTCs.',
  },
  idle_airfuel: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'engine_rpm',
      'engine_load',
      'absolute_engine_load_pct',
      'throttle_position_pct',
      'relative_throttle_position_pct',
      'commanded_throttle_actuator_pct',
      'short_term_fuel_trim_bank1',
      'long_term_fuel_trim_bank1',
      'maf_g_s',
      'intake_manifold_pressure_kpa',
      'timing_advance_deg',
      'o2_sensor_b1s1',
      'coolant_temp_c',
      'intake_air_temp_c',
      'control_module_voltage_v',
    ]),
    scopeNote:
      'Diagnostic scope favors idle stability, airflow, fuel-trim, ignition-timing, oxygen-sensor, temperature, and voltage context plus any available powertrain DTCs.',
  },
  starting: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'control_module_voltage_v',
      'engine_rpm',
      'coolant_temp_c',
      'ambient_air_temp_c',
      'intake_air_temp_c',
      'fuel_system_status',
      'throttle_position_pct',
      'relative_accelerator_pedal_pct',
      'maf_g_s',
      'intake_manifold_pressure_kpa',
      'fuel_pressure_kpa',
      'fuel_rail_pressure_relative_kpa',
      'fuel_rail_pressure_direct_kpa',
      'engine_load',
    ]),
    scopeNote:
      'Diagnostic scope favors starting, cranking, voltage, fuel-pressure, airflow, throttle, and temperature context plus any available powertrain DTCs.',
  },
  performance_airflow: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'engine_rpm',
      'vehicle_speed',
      'engine_load',
      'absolute_engine_load_pct',
      'throttle_position_pct',
      'relative_throttle_position_pct',
      'absolute_throttle_position_b_pct',
      'relative_accelerator_pedal_pct',
      'timing_advance_deg',
      'maf_g_s',
      'intake_manifold_pressure_kpa',
      'barometric_pressure_kpa',
      'fuel_pressure_kpa',
      'short_term_fuel_trim_bank1',
      'control_module_voltage_v',
    ]),
    scopeNote:
      'Diagnostic scope favors load, airflow, throttle, accelerator, timing, manifold pressure, barometric, fuel, speed, and voltage context plus any available powertrain DTCs.',
  },
  fuel_trim: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'engine_rpm',
      'vehicle_speed',
      'fuel_system_status',
      'throttle_position_pct',
      'maf_g_s',
      'fuel_pressure_kpa',
      'fuel_rail_pressure_relative_kpa',
      'fuel_rail_pressure_direct_kpa',
      'short_term_fuel_trim_bank1',
      'long_term_fuel_trim_bank1',
      'short_term_fuel_trim_bank2',
      'long_term_fuel_trim_bank2',
      'o2_sensor_b1s1',
      'o2_sensor_b1s2',
      'commanded_air_fuel_ratio_lambda',
      'coolant_temp_c',
      'intake_air_temp_c',
      'barometric_pressure_kpa',
      'control_module_voltage_v',
    ]),
    scopeNote:
      'Diagnostic scope favors fuel-trim, oxygen-sensor, rail-pressure, airflow, temperature, throttle, and voltage context plus any available powertrain DTCs.',
  },
  generic_powertrain: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'engine_rpm',
      'vehicle_speed',
      'engine_load',
      'absolute_engine_load_pct',
      'throttle_position_pct',
      'relative_throttle_position_pct',
      'coolant_temp_c',
      'intake_air_temp_c',
      'maf_g_s',
      'intake_manifold_pressure_kpa',
      'fuel_system_status',
      'control_module_voltage_v',
      'runtime_since_engine_start_s',
    ]),
    scopeNote:
      'Diagnostic scope favors a broad powertrain scan with richer load, airflow, temperature, throttle, runtime, and DTC context.',
  },
  transmission_context: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'engine_rpm',
      'vehicle_speed',
      'engine_load',
      'absolute_engine_load_pct',
      'throttle_position_pct',
      'relative_throttle_position_pct',
      'relative_accelerator_pedal_pct',
      'maf_g_s',
      'intake_manifold_pressure_kpa',
      'timing_advance_deg',
      'control_module_voltage_v',
      'engine_oil_temp_c',
    ]),
    scopeNote:
      'Diagnostic scope favors load, throttle, accelerator, speed, airflow, oil-temperature, voltage, and any available transmission-related DTC context.',
  },
  electrical_accessory: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'control_module_voltage_v',
      'engine_rpm',
      'vehicle_speed',
      'engine_load',
      'absolute_engine_load_pct',
      'runtime_since_engine_start_s',
    ]),
    scopeNote:
      'Diagnostic scope favors voltage context and any available electrical or communication DTCs. Mechanical confirmation may still be required.',
  },
  hvac_support: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: selectPids([
      'coolant_temp_c',
      'ambient_air_temp_c',
      'intake_air_temp_c',
      'engine_rpm',
      'engine_load',
      'vehicle_speed',
      'control_module_voltage_v',
    ]),
    scopeNote:
      'Diagnostic scope favors generic HVAC-supporting context such as coolant, ambient, intake temperature, load, speed, and voltage plus any available DTCs.',
  },
  dtc_only: {
    includeDtcsByDefault: true,
    defaultRequestedPidsJson: [],
    scopeNote:
      'OBD visibility is limited for this complaint, so this profile prioritizes any available DTCs and clear manual-inspection guidance instead of promising deep live-data coverage.',
  },
} satisfies Record<string, ProfilePlanTemplate>;

const PROFILE_QUALIFIERS: ProfileQualifierTemplate[] = [
  ['intermittent', 'Intermittent', 'intermittently'],
  ['constant', 'Constant', 'almost all the time'],
  ['after_startup', 'Worse After Startup', 'especially right after startup'],
  ['when_hot', 'Worse When Warm', 'once the vehicle is fully warm'],
  ['under_load', 'Worse Under Load', 'especially under load or heavier use'],
].map(([slug, label, exampleSuffix]) => ({ slug, label, exampleSuffix }));

const PROFILE_FAMILIES: FamilyRow[] = [
  [
    'cooling_overheating',
    'Overheating',
    'Cooling system',
    'cooling_core',
    'Targets engine temperature complaints and cooling-system stress symptoms.',
    [
      'engine runs hot',
      'temperature gauge climbs too high',
      'coolant warning comes on',
      'car overheats in traffic',
      'smells like hot coolant',
      'engine gets hot on hills',
      'temperature spikes at idle',
      'cooling system seems overwhelmed',
    ],
  ],
  [
    'coolant_loss_and_flow',
    'Coolant Loss / Flow Issue',
    'Cooling system',
    'cooling_core',
    'Targets coolant loss, thermostat, coolant-flow, and fan-timing complaints.',
    [
      'coolant level keeps dropping',
      'coolant reservoir keeps emptying',
      'there is coolant under the car after parking',
      'there is a sweet coolant smell',
      'upper radiator hose stays cold',
      'cabin heat comes and goes',
      'cooling fan comes on too late',
      'engine overheats after warm-up',
    ],
  ],
  [
    'rough_idle_and_stall',
    'Rough Idle / Stalling',
    'Engine / air-fuel control',
    'idle_airfuel',
    'Targets unstable idle, idle surge, and stoplight-stall complaints.',
    [
      'idle is rough',
      'engine shakes at idle',
      'rpm hunts at idle',
      'idle stays too high',
      'engine stalls at stop lights',
      'engine dies when idling',
      'car shuts off when coming to a stop',
      'engine stalls with the ac on',
    ],
  ],
  [
    'hard_start_and_no_start',
    'Hard Start / No-Start',
    'Starting / fuel / ignition',
    'starting',
    'Targets long-crank, hard-start, and no-start complaints.',
    [
      'it takes several cranks to start',
      'there is a long crank before the engine starts',
      'it is hard to start when cold',
      'it is hard to start when warm',
      'engine cranks but will not start',
      'engine starts and then dies immediately',
      'car refuses to start',
      'it starts only with some throttle input',
    ],
  ],
  [
    'misfire_and_rough_running',
    'Misfire / Rough Running',
    'Combustion / ignition / fuel',
    'performance_airflow',
    'Targets combustion instability, ignition faults, and rough-running complaints.',
    [
      'engine misfires',
      'engine shakes under load',
      'there is popping from the exhaust',
      'one cylinder seems dead',
      'check engine light flashes with rough running',
      'there is a shudder during acceleration',
      'the engine skips under load',
      'the car jerks while accelerating',
    ],
  ],
  [
    'poor_acceleration_and_hesitation',
    'Poor Acceleration / Hesitation',
    'Engine performance',
    'performance_airflow',
    'Targets low-power, sluggish, hesitation, and surge complaints.',
    [
      'car feels sluggish',
      'there is no power uphill',
      'throttle response feels weak',
      'it struggles to pick up speed',
      'it hesitates when accelerating',
      'it jerks when i press the throttle',
      'it surges while cruising',
      'it bucks during acceleration',
    ],
  ],
  [
    'fuel_consumption_and_rich_running',
    'Fuel Consumption / Rich Running',
    'Fuel control / combustion efficiency',
    'fuel_trim',
    'Targets excessive fuel use, rich-mixture, and raw-fuel complaints.',
    [
      'fuel economy dropped',
      'it uses too much fuel',
      'mileage is worse than usual',
      'the tank empties too fast',
      'it burns too much gasoline',
      'it smells like fuel',
      'engine runs rich',
      'the exhaust smell burns my eyes',
    ],
  ],
  [
    'smoke_and_oil_burn',
    'Exhaust Smoke / Oil Burning',
    'Powertrain / cooling / engine mechanical condition',
    'generic_powertrain',
    'Targets black-smoke, white-smoke, blue-smoke, and oil-burning complaints.',
    [
      'there is black smoke from the exhaust',
      'dark smoke appears on acceleration',
      'there is white smoke from the exhaust',
      'steam comes from the tailpipe after warm-up',
      'the exhaust smells like coolant',
      'there is blue smoke from the exhaust',
      'there is a burning oil smell',
      'oil level drops quickly',
    ],
  ],
  [
    'check_engine_and_emissions',
    'Check Engine / Emissions Warning',
    'Powertrain / emissions',
    'generic_powertrain',
    'Targets warning-lamp, emissions, and general engine-fault complaints.',
    [
      'check engine light is on',
      'service engine light came on',
      'engine warning light is illuminated',
      'emission warning light stays on',
      'check engine light keeps returning',
      'the car says service emission system',
      'there is an emissions fault message',
      'the engine warning came back after clearing it',
    ],
  ],
  [
    'battery_drain_and_voltage_drop',
    'Battery Drain / Voltage Drop',
    'Electrical / charging',
    'electrical_accessory',
    'Targets repeated discharge, low-voltage, and parked-battery complaints.',
    [
      'battery dies overnight',
      'battery goes flat after sitting',
      'there is a repeated dead battery problem',
      'car needs jump-starts often',
      'battery loses charge when parked',
      'electronics flicker',
      'dashboard lights pulse',
      'the radio resets itself',
    ],
  ],
  [
    'alternator_and_charging',
    'Alternator / Charging Issue',
    'Electrical / charging',
    'electrical_accessory',
    'Targets low charging output and battery-light complaints while driving.',
    [
      'battery light is on',
      'charging system warning appears',
      'lights dim while driving',
      'voltage drops when accessories are on',
      'alternator seems weak',
      'low voltage warnings appear',
      'control modules reboot randomly',
      'the car dies after the battery light comes on',
    ],
  ],
  [
    'starter_slow_crank',
    'Slow Crank / Weak Starter',
    'Starting / charging',
    'starting',
    'Targets weak cranking and slow starter complaints.',
    [
      'starter cranks slowly',
      'cranking speed is weak',
      'starter drags before the engine starts',
      'engine turns over very slowly',
      'there is a slow crank in the morning',
      'the starter sounds tired',
      'the engine barely turns over',
      'the car cranks slower every day',
    ],
  ],
  [
    'transmission_shift_quality',
    'Transmission Shift Quality',
    'Transmission / driveline',
    'transmission_context',
    'Targets harsh shifts, delayed engagement, and gear-change complaints.',
    [
      'shifts are harsh',
      'transmission bangs into gear',
      'upshifts are hard',
      'downshifts are hard',
      'gear changes feel jerky',
      'there is a delay before drive engages',
      'there is a delay before reverse engages',
      'it takes time to move after shifting into gear',
    ],
  ],
  [
    'transmission_slip_and_flare',
    'Transmission Slip / Flare',
    'Transmission / driveline',
    'transmission_context',
    'Targets slipping, flare, and gear-holding complaints.',
    [
      'transmission slips',
      'engine revs rise without matching speed',
      'the gear will not hold',
      'it slips in higher gears',
      'there is flare during shifts',
      'the transmission feels like it is freewheeling',
      'the engine races between gears',
      'the vehicle loses pull in gear',
    ],
  ],
  [
    'clutch_and_manual_driveline',
    'Clutch / Manual Driveline',
    'Manual transmission / driveline',
    'transmission_context',
    'Targets clutch slip, manual driveline, and shudder complaints where OBD visibility may be partial.',
    [
      'clutch slips under load',
      'engine revs but speed does not rise',
      'there is a burning clutch smell',
      'clutch grabs very high',
      'clutch feels weak',
      'there is drivetrain vibration on takeoff',
      'there is a shudder at speed',
      'there is vibration under acceleration',
    ],
  ],
  [
    'soft_brake_pedal',
    'Soft Brake Pedal / Weak Braking',
    'Braking system',
    'dtc_only',
    'Targets weak braking and long stopping-distance complaints that often require manual hydraulic inspection.',
    [
      'brakes feel weak',
      'brake pedal is soft',
      'brake pedal sinks too far',
      'stopping distance feels longer',
      'it takes too long to stop',
      'the brake pedal feels spongy',
      'the car does not stop confidently',
      'the brake response feels delayed',
    ],
  ],
  [
    'brake_noise_and_abs',
    'Brake Noise / ABS Warning',
    'Braking / chassis control',
    'dtc_only',
    'Targets noisy braking, ABS lights, and traction-control complaints.',
    [
      'brakes are grinding',
      'brakes are squealing',
      'there is a scraping noise when braking',
      'there is a metal sound from the brakes',
      'abs light is on',
      'traction light stays on',
      'abs warning keeps returning',
      'abs activates unexpectedly',
    ],
  ],
  [
    'brake_pull_and_wheel_drag',
    'Brake Pull / Wheel Drag',
    'Braking system',
    'dtc_only',
    'Targets pull, drag, and uneven left-right braking complaints.',
    [
      'the car pulls while braking',
      'the brakes grab on one side',
      'the steering wheel jerks under braking',
      'braking feels uneven',
      'braking makes the car drift in its lane',
      'one wheel seems to drag after braking',
      'the car slows down by itself after braking',
      'one brake feels hotter than the others',
    ],
  ],
  [
    'steering_heavy_and_alignment',
    'Heavy Steering / Alignment Issue',
    'Steering / suspension / tires',
    'dtc_only',
    'Targets steering effort, alignment, pull, and steering-wheel position complaints.',
    [
      'steering feels heavy',
      'it is hard to turn the wheel',
      'power steering seems weak',
      'steering is stiff at low speed',
      'steering wheel is off center',
      'the car pulls to one side',
      'there is vibration through the steering wheel',
      'the car wanders on the road',
    ],
  ],
  [
    'suspension_and_chassis_noise',
    'Suspension / Chassis Noise',
    'Suspension',
    'dtc_only',
    'Targets clunk, rattle, and impact-noise complaints from the suspension or chassis.',
    [
      'there is a clunk over bumps',
      'the front end knocks',
      'there is suspension noise on potholes',
      'there is a rear suspension thump',
      'there is a rattling noise from the suspension',
      'the car feels loose over bumps',
      'something knocks when turning into driveways',
      'the suspension sounds worn out',
    ],
  ],
  [
    'tpms_and_tire_pressure',
    'TPMS / Tire Pressure Issue',
    'Tire pressure monitoring / tires',
    'dtc_only',
    'Targets TPMS warnings and recurring low-pressure complaints.',
    [
      'tire pressure light is on',
      'one tire keeps losing pressure',
      'tpms warning keeps returning',
      'low tire warning returns after inflation',
      'tire pressure readings seem wrong',
      'the tpms light flashes before staying on',
      'the system warns about a tire that looks full',
      'the tire monitor is unreliable',
    ],
  ],
  [
    'ac_cooling_issue',
    'AC Cooling Issue',
    'HVAC / air conditioning',
    'hvac_support',
    'Targets weak cabin cooling and AC performance complaints. OBD visibility may be partial depending on the vehicle.',
    [
      'ac is not cold',
      'cabin takes too long to cool',
      'ac gets warm at idle',
      'cooling from the vents feels weak',
      'ac cools only while driving',
      'the ac is cold on one side only',
      'the cabin never gets truly cold',
      'the ac struggles in traffic',
    ],
  ],
  [
    'heater_and_blower_issue',
    'Heater / Blower Issue',
    'HVAC / engine cooling support',
    'hvac_support',
    'Targets weak cabin heat, defroster complaints, and blower-speed issues.',
    [
      'heater blows cold air',
      'cabin heat is weak',
      'there is no heat at idle',
      'cabin heat fades while driving',
      'the defroster is not warming up',
      'blower fan does not work',
      'blower works only on one speed',
      'cabin fan cuts out',
    ],
  ],
  [
    'window_lock_accessory_issue',
    'Windows / Locks / Mirrors Accessory Issue',
    'Body electrical',
    'electrical_accessory',
    'Targets common body-electrical accessory complaints where voltage and module faults may matter.',
    [
      'power windows do not work',
      'door locks act up',
      'mirror controls fail',
      'trunk release is intermittent',
      'sunroof will not move',
      'one window is slower than the others',
      'the central locking is unreliable',
      'mirror adjustment stopped working',
    ],
  ],
  [
    'body_network_and_wiper_horn',
    'Body / Network / Wiper / Horn Issue',
    'Body electrical / communication network',
    'electrical_accessory',
    'Targets horn, wiper, warning-light, and accessory communication complaints.',
    [
      'horn does not work',
      'wipers behave strangely',
      'warning lights flicker',
      'a communication error message appears',
      'control modules keep losing connection',
      'the cluster behaves erratically',
      'the car randomly reports module faults',
      'body electronics fail together',
    ],
  ],
];

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .map((token) => (token.length > 0 ? `${token[0].toUpperCase()}${token.slice(1)}` : token))
    .join(' ');
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
}

function buildProfileDescription(
  familyName: string,
  system: string,
  familySummary: string,
  plan: ProfilePlanTemplate,
  complaint: string,
  qualifier: ProfileQualifierTemplate,
): string {
  return [
    `System: ${system}.`,
    `${familyName}. ${familySummary}`,
    plan.scopeNote,
    `Symptom focus: ${complaint}.`,
    `Typical user wording: "${complaint} ${qualifier.exampleSuffix}."`,
  ].join(' ');
}

export const DIAGNOSTIC_PROFILES_SEED = PROFILE_FAMILIES.flatMap(
  ([familyCode, familyName, system, planKey, familySummary, complaints]) =>
    complaints.flatMap((complaint) =>
      PROFILE_QUALIFIERS.map((qualifier) => {
        const plan = PROFILE_PLAN_LIBRARY[planKey];
        const complaintLabel = toTitleCase(
          complaint.replace(/^there is /, '').replace(/^the /, '').replace(/^it /, ''),
        );

        return {
          code: `${familyCode}__${toSlug(complaint)}__${qualifier.slug}`,
          name: `${familyName}: ${complaintLabel} (${qualifier.label})`,
          description: buildProfileDescription(
            familyName,
            system,
            familySummary,
            plan,
            complaint,
            qualifier,
          ),
          includeDtcsByDefault: plan.includeDtcsByDefault,
          defaultRequestedPidsJson: plan.defaultRequestedPidsJson,
        };
      }),
    ),
);

if (DIAGNOSTIC_PROFILES_SEED.length !== 1000) {
  throw new Error(
    `Expected 1000 diagnostic profiles in seed, found ${DIAGNOSTIC_PROFILES_SEED.length}.`,
  );
}
