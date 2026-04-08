import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class PidCatalogService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  public async listCatalog() {
    return this.prisma.obdPidCatalog.findMany({
      orderBy: [{ mode: 'asc' }, { pidCode: 'asc' }],
    });
  }

  public async listCatalogByKeys(keys: string[]) {
    return this.prisma.obdPidCatalog.findMany({
      where: { key: { in: keys } },
      orderBy: [{ mode: 'asc' }, { pidCode: 'asc' }],
    });
  }

  public async findByKey(key: string) {
    return this.prisma.obdPidCatalog.findUnique({ where: { key } });
  }

  public async findByFullCode(fullCode: string) {
    return this.prisma.obdPidCatalog.findUnique({ where: { fullCode } });
  }

  public async listSupportedForVehicle(
    user: AuthenticatedUser,
    vehicleId: string,
  ) {
    await this.ensureVehicleAccess(user, vehicleId);

    const records = await this.prisma.vehicleSupportedPid.findMany({
      where: { vehicleId },
      include: { pidCatalog: true },
      orderBy: [{ isSupported: 'desc' }, { pidCatalog: { mode: 'asc' } }, { pidCatalog: { pidCode: 'asc' } }],
    });

    return {
      vehicleId,
      lastDiscoveryAt:
        records.reduce<Date | null>((latest, record) => {
          if (!latest || record.checkedAt > latest) {
            return record.checkedAt;
          }
          return latest;
        }, null)?.toISOString() ?? null,
      supportedPids: records.map((record) => ({
        id: record.id,
        isSupported: record.isSupported,
        checkedAt: record.checkedAt,
        pid: record.pidCatalog,
      })),
    };
  }

  public async upsertVehicleSupportMatrix(vehicleId: string, supportedFullCodes: string[]) {
    const catalogEntries = await this.prisma.obdPidCatalog.findMany();
    const supported = new Set(supportedFullCodes);
    const now = new Date();

    await this.prisma.$transaction(
      catalogEntries.map((entry) =>
        this.prisma.vehicleSupportedPid.upsert({
          where: {
            vehicleId_pidCatalogId: {
              vehicleId,
              pidCatalogId: entry.id,
            },
          },
          update: {
            isSupported: supported.has(entry.fullCode),
            checkedAt: now,
          },
          create: {
            vehicleId,
            pidCatalogId: entry.id,
            isSupported: supported.has(entry.fullCode),
            checkedAt: now,
          },
        }),
      ),
    );
  }

  public async getSupportedCodesForVehicle(vehicleId: string): Promise<Set<string>> {
    const records = await this.prisma.vehicleSupportedPid.findMany({
      where: { vehicleId, isSupported: true },
      include: { pidCatalog: true },
    });

    return new Set(records.map((record) => record.pidCatalog.fullCode));
  }

  public async hasFreshSupportedPids(vehicleId: string, staleHours: number): Promise<boolean> {
    const latest = await this.prisma.vehicleSupportedPid.findFirst({
      where: { vehicleId },
      orderBy: { checkedAt: 'desc' },
      select: { checkedAt: true },
    });

    if (!latest) {
      return false;
    }

    const ageMs = Date.now() - latest.checkedAt.getTime();
    return ageMs <= staleHours * 60 * 60 * 1000;
  }

  private async ensureVehicleAccess(user: AuthenticatedUser, vehicleId: string) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();
    const canReadAll = user.role === UserRole.ADMIN || bypassOwnership;

    const where: Prisma.VehicleWhereInput =
      canReadAll
        ? { id: vehicleId }
        : { id: vehicleId, userId: user.sub };

    const vehicle = await this.prisma.vehicle.findFirst({ where });
    if (!vehicle) {
      if (canReadAll) {
        throw new NotFoundException('Vehicle not found.');
      }
      throw new ForbiddenException('You do not have access to this vehicle.');
    }

    return vehicle;
  }

  private shouldBypassOwnershipFilter() {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return false;
    }

    return this.configService.get<boolean>('DEV_DISABLE_OWNERSHIP_FILTER', false) === true;
  }
}
