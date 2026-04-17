import type {
  ClassificationInput,
  ComplaintClassification,
  DiagnosticReportPayload,
  FollowUpAnswerInput,
  FollowUpAnswerPayload,
  ReportGenerationInput,
} from '../ai.schemas';

export interface AiProvider {
  classifyComplaint(input: ClassificationInput): Promise<ComplaintClassification>;
  generateReport(input: ReportGenerationInput): Promise<DiagnosticReportPayload>;
  answerFollowUp(input: FollowUpAnswerInput): Promise<FollowUpAnswerPayload>;
}
