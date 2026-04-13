import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AiService } from '../src/ai/ai.service';
import type { AiProvider } from '../src/ai/providers/ai-provider.interface';
import { GeminiProvider } from '../src/ai/providers/gemini.provider';
import { OpenAiCompatibleProvider } from '../src/ai/providers/openai-compatible.provider';
import { StubAiProvider } from '../src/ai/providers/stub-ai.provider';
import { VertexAiProvider } from '../src/ai/providers/vertex-ai.provider';
import { validateEnv, type AppEnv } from '../src/config/env.schema';
import { explainDtc } from '../src/diagnostics/utils/dtc-explainer.util';
import { selectProfilesForComplaint } from '../src/profiles/profile-matching.util';
import { DIAGNOSTIC_PROFILES_SEED } from '../src/seeds/seed-data/diagnostic-profiles.seed';

type ConfigLike = {
  get<T>(key: string, defaultValue?: T): T | undefined;
  getOrThrow<T>(key: string): T;
};

function loadDotEnv(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const env: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    env[key] = value;
  }

  return env;
}

function createConfig(env: AppEnv): ConfigLike {
  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      const value = env[key as keyof AppEnv];
      return (value as T | undefined) ?? defaultValue;
    },
    getOrThrow<T>(key: string): T {
      const value = env[key as keyof AppEnv];
      if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required config value: ${key}`);
      }
      return value as T;
    },
  };
}

function selectProvider(config: ConfigLike): { name: string; provider: AiProvider; stubProvider: StubAiProvider } {
  const stubProvider = new StubAiProvider();
  const providerName = config.get<string>('AI_PROVIDER', 'stub') ?? 'stub';

  if (providerName === 'vertex') {
    return {
      name: providerName,
      provider: new VertexAiProvider(config as never),
      stubProvider,
    };
  }

  if (providerName === 'gemini') {
    return {
      name: providerName,
      provider: new GeminiProvider(config as never),
      stubProvider,
    };
  }

  if (providerName === 'openai-compatible') {
    return {
      name: providerName,
      provider: new OpenAiCompatibleProvider(config as never),
      stubProvider,
    };
  }

  return {
    name: 'stub',
    provider: stubProvider,
    stubProvider,
  };
}

function buildDtc(code: string, description: string, severity: string, state: string) {
  const explanation = explainDtc(code, description);
  return {
    code,
    description,
    severity,
    state,
    system: explanation.system,
    humanTitle: explanation.humanTitle,
    humanExplanation: explanation.humanExplanation,
  };
}

function buildSmokeSummary(
  complaintText: string,
  classification: {
    profileCode: string;
    confidence: number;
    rationale: string;
  },
) {
  const familyCode = classification.profileCode.split('__')[0] ?? classification.profileCode;

  const baseSummary = {
    requestId: 'smoke-request',
    runId: 'smoke-run',
    complaintText,
    requestStatus: 'COMPLETED',
    profile: {
      code: classification.profileCode,
      name: classification.profileCode.replace(/_/g, ' '),
      description: 'Smoke-test profile description.',
      confidence: classification.confidence,
      rationale: classification.rationale,
    },
    vehicle: {
      id: 'vehicle-smoke',
      mqttCarId: 'sim-smoke',
      vin: null,
      make: 'Toyota',
      model: 'Corolla',
      year: 2014,
    },
  };

  if (
    familyCode === 'soft_brake_pedal' ||
    familyCode === 'brake_noise_and_abs' ||
    familyCode === 'brake_pull_and_wheel_drag' ||
    familyCode === 'steering_heavy_and_alignment' ||
    familyCode === 'suspension_and_chassis_noise' ||
    familyCode === 'tpms_and_tire_pressure'
  ) {
    return {
      ...baseSummary,
      requestedMeasurements: [
        { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 1 },
        { key: 'vehicle_speed', mode: '01', pid: '0D', priority: 2 },
      ],
      measurements: [
        {
          key: 'control_module_voltage_v',
          label: 'Control Module Voltage',
          value: 12.4,
          unit: 'V',
          status: 'ok',
          rawValue: '12.4',
        },
        {
          key: 'vehicle_speed',
          label: 'Vehicle Speed',
          value: 35,
          unit: 'km/h',
          status: 'ok',
          rawValue: '35',
        },
      ],
      dtcs: [
        buildDtc('C1234', 'Wheel speed sensor fault', 'medium', 'stored'),
      ],
      missing: [],
      observations: [
        'Brake- or chassis-related complaints often need manual inspection because generic OBD coverage is limited.',
        'Vehicle speed data is available, but hydraulic or mechanical brake wear is not directly visible in these sample readings.',
      ],
    };
  }

  if (
    familyCode === 'battery_drain_and_voltage_drop' ||
    familyCode === 'alternator_and_charging' ||
    familyCode === 'starter_slow_crank' ||
    familyCode === 'window_lock_accessory_issue' ||
    familyCode === 'body_network_and_wiper_horn'
  ) {
    return {
      ...baseSummary,
      requestedMeasurements: [
        { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 1 },
        { key: 'engine_rpm', mode: '01', pid: '0C', priority: 2 },
      ],
      measurements: [
        {
          key: 'control_module_voltage_v',
          label: 'Control Module Voltage',
          value: 11.6,
          unit: 'V',
          status: 'ok',
          rawValue: '11.6',
        },
        {
          key: 'engine_rpm',
          label: 'Engine RPM',
          value: 820,
          unit: 'rpm',
          status: 'ok',
          rawValue: '820',
        },
      ],
      dtcs: [
        buildDtc('P0562', 'System Voltage Low', 'high', 'stored'),
      ],
      missing: [],
      observations: [
        'Control module voltage is low at 11.6 V.',
        'Low system voltage can affect charging, starting, and accessory modules.',
      ],
    };
  }

  if (
    familyCode === 'transmission_shift_quality' ||
    familyCode === 'transmission_slip_and_flare' ||
    familyCode === 'clutch_and_manual_driveline'
  ) {
    return {
      ...baseSummary,
      requestedMeasurements: [
        { key: 'engine_rpm', mode: '01', pid: '0C', priority: 1 },
        { key: 'vehicle_speed', mode: '01', pid: '0D', priority: 2 },
        { key: 'engine_load', mode: '01', pid: '04', priority: 3 },
      ],
      measurements: [
        {
          key: 'engine_rpm',
          label: 'Engine RPM',
          value: 2800,
          unit: 'rpm',
          status: 'ok',
          rawValue: '2800',
        },
        {
          key: 'vehicle_speed',
          label: 'Vehicle Speed',
          value: 48,
          unit: 'km/h',
          status: 'ok',
          rawValue: '48',
        },
        {
          key: 'engine_load',
          label: 'Calculated Engine Load',
          value: 68,
          unit: '%',
          status: 'ok',
          rawValue: '68',
        },
      ],
      dtcs: [
        buildDtc('P0700', 'Transmission control system malfunction', 'medium', 'stored'),
      ],
      missing: [],
      observations: [
        'Engine speed appears elevated relative to road speed in this sample.',
        'Transmission and clutch complaints may still require fluid, hydraulic, or mechanical inspection.',
      ],
    };
  }

  if (familyCode === 'ac_cooling_issue') {
    return {
      ...baseSummary,
      requestedMeasurements: [
        { key: 'coolant_temp_c', mode: '01', pid: '05', priority: 1 },
        { key: 'engine_load', mode: '01', pid: '04', priority: 2 },
        { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 3 },
      ],
      measurements: [
        {
          key: 'coolant_temp_c',
          label: 'Coolant Temperature',
          value: 94,
          unit: 'C',
          status: 'ok',
          rawValue: '94',
        },
        {
          key: 'engine_load',
          label: 'Calculated Engine Load',
          value: 38,
          unit: '%',
          status: 'ok',
          rawValue: '38',
        },
        {
          key: 'control_module_voltage_v',
          label: 'Control Module Voltage',
          value: 12.2,
          unit: 'V',
          status: 'ok',
          rawValue: '12.2',
        },
      ],
      dtcs: [],
      missing: [],
      observations: [
        'AC complaints often need refrigerant-pressure and actuator checks that generic OBD data may not expose directly.',
        'Electrical stability and engine load can still influence AC behavior.',
      ],
    };
  }

  if (
    familyCode === 'cooling_overheating' ||
    familyCode === 'coolant_loss_and_flow' ||
    familyCode === 'heater_and_blower_issue'
  ) {
    return {
      ...baseSummary,
      requestedMeasurements: [
        { key: 'coolant_temp_c', mode: '01', pid: '05', priority: 1 },
        { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 2 },
      ],
      measurements: [
        {
          key: 'coolant_temp_c',
          label: 'Coolant Temperature',
          value: 109,
          unit: 'C',
          status: 'ok',
          rawValue: '109',
        },
        {
          key: 'control_module_voltage_v',
          label: 'Control Module Voltage',
          value: 11.8,
          unit: 'V',
          status: 'ok',
          rawValue: '11.8',
        },
      ],
      dtcs: [
        buildDtc('P0217', 'Engine Overtemperature Condition', 'high', 'stored'),
      ],
      missing: [],
      observations: [
        'Coolant temperature is elevated at 109 C.',
        'Control module voltage is low at 11.8 V.',
      ],
    };
  }

  return {
    ...baseSummary,
    requestedMeasurements: [
      { key: 'engine_rpm', mode: '01', pid: '0C', priority: 1 },
      { key: 'throttle_position_pct', mode: '01', pid: '11', priority: 2 },
      { key: 'maf_g_s', mode: '01', pid: '10', priority: 3 },
      { key: 'control_module_voltage_v', mode: '01', pid: '42', priority: 4 },
    ],
    measurements: [
      {
        key: 'engine_rpm',
        label: 'Engine RPM',
        value: 920,
        unit: 'rpm',
        status: 'ok',
        rawValue: '920',
      },
      {
        key: 'throttle_position_pct',
        label: 'Throttle Position',
        value: 17,
        unit: '%',
        status: 'ok',
        rawValue: '17',
      },
      {
        key: 'maf_g_s',
        label: 'Mass Air Flow',
        value: 4.8,
        unit: 'g/s',
        status: 'ok',
        rawValue: '4.8',
      },
      {
        key: 'control_module_voltage_v',
        label: 'Control Module Voltage',
        value: 12.1,
        unit: 'V',
        status: 'ok',
        rawValue: '12.1',
      },
    ],
    dtcs: [
      buildDtc('P0300', 'Random/Multiple Cylinder Misfire Detected', 'medium', 'stored'),
    ],
    missing: [],
    observations: [
      'The sample includes a powertrain fault to help the report generator explain the issue in plain language.',
      'Airflow, throttle, and voltage context are available in this smoke-test payload.',
    ],
  };
}

async function main() {
  const backendRoot = process.cwd();
  const envFromFile = loadDotEnv(join(backendRoot, '.env'));
  const mergedEnv = validateEnv({
    ...envFromFile,
    ...process.env,
  });
  const config = createConfig(mergedEnv);
  const { name, provider, stubProvider } = selectProvider(config);
  const aiService = new AiService(provider, config as never, stubProvider);
  const complaintText =
    process.argv.slice(2).join(' ').trim() || 'The engine runs hot in traffic and the coolant temperature looks high.';

  console.log(`AI provider: ${name}`);
  console.log(`Complaint: ${complaintText}`);

  const candidateProfiles = selectProfilesForComplaint(DIAGNOSTIC_PROFILES_SEED, complaintText, {
    limit: 48,
    maxPerFamily: 3,
  });
  console.log(`Candidate profiles sent to AI: ${candidateProfiles.length}`);

  const classification = await aiService.classifyComplaint({
    complaintText,
    availableProfiles: candidateProfiles.map((profile) => ({
      code: profile.code,
      name: profile.name,
      description: profile.description,
    })),
  });

  console.log('\nClassification result:');
  console.log(JSON.stringify(classification, null, 2));

  const report = await aiService.generateReport({
    summary: buildSmokeSummary(complaintText, classification),
  });

  console.log('\nReport result:');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
