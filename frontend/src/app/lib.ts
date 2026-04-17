import { jsPDF } from "jspdf";
import type {
  AuthSession,
  DiagnosticRequestSummary,
  ReportResponse,
} from "./types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";
export const AUTH_STORAGE_KEY = "pfa-diagnostics-auth";
export const SIDEBAR_STORAGE_KEY = "pfa-diagnostics-sidebar-collapsed";
export const VEHICLE_SELECTION_STORAGE_KEY = "pfa-diagnostics-selected-vehicle";
export const REQUEST_SELECTION_STORAGE_KEY = "pfa-diagnostics-selected-request";

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  public constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  const typed = payload as {
    message?: string | string[];
    error?: string;
  } | null;
  const value =
    typed?.message ?? typed?.error ?? `Request failed with status ${status}`;
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, ...requestInit } = options;
  const headers = new Headers(requestInit.headers ?? {});
  if (requestInit.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers,
  });

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      parsed,
      extractErrorMessage(parsed, response.status),
    );
  }

  return parsed as T;
}

export function readStoredAuth(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return "just now";
  const diffMinutes = Math.round(
    (new Date(value).getTime() - Date.now()) / 60000,
  );
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return rtf.format(Math.round(diffHours / 24), "day");
}

export function compactText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trimEnd()}...`;
}

export function vehicleDisplayName(vehicle: {
  make: string | null;
  model: string | null;
  year: number | null;
  mqttCarId: string;
}): string {
  const label = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");
  return label || vehicle.mqttCarId;
}

export function statusTone(
  status: string,
): "neutral" | "info" | "warning" | "success" | "danger" {
  const normalized = status.toUpperCase();
  if (normalized.includes("COMPLETED")) return "success";
  if (normalized.includes("FAILED") || normalized.includes("ERROR"))
    return "danger";
  if (normalized.includes("RUNNING") || normalized.includes("DISCOVER"))
    return "info";
  if (normalized.includes("PENDING") || normalized.includes("CREATED"))
    return "warning";
  return "neutral";
}

function splitParagraphs(text: string, width: number, pdf: jsPDF): string[] {
  const parts = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  return parts.flatMap((line) => pdf.splitTextToSize(line, width));
}

export function downloadReportPdf(
  report: ReportResponse,
  request: DiagnosticRequestSummary | null,
): void {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const margin = 56;
  const contentWidth = width - margin * 2;
  let y = 86;

  pdf.setFillColor(242, 236, 229);
  pdf.rect(0, 0, width, 128, "F");

  pdf.setTextColor(33, 32, 31);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Connected Vehicle Diagnostic Report", margin, 58);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const vehicleName = vehicleDisplayName({
    mqttCarId: report.vehicle.mqttCarId,
    make: request?.vehicle.make ?? null,
    model: request?.vehicle.model ?? null,
    year: request?.vehicle.year ?? null,
  });
  pdf.text(`Vehicle: ${vehicleName}`, margin, 82);
  pdf.text(`Generated: ${formatDateTime(report.updatedAt)}`, margin, 100);

  y = 160;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Summary", margin, y);

  y += 20;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const summaryLines = pdf.splitTextToSize(
    report.reportJson.summary,
    contentWidth,
  );
  pdf.text(summaryLines, margin, y);
  y += summaryLines.length * 14 + 18;

  const sections: Array<{ title: string; values: string[] }> = [
    { title: "Possible Causes", values: report.reportJson.possibleCauses },
    { title: "Recommended Next Steps", values: report.reportJson.nextSteps },
    { title: "Caveats", values: report.reportJson.caveats },
  ];

  for (const section of sections) {
    if (y > 720) {
      pdf.addPage();
      y = 72;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(section.title, margin, y);
    y += 18;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    for (const item of section.values) {
      const lines = splitParagraphs(item, contentWidth - 16, pdf);
      if (y > 740) {
        pdf.addPage();
        y = 72;
      }
      pdf.text("-", margin, y);
      pdf.text(lines.length ? lines : ["n/a"], margin + 12, y);
      y += Math.max(1, lines.length) * 14 + 6;
    }
    y += 10;
  }

  pdf.setFont("helvetica", "bold");
  pdf.text(
    `Confidence: ${Math.round(report.reportJson.confidence * 100)}%`,
    margin,
    Math.min(y + 12, 800),
  );
  pdf.save(`diagnostic-report-${report.requestId}.pdf`);
}
