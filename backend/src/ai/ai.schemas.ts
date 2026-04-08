import { z } from 'zod';
import type { StructuredDiagnosticSummary } from '../diagnostics/types/structured-diagnostic-summary.type';

const textualObjectKeys = ['text', 'message', 'title', 'summary', 'cause', 'reason', 'step', 'item'];

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of textualObjectKeys) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toText(entry))
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|;/g)
      .map((entry) => entry.replace(/^[-*]\s*/, '').trim())
      .filter((entry) => entry.length > 0);
  }

  const single = toText(value);
  return single ? [single] : [];
}

const confidenceSchema = z.preprocess((value) => {
  if (typeof value === 'number') {
    if (value > 1 && value <= 100) {
      return value / 100;
    }
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'high' || normalized === 'strong') {
      return 0.85;
    }
    if (normalized === 'medium' || normalized === 'moderate') {
      return 0.6;
    }
    if (normalized === 'low' || normalized === 'weak') {
      return 0.35;
    }

    const numericMatch = normalized.match(/-?\d+(\.\d+)?/);
    if (numericMatch) {
      const parsed = Number(numericMatch[0]);
      if (!Number.isNaN(parsed)) {
        if (parsed > 1 && parsed <= 100) {
          return parsed / 100;
        }
        return parsed;
      }
    }
  }

  return value;
}, z.number().min(0).max(1));

const nonEmptyStringSchema = z.preprocess((value) => toText(value), z.string().min(1));

const stringListSchema = z.preprocess(
  (value) => normalizeStringList(value),
  z.array(z.string().min(1)),
);

export const complaintClassificationSchema = z.object({
  profileCode: z.string().min(1),
  confidence: confidenceSchema,
  rationale: nonEmptyStringSchema,
});

export const diagnosticReportSchema = z.object({
  summary: nonEmptyStringSchema,
  possibleCauses: stringListSchema.default([]),
  nextSteps: stringListSchema.default([]),
  caveats: stringListSchema.default([]),
  confidence: confidenceSchema,
});

export type ComplaintClassification = z.infer<typeof complaintClassificationSchema>;
export type DiagnosticReportPayload = z.infer<typeof diagnosticReportSchema>;

export interface ClassificationInput {
  complaintText: string;
  availableProfiles: Array<{ code: string; name: string; description: string | null }>;
}

export interface ReportGenerationInput {
  summary: StructuredDiagnosticSummary;
}
