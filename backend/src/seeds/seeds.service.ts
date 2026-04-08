import { ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DIAGNOSTIC_PROFILES_SEED } from './seed-data/diagnostic-profiles.seed';
import { OBD_PID_CATALOG_SEED } from './seed-data/obd-pid-catalog.seed';

@Injectable()
export class SeedsService implements OnModuleInit {
  private readonly logger = new Logger(SeedsService.name);

  public constructor(private readonly prisma: PrismaService) {}

  public async onModuleInit(): Promise<void> {
    await this.seedPidCatalog();
    await this.seedDiagnosticProfiles();
  }

  public async seedPidCatalog(): Promise<void> {
    for (const item of OBD_PID_CATALOG_SEED) {
      await this.prisma.obdPidCatalog.upsert({
        where: { key: item.key },
        update: {
          mode: item.mode,
          pidCode: item.pidCode,
          fullCode: item.fullCode,
          label: item.label,
          unit: item.unit,
          valueType: item.valueType,
          description: item.description,
          formula: item.formula,
          isMandatory: item.isMandatory,
        },
        create: item,
      });
    }

    this.logger.log(`Seeded ${OBD_PID_CATALOG_SEED.length} OBD PID catalog entries.`);
  }

  public async seedDiagnosticProfiles(): Promise<void> {
    for (const profile of DIAGNOSTIC_PROFILES_SEED) {
      const pidKeys = profile.defaultRequestedPidsJson.map((entry) => entry.key);
      const existingPids = await this.prisma.obdPidCatalog.findMany({
        where: { key: { in: pidKeys } },
        select: { key: true },
      });
      const existingKeys = new Set(existingPids.map((entry) => entry.key));
      const missingKeys = pidKeys.filter((key) => !existingKeys.has(key));
      if (missingKeys.length > 0) {
        throw new ConflictException(
          `Cannot seed profile '${profile.code}' because these PID keys are missing from obd_pid_catalog: ${missingKeys.join(', ')}.`,
        );
      }

      await this.prisma.diagnosticProfile.upsert({
        where: { code: profile.code },
        update: {
          name: profile.name,
          description: profile.description,
          defaultRequestedPidsJson:
            profile.defaultRequestedPidsJson as unknown as Prisma.InputJsonValue,
          includeDtcsByDefault: profile.includeDtcsByDefault,
        },
        create: {
          ...profile,
          defaultRequestedPidsJson:
            profile.defaultRequestedPidsJson as unknown as Prisma.InputJsonValue,
        },
      });
    }

    this.logger.log(`Seeded ${DIAGNOSTIC_PROFILES_SEED.length} diagnostic profiles.`);
  }
}
