import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PidCatalogService } from './pid-catalog.service';

describe('PidCatalogService', () => {
  let service: PidCatalogService;

  const prismaMock = {
    vehicle: {
      findFirst: jest.fn(),
    },
    vehicleSupportedPid: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PidCatalogService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it('returns supported pids with last discovery timestamp', async () => {
    const checkedAtOlder = new Date('2026-04-07T10:00:00.000Z');
    const checkedAtLatest = new Date('2026-04-08T10:00:00.000Z');
    prismaMock.vehicle.findFirst.mockResolvedValue({
      id: 'veh-1',
      userId: 'user-1',
    });
    prismaMock.vehicleSupportedPid.findMany.mockResolvedValue([
      {
        id: 'vsp-1',
        vehicleId: 'veh-1',
        pidCatalogId: 'pid-1',
        isSupported: true,
        checkedAt: checkedAtOlder,
        pidCatalog: {
          id: 'pid-1',
          mode: '01',
          pidCode: '0C',
          fullCode: '010C',
          key: 'engine_rpm',
          label: 'Engine RPM',
          unit: 'rpm',
        },
      },
      {
        id: 'vsp-2',
        vehicleId: 'veh-1',
        pidCatalogId: 'pid-2',
        isSupported: false,
        checkedAt: checkedAtLatest,
        pidCatalog: {
          id: 'pid-2',
          mode: '01',
          pidCode: '10',
          fullCode: '0110',
          key: 'maf',
          label: 'Mass Air Flow',
          unit: 'g/s',
        },
      },
    ]);

    const result = await service.listSupportedForVehicle(
      { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
      'veh-1',
    );

    expect(result.vehicleId).toBe('veh-1');
    expect(result.supportedPids).toHaveLength(2);
    expect(result.lastDiscoveryAt).toBe(checkedAtLatest.toISOString());
  });

  it('denies access to non-owned vehicle for normal users', async () => {
    prismaMock.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.listSupportedForVehicle(
        { sub: 'user-1', email: 'u@example.com', role: UserRole.USER },
        'veh-404',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('detects stale supported pid matrix correctly', async () => {
    prismaMock.vehicleSupportedPid.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        checkedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      })
      .mockResolvedValueOnce({
        checkedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      });

    const noRecords = await service.hasFreshSupportedPids('veh-1', 24);
    const fresh = await service.hasFreshSupportedPids('veh-1', 24);
    const stale = await service.hasFreshSupportedPids('veh-1', 24);

    expect(noRecords).toBe(false);
    expect(fresh).toBe(true);
    expect(stale).toBe(false);
  });
});
