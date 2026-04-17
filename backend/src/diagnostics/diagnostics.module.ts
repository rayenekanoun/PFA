import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { QueuesModule } from '../common/queues.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { PidCatalogModule } from '../pid-catalog/pid-catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ReportsModule } from '../reports/reports.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsProcessor } from './processors/diagnostics.processor';
import { DiagnosticsService } from './diagnostics.service';
import { DiagnosticNormalizerService } from './services/diagnostic-normalizer.service';
import { DiagnosticPlannerService } from './services/diagnostic-planner.service';
import { DiagnosticSummaryService } from './services/diagnostic-summary.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueuesModule,
    VehiclesModule,
    ProfilesModule,
    PidCatalogModule,
    MqttModule,
    AiModule,
    ReportsModule,
  ],
  controllers: [DiagnosticsController, ConversationsController],
  providers: [
    DiagnosticsService,
    ConversationsService,
    DiagnosticsProcessor,
    DiagnosticPlannerService,
    DiagnosticNormalizerService,
    DiagnosticSummaryService,
  ],
  exports: [DiagnosticsService, DiagnosticSummaryService, ConversationsService],
})
export class DiagnosticsModule {}
