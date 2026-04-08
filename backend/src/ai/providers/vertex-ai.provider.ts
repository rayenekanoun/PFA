import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import {
  complaintClassificationSchema,
  diagnosticReportSchema,
  type ClassificationInput,
  type ComplaintClassification,
  type DiagnosticReportPayload,
  type ReportGenerationInput,
} from '../ai.schemas';
import type { AiProvider } from './ai-provider.interface';

interface ServiceAccountCredential {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

@Injectable()
export class VertexAiProvider implements AiProvider {
  private readonly logger = new Logger(VertexAiProvider.name);
  private readonly scope = 'https://www.googleapis.com/auth/cloud-platform';

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
        'You generate a structured diagnostic report from normalized backend data. Return strict JSON only with keys: summary, possibleCauses, nextSteps, caveats, confidence.',
      input,
    });
    return diagnosticReportSchema.parse(content);
  }

  private async requestJson(payload: { instruction: string; input: unknown }): Promise<unknown> {
    const projectId = this.resolveProjectId();
    const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');
    const model = this.configService.get<string>('VERTEX_MODEL', 'gemini-2.5-flash');
    const accessToken = await this.getAccessToken();
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
      throw new Error(`Vertex AI request failed with status ${response.status}: ${bodyText}`);
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
      throw new Error('Vertex AI response did not include content text.');
    }

    try {
      return JSON.parse(contentText);
    } catch (error) {
      throw new Error(
        `Vertex AI response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    const googleAuth = this.buildGoogleAuth();
    const client = await googleAuth.getClient();
    const token = await client.getAccessToken();
    const tokenValue = typeof token === 'string' ? token : token?.token ?? null;

    if (!tokenValue) {
      throw new Error('Failed to acquire Vertex AI access token.');
    }

    return tokenValue;
  }

  private buildGoogleAuth(): GoogleAuth {
    const keyFilePath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    const inlineCredential = this.parseInlineCredential();

    if (inlineCredential) {
      return new GoogleAuth({
        credentials: inlineCredential,
        scopes: [this.scope],
      });
    }

    if (!keyFilePath) {
      this.logger.warn(
        'Vertex AI provider is selected but no credentials were provided. Set GOOGLE_APPLICATION_CREDENTIALS or VERTEX_SERVICE_ACCOUNT_JSON.',
      );
    }

    return new GoogleAuth({
      keyFilename: keyFilePath,
      scopes: [this.scope],
    });
  }

  private parseInlineCredential(): ServiceAccountCredential | null {
    const raw = this.configService.get<string>('VERTEX_SERVICE_ACCOUNT_JSON');
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as ServiceAccountCredential;
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (error) {
      throw new Error(
        `VERTEX_SERVICE_ACCOUNT_JSON is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private resolveProjectId(): string {
    const envProjectId = this.configService.get<string>('VERTEX_PROJECT_ID');
    if (envProjectId) {
      return envProjectId;
    }

    const inlineCredential = this.parseInlineCredential();
    if (inlineCredential?.project_id) {
      return inlineCredential.project_id;
    }

    throw new Error('VERTEX_PROJECT_ID is required when using the vertex provider.');
  }
}
