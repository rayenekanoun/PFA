import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.schema';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { MqttModule } from './mqtt/mqtt.module';
import { PidCatalogModule } from './pid-catalog/pid-catalog.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ReportsModule } from './reports/reports.module';
import { SeedsModule } from './seeds/seeds.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      expandVariables: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');
        const parsed = new URL(redisUrl);

        return {
          connection: {
            host: parsed.hostname,
            port: Number(parsed.port || 6379),
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            db: parsed.pathname ? Number(parsed.pathname.slice(1) || 0) : 0,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    PrismaModule,
    AdminModule,
    UsersModule,
    AuthModule,
    PidCatalogModule,
    ProfilesModule,
    AiModule,
    MqttModule,
    VehiclesModule,
    DiagnosticsModule,
    ReportsModule,
    SeedsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
