import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DeviceStatus, Prisma, UserRole, VehicleStatus } from '@prisma/client';
import { JOB_DISCOVER_VEHICLE_CAPABILITIES, DIAGNOSTICS_QUEUE } from '../common/queue.constants';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { PidCatalogService } from '../pid-catalog/pid-catalog.service';
import { AttachDeviceDto } from './dto/attach-device.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

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
    try {
      return await this.prisma.vehicle.create({
        data: {
          userId: user.sub,
          mqttCarId: dto.mqttCarId,
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
        throw new ConflictException(`Vehicle with the same unique field already exists (${targetFields}).`);
      }
      throw error;
    }
  }

  public async attachDevice(user: AuthenticatedUser, vehicleId: string, dto: AttachDeviceDto) {
    const vehicle = await this.getOwnedVehicleWithDevice(user, vehicleId);

    const device = vehicle.device
      ? await this.prisma.device.update({
          where: { vehicleId: vehicle.id },
          data: {
            serialNumber: dto.serialNumber,
            firmwareVersion: dto.firmwareVersion,
            status: DeviceStatus.LINKED,
          },
        })
      : await this.prisma.device.create({
          data: {
            vehicleId: vehicle.id,
            serialNumber: dto.serialNumber,
            firmwareVersion: dto.firmwareVersion,
            status: DeviceStatus.LINKED,
          },
        });

    const job = await this.enqueueCapabilityDiscovery(vehicle.id, device.id);

    return {
      device,
      capabilityDiscoveryJobId: job.id,
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
}
