import { Injectable } from '@nestjs/common';
import type {
  ClassificationInput,
  ComplaintClassification,
  DiagnosticReportPayload,
  FollowUpAnswerInput,
  FollowUpAnswerPayload,
  ReportGenerationInput,
} from '../ai.schemas';
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
    const dtcSummaries = input.summary.dtcs.map(
      (dtc) => `${dtc.code}: ${dtc.humanExplanation ?? dtc.description}`,
    );
    const lowMeasurements = input.summary.measurements
      .filter((measurement) => measurement.status === 'ok' && typeof measurement.value === 'number')
      .slice(0, 3)
      .map((measurement) => `${measurement.label}: ${measurement.value}${measurement.unit ? ` ${measurement.unit}` : ''}`);

    return {
      summary:
        dtcSummaries.length > 0
          ? `The diagnostic run completed with ${dtcSummaries.length} DTC(s) and ${input.summary.measurements.length} captured measurement(s).`
          : `The diagnostic run completed with ${input.summary.measurements.length} captured measurement(s) and no DTCs reported.`,
      possibleCauses:
        dtcSummaries.length > 0
          ? dtcSummaries
          : ['No confirmed fault code was present, so focus on live-sensor trends and follow-up inspection.'],
      nextSteps: [
        'Review the measurements marked as missing or unsupported before assuming a clean result.',
        ...(lowMeasurements.length > 0 ? [`Compare these key measurements against expected ranges: ${lowMeasurements.join(', ')}.`] : []),
      ],
      caveats: [
        'This report is generated from structured diagnostic data, not direct raw-byte interpretation by AI.',
        ...(input.summary.missing.length > 0 ? [`Some requested measurements were unavailable: ${input.summary.missing.join(', ')}.`] : []),
      ],
      confidence: dtcSummaries.length > 0 ? 0.8 : 0.62,
    };
  }

  public async answerFollowUp(input: FollowUpAnswerInput): Promise<FollowUpAnswerPayload> {
    const normalizedQuestion = input.question.trim().toLowerCase();
    const measurementMatches = input.summary.measurements.filter((measurement) => {
      const key = measurement.key.toLowerCase();
      const label = measurement.label.toLowerCase();
      return normalizedQuestion.includes(key) || normalizedQuestion.includes(label);
    });
    const dtcMatches = input.summary.dtcs.filter((dtc) => {
      const code = dtc.code.toLowerCase();
      const title = dtc.humanTitle.toLowerCase();
      return normalizedQuestion.includes(code) || normalizedQuestion.includes(title);
    });

    if (measurementMatches.length === 0 && dtcMatches.length === 0) {
      return {
        answer:
          'I do not know based on the current vehicle and device data. The saved report does not contain enough matching information to answer that follow-up confidently.',
        grounded: false,
        confidence: 0.2,
        usedSources: [],
      };
    }

    const measurementText = measurementMatches.map((measurement) => {
      const value =
        measurement.value === null || measurement.value === undefined
          ? 'unavailable'
          : typeof measurement.value === 'object'
            ? JSON.stringify(measurement.value)
            : String(measurement.value);
      return `${measurement.label}: ${value}${measurement.unit ? ` ${measurement.unit}` : ''} (${measurement.status})`;
    });
    const dtcText = dtcMatches.map((dtc) => `${dtc.code}: ${dtc.humanExplanation}`);

    return {
      answer: [measurementText.join('; '), dtcText.join('; ')]
        .filter((entry) => entry.length > 0)
        .join(' ')
        .trim(),
      grounded: true,
      confidence: 0.74,
      usedSources: [
        ...(measurementMatches.length > 0 ? ['measurements'] : []),
        ...(dtcMatches.length > 0 ? ['dtcs'] : []),
      ],
    };
  }
}
