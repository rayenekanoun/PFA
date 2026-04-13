export interface DtcExplanation {
  system: string;
  humanTitle: string;
  humanExplanation: string;
}

const SPECIFIC_DTC_EXPLANATIONS: Record<string, DtcExplanation> = {
  P0117: {
    system: 'Powertrain',
    humanTitle: 'Coolant temperature sensor signal too low',
    humanExplanation:
      'Plain English: the engine computer thinks the coolant temperature sensor is reading lower voltage than expected, which often points to a bad sensor, wiring issue, or a sensor circuit problem.',
  },
  P0171: {
    system: 'Powertrain',
    humanTitle: 'Fuel mixture too lean on bank 1',
    humanExplanation:
      'Plain English: the engine is running with too much air and not enough fuel on bank 1. Common causes include vacuum leaks, low fuel pressure, or an airflow sensor problem.',
  },
  P0172: {
    system: 'Powertrain',
    humanTitle: 'Fuel mixture too rich on bank 1',
    humanExplanation:
      'Plain English: the engine is running with too much fuel and not enough air on bank 1. Common causes include leaking injectors, a faulty airflow reading, or excessive fuel pressure.',
  },
  P0217: {
    system: 'Powertrain',
    humanTitle: 'Engine overtemperature condition',
    humanExplanation:
      'Plain English: the engine got hotter than the safe operating range. Common causes include low coolant, a stuck thermostat, a failing cooling fan, a weak water pump, or restricted coolant flow.',
  },
  P0300: {
    system: 'Powertrain',
    humanTitle: 'Random or multiple cylinder misfire detected',
    humanExplanation:
      'Plain English: the engine is misfiring on one or more cylinders. Common causes include ignition faults, fuel delivery issues, intake leaks, or low compression.',
  },
  P0420: {
    system: 'Powertrain',
    humanTitle: 'Catalyst efficiency below threshold',
    humanExplanation:
      'Plain English: the catalytic converter is not cleaning exhaust gases as effectively as expected. Common causes include a worn catalyst, exhaust leaks, or upstream fuel-control problems.',
  },
  P0562: {
    system: 'Powertrain',
    humanTitle: 'System voltage low',
    humanExplanation:
      'Plain English: the car’s electrical system voltage dropped below the expected range. Common causes include a weak battery, alternator problems, or poor cable connections.',
  },
};

const DTC_SYSTEM_BY_PREFIX: Record<string, string> = {
  B: 'Body',
  C: 'Chassis',
  P: 'Powertrain',
  U: 'Network / communication',
};

export function explainDtc(code: string, description: string | null): DtcExplanation {
  const normalizedCode = code.trim().toUpperCase();
  const specific = SPECIFIC_DTC_EXPLANATIONS[normalizedCode];
  if (specific) {
    return specific;
  }

  const system = DTC_SYSTEM_BY_PREFIX[normalizedCode[0] ?? ''] ?? 'Vehicle system';
  const normalizedDescription = description?.trim() || 'diagnostic trouble code reported by the control module';

  return {
    system,
    humanTitle: normalizedDescription,
    humanExplanation:
      `Plain English: this is a ${system.toLowerCase()} fault code. ` +
      `The control module detected a problem related to ${normalizedDescription.toLowerCase()}. ` +
      'Further testing is needed to confirm the exact failed part.',
  };
}
