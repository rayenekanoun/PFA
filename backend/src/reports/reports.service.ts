import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import type { DiagnosticReportPayload } from '../ai/ai.schemas';
import { diagnosticReportSchema } from '../ai/ai.schemas';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { StructuredDiagnosticSummary } from '../diagnostics/types/structured-diagnostic-summary.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  public async createOrUpdateReport(
    diagnosticRequestId: string,
    diagnosticRunId: string,
    structuredSummary: StructuredDiagnosticSummary,
    reportJson: DiagnosticReportPayload,
  ) {
    const validatedReport = diagnosticReportSchema.parse(reportJson);
    const reportText = this.renderReportText(validatedReport);

    return this.prisma.diagnosticReport.upsert({
      where: { diagnosticRequestId },
      update: {
        diagnosticRunId,
        structuredSummaryJson: structuredSummary as unknown as Prisma.InputJsonValue,
        reportJson: validatedReport as Prisma.InputJsonValue,
        reportText,
      },
      create: {
        diagnosticRequestId,
        diagnosticRunId,
        structuredSummaryJson: structuredSummary as unknown as Prisma.InputJsonValue,
        reportJson: validatedReport as Prisma.InputJsonValue,
        reportText,
      },
    });
  }

  public async getReport(user: AuthenticatedUser, diagnosticRequestId: string) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();

    const report = await this.prisma.diagnosticReport.findFirst({
      where:
        user.role === UserRole.ADMIN || bypassOwnership
          ? { diagnosticRequestId }
          : {
              diagnosticRequestId,
              diagnosticRequest: {
                userId: user.sub,
              },
            },
      include: {
        diagnosticRequest: {
          include: {
            vehicle: true,
            classifiedProfile: true,
          },
        },
      },
    });

    if (!report) {
      if (user.role === UserRole.ADMIN || bypassOwnership) {
        throw new NotFoundException('Diagnostic report not found.');
      }
      throw new ForbiddenException('You do not have access to this diagnostic report.');
    }

    return {
      id: report.id,
      requestId: report.diagnosticRequestId,
      runId: report.diagnosticRunId,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      vehicle: {
        id: report.diagnosticRequest.vehicle.id,
        mqttCarId: report.diagnosticRequest.vehicle.mqttCarId,
        vin: report.diagnosticRequest.vehicle.vin,
      },
      profile: report.diagnosticRequest.classifiedProfile,
      structuredSummary: report.structuredSummaryJson,
      reportJson: report.reportJson,
      reportText: report.reportText,
    };
  }

  private shouldBypassOwnershipFilter() {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return false;
    }

    return this.configService.get<boolean>('DEV_DISABLE_OWNERSHIP_FILTER', false) === true;
  }

  public renderReportText(reportJson: DiagnosticReportPayload): string {
    const lines = [
      `Summary: ${reportJson.summary}`,
      '',
      'Possible Causes:',
      ...(reportJson.possibleCauses.length > 0
        ? reportJson.possibleCauses.map((cause) => `- ${cause}`)
        : ['- No specific causes were identified.']),
      '',
      'Next Steps:',
      ...(reportJson.nextSteps.length > 0
        ? reportJson.nextSteps.map((step) => `- ${step}`)
        : ['- No next steps were suggested.']),
      '',
      'Caveats:',
      ...(reportJson.caveats.length > 0
        ? reportJson.caveats.map((caveat) => `- ${caveat}`)
        : ['- No caveats were provided.']),
      '',
      `Confidence: ${Math.round(reportJson.confidence * 100)}%`,
    ];

    return lines.join('\n');
  }
}
