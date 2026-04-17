import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  complaintClassificationSchema,
  diagnosticReportSchema,
  followUpAnswerSchema,
  type ClassificationInput,
  type ComplaintClassification,
  type DiagnosticReportPayload,
  type FollowUpAnswerInput,
  type FollowUpAnswerPayload,
  type ReportGenerationInput,
} from '../ai.schemas';
import type { AiProvider } from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  public constructor(private readonly configService: ConfigService) {}

  public async classifyComplaint(input: ClassificationInput): Promise<ComplaintClassification> {
    const content = await this.requestJson({
      instruction:
        'You classify car-diagnostic complaints into one of the available profile codes. Return strict JSON only with keys: profileCode, confidence, rationale.',
      input,
    });
    return complaintClassificationSchema.parse(content);
  }

  public async generateReport(input: ReportGenerationInput): Promise<DiagnosticReportPayload> {
    const content = await this.requestJson({
      instruction:
        'You generate a structured diagnostic report from normalized backend data. Return strict JSON only with keys: summary, possibleCauses, nextSteps, caveats, confidence. If DTCs are present, explain each code in plain English instead of only repeating the raw code.',
      input,
    });
    return diagnosticReportSchema.parse(content);
  }

  public async answerFollowUp(input: FollowUpAnswerInput): Promise<FollowUpAnswerPayload> {
    const content = await this.requestJson({
      instruction:
        'You answer a follow-up question about a previously completed vehicle diagnostic report. Use only the provided summary, report, and message history. If the answer is not directly supported by the provided data, say that you do not know based on the current vehicle/device data. Return strict JSON only with keys: answer, grounded, confidence, usedSources.',
      input,
    });
    return followUpAnswerSchema.parse(content);
  }

  private async requestJson(payload: { instruction: string; input: unknown }): Promise<unknown> {
    const apiKey = this.configService.get<string>('AI_API_KEY');
    if (!apiKey) {
      this.logger.warn('AI_PROVIDER is gemini, but AI_API_KEY is missing.');
      throw new Error('AI_API_KEY is required for the gemini provider.');
    }

    const baseUrl = this.configService.get<string>(
      'AI_BASE_URL',
      'https://generativelanguage.googleapis.com',
    );
    const model = this.configService.get<string>('AI_MODEL', 'gemini-2.5-flash');

    const response = await fetch(`${baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${payload.instruction}\n\nInput:\n${JSON.stringify(payload.input)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Gemini request failed with status ${response.status}: ${bodyText}`);
    }

    const body = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const contentText = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) {
      throw new Error('Gemini response did not include content text.');
    }

    try {
      return JSON.parse(contentText);
    } catch (error) {
      throw new Error(
        `Gemini response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
