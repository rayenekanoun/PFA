import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { complaintClassificationSchema, diagnosticReportSchema, type ClassificationInput, type ComplaintClassification, type DiagnosticReportPayload, type ReportGenerationInput } from '../ai.schemas';
import type { AiProvider } from './ai-provider.interface';

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  public constructor(private readonly configService: ConfigService) {}

  public async classifyComplaint(input: ClassificationInput): Promise<ComplaintClassification> {
    const content = await this.requestJson([
      {
        role: 'system',
        content:
          'You classify car-diagnostic complaints into one of the available profile codes. Return strict JSON only with keys: profileCode, confidence, rationale.',
      },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ]);

    return complaintClassificationSchema.parse(content);
  }

  public async generateReport(input: ReportGenerationInput): Promise<DiagnosticReportPayload> {
    const content = await this.requestJson([
      {
        role: 'system',
        content:
          'You generate a structured diagnostic report from normalized backend data. Return strict JSON only with keys: summary, possibleCauses, nextSteps, caveats, confidence. If DTCs are present, explain each code in plain English instead of only repeating the raw code.',
      },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ]);

    return diagnosticReportSchema.parse(content);
  }

  private async requestJson(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<unknown> {
    const apiKey = this.configService.get<string>('AI_API_KEY');
    if (!apiKey) {
      this.logger.warn('AI_PROVIDER is openai-compatible, but AI_API_KEY is missing.');
      throw new Error('AI_API_KEY is required for the openai-compatible provider.');
    }

    const response = await fetch(`${this.configService.getOrThrow<string>('AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.configService.getOrThrow<string>('AI_MODEL'),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`AI request failed with status ${response.status}: ${bodyText}`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI response did not include message content.');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`AI response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
