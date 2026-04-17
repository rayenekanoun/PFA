import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConversationMessageKind,
  ConversationMessageRole,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AiService } from '../ai/ai.service';
import type { DiagnosticReportPayload } from '../ai/ai.schemas';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type { StructuredDiagnosticSummary } from './types/structured-diagnostic-summary.type';

@Injectable()
export class ConversationsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {}

  public async listConversations(user: AuthenticatedUser) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();
    const conversations = await this.prisma.diagnosticConversation.findMany({
      where: user.role === UserRole.ADMIN || bypassOwnership ? undefined : { userId: user.sub },
      include: {
        vehicle: {
          include: {
            device: true,
          },
        },
        diagnosticRequest: {
          include: {
            report: true,
            classifiedProfile: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      vehicle: {
        id: conversation.vehicle.id,
        mqttCarId: conversation.vehicle.mqttCarId,
        vin: conversation.vehicle.vin,
        make: conversation.vehicle.make,
        model: conversation.vehicle.model,
        year: conversation.vehicle.year,
        device: conversation.vehicle.device
          ? {
              id: conversation.vehicle.device.id,
              deviceCode: conversation.vehicle.device.deviceCode,
              status: conversation.vehicle.device.status,
            }
          : null,
      },
      request: {
        id: conversation.diagnosticRequest.id,
        status: conversation.diagnosticRequest.status,
        complaintText: conversation.diagnosticRequest.complaintText,
        createdAt: conversation.diagnosticRequest.createdAt,
        completedAt: conversation.diagnosticRequest.completedAt,
      },
      profile: conversation.diagnosticRequest.classifiedProfile,
      lastMessage: conversation.messages[0] ?? null,
      hasReport: Boolean(conversation.diagnosticRequest.report),
    }));
  }

  public async getConversation(user: AuthenticatedUser, conversationId: string) {
    const conversation = await this.getOwnedConversation(user, conversationId);
    return this.serializeConversation(conversation);
  }

  public async answerConversation(user: AuthenticatedUser, conversationId: string, question: string) {
    const conversation = await this.getOwnedConversation(user, conversationId);
    const report = conversation.diagnosticRequest.report;

    if (!report) {
      throw new BadRequestException('This conversation does not have a generated report yet.');
    }

    const summary = report.structuredSummaryJson as unknown as StructuredDiagnosticSummary;
    const reportJson = report.reportJson as unknown as DiagnosticReportPayload;

    const answerPayload = this.shouldForceUnknown(summary)
      ? {
          answer:
            'I do not know based on the current vehicle and device data. This profile did not produce supported measurements I can rely on for a grounded follow-up answer.',
          grounded: false,
          confidence: 0.12,
          usedSources: [] as string[],
        }
      : await this.aiService.answerFollowUp({
          question,
          summary,
          report: reportJson,
          previousMessages: conversation.messages.map((message) => ({
            role: message.role.toLowerCase() as 'user' | 'assistant' | 'system',
            content: message.content,
          })),
        });

    const normalizedAnswer =
      answerPayload.grounded && answerPayload.answer.trim().length > 0
        ? answerPayload.answer.trim()
        : 'I do not know based on the current vehicle and device data.';

    const [questionMessage, answerMessage] = await this.prisma.$transaction(async (tx) => {
      const createdQuestion = await tx.diagnosticConversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: ConversationMessageRole.USER,
          kind: ConversationMessageKind.FOLLOW_UP_QUESTION,
          content: question,
        },
      });

      const createdAnswer = await tx.diagnosticConversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: ConversationMessageRole.ASSISTANT,
          kind: ConversationMessageKind.FOLLOW_UP_ANSWER,
          content: normalizedAnswer,
          metadataJson: {
            grounded: answerPayload.grounded,
            confidence: answerPayload.confidence,
            usedSources: answerPayload.usedSources,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.diagnosticConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return [createdQuestion, createdAnswer];
    });

    return {
      conversationId: conversation.id,
      questionMessage,
      answerMessage,
    };
  }

  private async getOwnedConversation(user: AuthenticatedUser, conversationId: string) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();
    const canReadAll = user.role === UserRole.ADMIN || bypassOwnership;

    const conversation = await this.prisma.diagnosticConversation.findFirst({
      where: canReadAll ? { id: conversationId } : { id: conversationId, userId: user.sub },
      include: {
        vehicle: {
          include: {
            device: true,
          },
        },
        diagnosticRequest: {
          include: {
            classifiedProfile: true,
            report: true,
            plan: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      if (canReadAll) {
        throw new NotFoundException('Conversation not found.');
      }
      throw new ForbiddenException('You do not have access to this conversation.');
    }

    return conversation;
  }

  private shouldForceUnknown(summary: StructuredDiagnosticSummary) {
    const hasRequestedMeasurements = summary.requestedMeasurements.length > 0;
    const hasGroundedMeasurements = summary.measurements.some((measurement) => measurement.status === 'ok');
    const hasGroundedDtcs = summary.dtcs.length > 0;

    return !hasRequestedMeasurements || (!hasGroundedMeasurements && !hasGroundedDtcs);
  }

  private serializeConversation(
    conversation: Awaited<ReturnType<ConversationsService['getOwnedConversation']>>,
  ) {
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      vehicle: {
        id: conversation.vehicle.id,
        mqttCarId: conversation.vehicle.mqttCarId,
        vin: conversation.vehicle.vin,
        make: conversation.vehicle.make,
        model: conversation.vehicle.model,
        year: conversation.vehicle.year,
        device: conversation.vehicle.device
          ? {
              id: conversation.vehicle.device.id,
              deviceCode: conversation.vehicle.device.deviceCode,
              status: conversation.vehicle.device.status,
              lastSeenAt: conversation.vehicle.device.lastSeenAt,
            }
          : null,
      },
      request: {
        id: conversation.diagnosticRequest.id,
        status: conversation.diagnosticRequest.status,
        complaintText: conversation.diagnosticRequest.complaintText,
        createdAt: conversation.diagnosticRequest.createdAt,
        completedAt: conversation.diagnosticRequest.completedAt,
      },
      profile: conversation.diagnosticRequest.classifiedProfile
        ? {
            id: conversation.diagnosticRequest.classifiedProfile.id,
            code: conversation.diagnosticRequest.classifiedProfile.code,
            name: conversation.diagnosticRequest.classifiedProfile.name,
            description: conversation.diagnosticRequest.classifiedProfile.description,
            confidence: conversation.diagnosticRequest.classificationConfidence,
            rationale: conversation.diagnosticRequest.classificationRationale,
          }
        : null,
      plan: conversation.diagnosticRequest.plan
        ? {
            id: conversation.diagnosticRequest.plan.id,
            includeDtcs: conversation.diagnosticRequest.plan.includeDtcs,
            plannerNotes: conversation.diagnosticRequest.plan.plannerNotes,
            requestedMeasurements: conversation.diagnosticRequest.plan.requestedPidsJson,
          }
        : null,
      report: conversation.diagnosticRequest.report
        ? {
            id: conversation.diagnosticRequest.report.id,
            structuredSummary: conversation.diagnosticRequest.report.structuredSummaryJson,
            reportJson: conversation.diagnosticRequest.report.reportJson,
            reportText: conversation.diagnosticRequest.report.reportText,
            createdAt: conversation.diagnosticRequest.report.createdAt,
          }
        : null,
      messages: conversation.messages,
    };
  }

  private shouldBypassOwnershipFilter() {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return false;
    }

    return this.configService.get<boolean>('DEV_DISABLE_OWNERSHIP_FILTER', false) === true;
  }
}
