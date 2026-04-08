import type {
  ClassificationInput,
  ComplaintClassification,
  DiagnosticReportPayload,
  ReportGenerationInput,
} from '../ai.schemas';

export interface AiProvider {
  classifyComplaint(input: ClassificationInput): Promise<ComplaintClassification>;
  generateReport(input: ReportGenerationInput): Promise<DiagnosticReportPayload>;
}
