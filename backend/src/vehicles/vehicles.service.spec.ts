import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus, Prisma, UserRole, VehicleStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { JOB_DISCOVER_VEHICLE_CAPABILITIES } from '../common/queue.constants';
import { PidCatalogService } from '../pid-catalog/pid-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  let service: VehiclesService;

  const prismaMock = {
    $transaction: jest.fn(),
    vehicle: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    device: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const pidCatalogServiceMock = {
    listSupportedForVehicle: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  const queueMock = {
    add: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VehiclesService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
      pidCatalogServiceMock as unknown as PidCatalogService,
      queueMock as unknown as Queue,
    );
  });

  it('creates vehicles linked to the authenticated user', async () => {
    prismaMock.vehicle.create.mockResolvedValue({
      id: 'veh-1',
      userId: 'user-1',
      mqttCarId: 'sim-demo',
      vin: null,
      make: null,
      model: null,
      year: null,
      status: VehicleStatus.ACTIVE,
      device: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createVehicle(
      { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
      { mqttCarId: 'sim-demo' },
    );

    expect(prismaMock.vehicle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          mqttCarId: 'sim-demo',
          status: VehicleStatus.ACTIVE,
        }),
      }),
    );
    expect(result.id).toBe('veh-1');
  });

  it('returns conflict when mqttCarId or vin already exists', async () => {
    prismaMock.vehicle.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['mqttCarId'] },
      }),
    );

    await expect(
      service.createVehicle(
        { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
        { mqttCarId: 'sim-demo' },
      ),
    ).rejects.toThrow('Vehicle with the same unique field already exists');
  });

  it('claims an existing inventory device and queues capability discovery', async () => {
    prismaMock.vehicle.findFirst.mockResolvedValue({
      id: 'veh-1',
      userId: 'user-1',
      mqttCarId: 'sim-demo',
      vin: null,
      make: null,
      model: null,
      year: null,
      status: VehicleStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      device: null,
    });
    prismaMock.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      deviceCode: 'OBD-QR-001',
      vehicleId: null,
      serialNumber: 'STM32-001',
      firmwareVersion: '1.0.0',
      status: DeviceStatus.AVAILABLE,
      lastSeenAt: null,
      capabilitiesDiscoveredAt: null,
      capabilitiesResponseJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock as typeof prismaMock),
    );
    prismaMock.device.update.mockResolvedValue({
      id: 'dev-1',
      deviceCode: 'OBD-QR-001',
      vehicleId: 'veh-1',
      serialNumber: 'STM32-001',
      firmwareVersion: '1.0.0',
      status: DeviceStatus.LINKED,
      lastSeenAt: null,
      capabilitiesDiscoveredAt: null,
      capabilitiesResponseJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    queueMock.add.mockResolvedValue({ id: 'job-1' });

    const result = await service.attachDevice(
      { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
      'veh-1',
      {
        deviceCode: 'OBD-QR-001',
        firmwareVersion: '1.0.0',
      },
    );

    expect(prismaMock.device.findUnique).toHaveBeenCalledWith({
      where: { deviceCode: 'OBD-QR-001' },
    });
    expect(prismaMock.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vehicleId: 'veh-1',
          status: DeviceStatus.LINKED,
        }),
      }),
    );
    expect(queueMock.add).toHaveBeenCalledWith(
      JOB_DISCOVER_VEHICLE_CAPABILITIES,
      expect.objectContaining({ vehicleId: 'veh-1' }),
      expect.objectContaining({
        jobId: expect.stringContaining('capability-veh-1-'),
      }),
    );
    expect(result.capabilityDiscoveryJobId).toBe('job-1');
  });

  it('rejects capability discovery when vehicle has no linked device', async () => {
    prismaMock.vehicle.findFirst.mockResolvedValue({
      id: 'veh-1',
      userId: 'user-1',
      mqttCarId: 'sim-demo',
      vin: null,
      make: null,
      model: null,
      year: null,
      status: VehicleStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      device: null,
    });

    await expect(
      service.discoverCapabilities(
        { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
        'veh-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects access when non-admin user does not own the vehicle', async () => {
    prismaMock.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.getVehicle({ sub: 'user-1', email: 'u@example.com', role: UserRole.USER }, 'veh-404'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
