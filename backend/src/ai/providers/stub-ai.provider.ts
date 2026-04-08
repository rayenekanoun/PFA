import { Injectable } from '@nestjs/common';
import type { ClassificationInput, ComplaintClassification, DiagnosticReportPayload, ReportGenerationInput } from '../ai.schemas';
import type { AiProvider } from './ai-provider.interface';

const PROFILE_KEYWORDS: Record<string, string[]> = {
  fuel_consumption: ['fuel', 'gasoline', 'diesel', 'consume', 'consumption', 'rich', 'economy'],
  overheating: ['hot', 'overheat', 'temperature', 'coolant', 'fan'],
  rough_idle: ['idle', 'vibration', 'shake', 'misfire', 'stall'],
  battery_issue: ['battery', 'voltage', 'alternator', 'charging', 'start', 'starter'],
};

@Injectable()
export class StubAiProvider implements AiProvider {
  public async classifyComplaint(input: ClassificationInput): Promise<ComplaintClassification> {
    const lower = input.complaintText.toLowerCase();
    const scoredProfiles = input.availableProfiles.map((profile) => {
      const keywords = PROFILE_KEYWORDS[profile.code] ?? [];
      const score = keywords.reduce((total, keyword) => total + (lower.includes(keyword) ? 1 : 0), 0);
      return { profile, score };
    });

    const best = scoredProfiles.sort((a, b) => b.score - a.score)[0] ?? null;
    if (!best || best.score === 0) {
      const fallback = input.availableProfiles[0];
      return {
        profileCode: fallback?.code ?? 'rough_idle',
        confidence: 0.35,
        rationale: 'No strong keyword match was found, so the backend used the default fallback profile.',
      };
    }

    return {
      profileCode: best.profile.code,
      confidence: Math.min(0.55 + best.score * 0.1, 0.95),
      rationale: `Selected '${best.profile.name}' based on complaint keywords that matched the request text.`,
    };
  }

  public async generateReport(input: ReportGenerationInput): Promise<DiagnosticReportPayload> {
    const dtcCodes = input.summary.dtcs.map((dtc) => dtc.code);
    const lowMeasurements = input.summary.measurements
      .filter((measurement) => measurement.status === 'ok' && typeof measurement.value === 'number')
      .slice(0, 3)
      .map((measurement) => `${measurement.label}: ${measurement.value}${measurement.unit ? ` ${measurement.unit}` : ''}`);

    return {
      summary:
        dtcCodes.length > 0
          ? `The diagnostic run completed with ${dtcCodes.length} DTC(s) and ${input.summary.measurements.length} captured measurement(s).`
          : `The diagnostic run completed with ${input.summary.measurements.length} captured measurement(s) and no DTCs reported.`,
      possibleCauses: dtcCodes.length > 0 ? dtcCodes.map((code) => `Investigate the fault behind ${code}.`) : ['No confirmed fault code was present, so focus on live-sensor trends and follow-up inspection.'],
      nextSteps: [
        'Review the measurements marked as missing or unsupported before assuming a clean result.',
        ...(lowMeasurements.length > 0 ? [`Compare these key measurements against expected ranges: ${lowMeasurements.join(', ')}.`] : []),
      ],
      caveats: [
        'This report is generated from structured diagnostic data, not direct raw-byte interpretation by AI.',
        ...(input.summary.missing.length > 0 ? [`Some requested measurements were unavailable: ${input.summary.missing.join(', ')}.`] : []),
      ],
      confidence: dtcCodes.length > 0 ? 0.8 : 0.62,
    };
  }
}
