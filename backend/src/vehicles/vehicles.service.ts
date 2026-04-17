import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DeviceStatus, Prisma, UserRole, VehicleStatus } from '@prisma/client';
import { JOB_DISCOVER_VEHICLE_CAPABILITIES, DIAGNOSTICS_QUEUE } from '../common/queue.constants';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { PidCatalogService } from '../pid-catalog/pid-catalog.service';
import { AttachDeviceDto } from './dto/attach-device.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pidCatalogService: PidCatalogService,
    @InjectQueue(DIAGNOSTICS_QUEUE) private readonly diagnosticsQueue: Queue,
  ) {}

  public async listVehicles(user: AuthenticatedUser) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();

    return this.prisma.vehicle.findMany({
      where: user.role === UserRole.ADMIN || bypassOwnership ? undefined : { userId: user.sub },
      include: {
        device: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async getVehicle(user: AuthenticatedUser, vehicleId: string) {
    return this.getOwnedVehicleWithDevice(user, vehicleId);
  }

  public async createVehicle(user: AuthenticatedUser, dto: CreateVehicleDto) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.vehicle.create({
          data: {
            userId: user.sub,
            mqttCarId: this.generateMqttCarId(dto),
            vin: dto.vin,
            make: dto.make,
            model: dto.model,
            year: dto.year,
            status: VehicleStatus.ACTIVE,
          },
          include: {
            device: true,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const targetFields = Array.isArray(error.meta?.target)
            ? (error.meta?.target as string[]).join(', ')
            : 'mqttCarId or vin';
          if (targetFields.includes('mqttCarId')) {
            continue;
          }
          throw new ConflictException(`Vehicle with the same unique field already exists (${targetFields}).`);
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to allocate a unique MQTT vehicle identifier. Please retry.');
  }

  public async updateVehicle(user: AuthenticatedUser, vehicleId: string, dto: UpdateVehicleDto) {
    await this.getOwnedVehicleWithDevice(user, vehicleId);

    try {
      return await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          mqttCarId: dto.mqttCarId,
          vin: dto.vin,
          make: dto.make,
          model: dto.model,
          year: dto.year,
        },
        include: {
          device: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Vehicle update conflicts with an existing unique field.');
      }
      throw error;
    }
  }

  public async deleteVehicle(user: AuthenticatedUser, vehicleId: string) {
    const vehicle = await this.getOwnedVehicleWithDevice(user, vehicleId);

    await this.prisma.$transaction(async (tx) => {
      if (vehicle.device) {
        await tx.device.update({
          where: { id: vehicle.device.id },
          data: {
            vehicleId: null,
            status: DeviceStatus.AVAILABLE,
          },
        });
      }

      await tx.vehicle.delete({
        where: { id: vehicle.id },
      });
    });

    return {
      deleted: true,
      vehicleId: vehicle.id,
    };
  }

  public async attachDevice(user: AuthenticatedUser, vehicleId: string, dto: AttachDeviceDto) {
    const vehicle = await this.getOwnedVehicleWithDevice(user, vehicleId);
    const device = await this.prisma.device.findUnique({
      where: { deviceCode: dto.deviceCode },
    });

    if (!device) {
      throw new NotFoundException('Device not found in the system inventory.');
    }

    if (device.status === DeviceStatus.DISABLED) {
      throw new ConflictException('This device is disabled and cannot be claimed.');
    }

    if (device.vehicleId && device.vehicleId !== vehicle.id) {
      throw new ConflictException('This device is already linked to another vehicle.');
    }

    const linkedDevice = await this.prisma.$transaction(async (tx) => {
      if (vehicle.device && vehicle.device.id !== device.id) {
        await tx.device.update({
          where: { id: vehicle.device.id },
          data: {
            vehicleId: null,
            status: DeviceStatus.AVAILABLE,
          },
        });
      }

      return tx.device.update({
        where: { id: device.id },
        data: {
          vehicleId: vehicle.id,
          firmwareVersion: dto.firmwareVersion ?? device.firmwareVersion,
          status: DeviceStatus.LINKED,
        },
      });
    });

    const job = await this.enqueueCapabilityDiscovery(vehicle.id, linkedDevice.id);

    return {
      device: linkedDevice,
      capabilityDiscoveryJobId: job.id,
    };
  }

  public async detachDevice(user: AuthenticatedUser, vehicleId: string) {
    const vehicle = await this.getOwnedVehicleWithDevice(user, vehicleId);

    if (!vehicle.device) {
      throw new BadRequestException('Vehicle does not have a linked device.');
    }

    const device = await this.prisma.device.update({
      where: { id: vehicle.device.id },
      data: {
        vehicleId: null,
        status: DeviceStatus.AVAILABLE,
      },
    });

    return {
      detached: true,
      vehicleId: vehicle.id,
      deviceId: device.id,
    };
  }

  public async discoverCapabilities(user: AuthenticatedUser, vehicleId: string) {
    const vehicle = await this.getOwnedVehicleWithDevice(user, vehicleId);

    if (!vehicle.device) {
      throw new BadRequestException('Vehicle does not have a linked device yet.');
    }

    const job = await this.enqueueCapabilityDiscovery(vehicle.id, vehicle.device.id);
    return {
      vehicleId: vehicle.id,
      deviceId: vehicle.device.id,
      status: 'queued',
      jobId: job.id,
    };
  }

  public async getSupportedPids(user: AuthenticatedUser, vehicleId: string) {
    return this.pidCatalogService.listSupportedForVehicle(user, vehicleId);
  }

  public async getVehicleForExecution(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { device: true, user: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    if (!vehicle.device) {
      throw new ConflictException('Vehicle does not have a linked device.');
    }

    return vehicle;
  }

  private async enqueueCapabilityDiscovery(vehicleId: string, deviceId: string) {
    return this.diagnosticsQueue.add(
      JOB_DISCOVER_VEHICLE_CAPABILITIES,
      {
        vehicleId,
        deviceId,
      },
      {
        jobId: `capability-${vehicleId}-${Date.now()}`,
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
  }

  private async getOwnedVehicleWithDevice(user: AuthenticatedUser, vehicleId: string) {
    const bypassOwnership = this.shouldBypassOwnershipFilter();
    const canReadAll = user.role === UserRole.ADMIN || bypassOwnership;

    const vehicle = await this.prisma.vehicle.findFirst({
      where: canReadAll ? { id: vehicleId } : { id: vehicleId, userId: user.sub },
      include: { device: true },
    });

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

  private generateMqttCarId(dto: CreateVehicleDto): string {
    const baseParts = [
      dto.year?.toString() ?? '',
      dto.make ?? '',
      dto.model ?? '',
      dto.vin ? dto.vin.slice(-6) : '',
    ]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((value) => value.replace(/[^a-z0-9]+/g, '-'))
      .filter(Boolean);

    const base = baseParts.join('-') || 'vehicle';
    return `car-${base}-${randomUUID().slice(0, 8)}`.slice(0, 128);
  }
}
