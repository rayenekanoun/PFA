import { Inject, Injectable, Logger } from '@nestjs/common';
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
} from './ai.schemas';
import type { AiProvider } from './providers/ai-provider.interface';
import { StubAiProvider } from './providers/stub-ai.provider';

export const AI_PROVIDER_TOKEN = 'AI_PROVIDER_TOKEN';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  public constructor(
    @Inject(AI_PROVIDER_TOKEN) private readonly provider: AiProvider,
    private readonly configService: ConfigService,
    private readonly stubProvider: StubAiProvider,
  ) {}

  public async classifyComplaint(input: ClassificationInput): Promise<ComplaintClassification> {
    try {
      return complaintClassificationSchema.parse(await this.provider.classifyComplaint(input));
    } catch (error) {
      if (!this.shouldFallbackToStub()) {
        throw new Error(
          `AI provider '${this.getProviderName()}' failed during complaint classification: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.logger.warn(
        `Falling back to stub complaint classification because the configured provider failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return complaintClassificationSchema.parse(await this.stubProvider.classifyComplaint(input));
    }
  }

  public async generateReport(input: ReportGenerationInput): Promise<DiagnosticReportPayload> {
    try {
      return diagnosticReportSchema.parse(await this.provider.generateReport(input));
    } catch (error) {
      if (!this.shouldFallbackToStub()) {
        throw new Error(
          `AI provider '${this.getProviderName()}' failed during report generation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.logger.warn(
        `Falling back to stub diagnostic report generation because the configured provider failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return diagnosticReportSchema.parse(await this.stubProvider.generateReport(input));
    }
  }

  public async answerFollowUp(input: FollowUpAnswerInput): Promise<FollowUpAnswerPayload> {
    try {
      return followUpAnswerSchema.parse(await this.provider.answerFollowUp(input));
    } catch (error) {
      if (!this.shouldFallbackToStub()) {
        throw new Error(
          `AI provider '${this.getProviderName()}' failed during follow-up answering: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      this.logger.warn(
        `Falling back to stub follow-up answering because the configured provider failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return followUpAnswerSchema.parse(await this.stubProvider.answerFollowUp(input));
    }
  }

  public getProviderName(): string {
    return this.configService.get<string>('AI_PROVIDER', 'stub');
  }

  private shouldFallbackToStub(): boolean {
    if (this.getProviderName() === 'stub') {
      return false;
    }

    return this.configService.get<boolean>('AI_ALLOW_STUB_FALLBACK', false) === true;
  }
}
