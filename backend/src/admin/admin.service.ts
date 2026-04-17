import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DeviceStatus, DiagnosticRequestStatus, Prisma, UserRole, VehicleStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCreateUserDto } from '../users/dto/admin-create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { CreateVehicleDto } from '../vehicles/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../vehicles/dto/update-vehicle.dto';
import { CreateSystemDeviceDto } from './dto/create-system-device.dto';
import { UpdateSystemDeviceDto } from './dto/update-system-device.dto';

@Injectable()
export class AdminService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getDashboardStats() {
    const [
      totalUsers,
      totalAdmins,
      totalVehicles,
      activeVehicles,
      totalDevices,
      totalConversations,
      totalMessages,
      totalRequests,
      totalReports,
      requestsByStatus,
      usersWithVehicles,
      devicesByStatus,
      linkedDevices,
      supportedPidVehicleGroups,
      profileUsage,
      confidenceAggregates,
      reportConfidenceRows,
      runRows,
      recentReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.vehicle.count(),
      this.prisma.vehicle.count({ where: { status: VehicleStatus.ACTIVE } }),
      this.prisma.device.count(),
      this.prisma.diagnosticConversation.count(),
      this.prisma.diagnosticConversationMessage.count(),
      this.prisma.diagnosticRequest.count(),
      this.prisma.diagnosticReport.count(),
      this.prisma.diagnosticRequest.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.user.count({
        where: {
          vehicles: {
            some: {},
          },
        },
      }),
      this.prisma.device.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.device.count({
        where: {
          vehicleId: {
            not: null,
          },
        },
      }),
      this.prisma.vehicleSupportedPid.groupBy({
        by: ['vehicleId'],
        where: { isSupported: true },
        _count: { _all: true },
      }),
      this.prisma.diagnosticRequest.groupBy({
        by: ['classifiedProfileId'],
        where: {
          classifiedProfileId: {
            not: null,
          },
        },
        _count: { _all: true },
        orderBy: {
          _count: {
            classifiedProfileId: 'desc',
          },
        },
        take: 5,
      }),
      this.prisma.diagnosticRequest.aggregate({
        _avg: {
          classificationConfidence: true,
        },
      }),
      this.prisma.diagnosticReport.findMany({
        select: {
          reportJson: true,
        },
      }),
      this.prisma.diagnosticRun.findMany({
        select: {
          status: true,
          createdAt: true,
          startedAt: true,
          respondedAt: true,
        },
      }),
      this.prisma.diagnosticReport.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          diagnosticRequestId: true,
          createdAt: true,
          reportJson: true,
          diagnosticRequest: {
            select: {
              complaintText: true,
              classificationConfidence: true,
              vehicle: {
                select: {
                  id: true,
                  mqttCarId: true,
                  make: true,
                  model: true,
                  year: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const profileIds = profileUsage
      .map((entry) => entry.classifiedProfileId)
      .filter((entry): entry is string => typeof entry === 'string');
    const profiles = profileIds.length
      ? await this.prisma.diagnosticProfile.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    const requestStatusCounts = requestsByStatus.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.status] = entry._count._all;
      return acc;
    }, {});
    const deviceStatusCounts = devicesByStatus.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.status] = entry._count._all;
      return acc;
    }, {});

    const reportConfidenceValues = reportConfidenceRows
      .map((row) => {
        const payload = row.reportJson as Record<string, unknown>;
        return typeof payload.confidence === 'number' ? payload.confidence : null;
      })
      .filter((value): value is number => value !== null);
    const avgReportConfidence =
      reportConfidenceValues.length > 0
        ? reportConfidenceValues.reduce((sum, value) => sum + value, 0) / reportConfidenceValues.length
        : null;

    const completedRunDurations = runRows
      .map((run) => {
        if (!run.startedAt || !run.respondedAt) {
          return null;
        }

        return run.respondedAt.getTime() - run.startedAt.getTime();
      })
      .filter((value): value is number => value !== null && value >= 0);
    const averageResponseTimeMs =
      completedRunDurations.length > 0
        ? completedRunDurations.reduce((sum, value) => sum + value, 0) / completedRunDurations.length
        : null;
    const respondedRuns = runRows.filter((run) =>
      ['RESPONDED', 'PARTIAL'].includes(run.status),
    ).length;
    const timeoutRuns = runRows.filter((run) => run.status === 'TIMEOUT').length;
    const failedRuns = runRows.filter((run) => run.status === 'FAILED').length;

    const recentUsers = await this.prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        users: totalUsers,
        admins: totalAdmins,
        clients: totalUsers - totalAdmins,
        vehicles: totalVehicles,
        activeVehicles,
        inactiveVehicles: totalVehicles - activeVehicles,
        devices: totalDevices,
        linkedDevices,
        unassignedDevices: totalDevices - linkedDevices,
        diagnosticRequests: totalRequests,
        reports: totalReports,
        conversations: totalConversations,
        conversationMessages: totalMessages,
      },
      rates: {
        averageClassificationConfidence: confidenceAggregates._avg.classificationConfidence ?? null,
        averageReportConfidence: avgReportConfidence,
        averageResponseTimeMs,
        averageSupportedPidCountPerVehicle:
          supportedPidVehicleGroups.length > 0
            ? supportedPidVehicleGroups.reduce((sum, entry) => sum + entry._count._all, 0) /
              supportedPidVehicleGroups.length
            : 0,
        deviceUtilizationRate: totalDevices > 0 ? linkedDevices / totalDevices : 0,
        usersWithVehiclesRate: totalUsers > 0 ? usersWithVehicles / totalUsers : 0,
        runResponseRate: runRows.length > 0 ? respondedRuns / runRows.length : 0,
      },
      runStats: {
        totalRuns: runRows.length,
        respondedRuns,
        timeoutRuns,
        failedRuns,
      },
      requestStatusCounts,
      deviceStatusCounts,
      topProfiles: profileUsage.map((entry) => ({
        profileId: entry.classifiedProfileId,
        code: entry.classifiedProfileId ? profileMap.get(entry.classifiedProfileId)?.code ?? null : null,
        name: entry.classifiedProfileId ? profileMap.get(entry.classifiedProfileId)?.name ?? null : null,
        requestCount: entry._count._all,
      })),
      recentUsers,
      recentReports: recentReports.map((report) => {
        const payload = report.reportJson as Record<string, unknown>;
        return {
          id: report.id,
          requestId: report.diagnosticRequestId,
          createdAt: report.createdAt,
          summary:
            typeof payload.summary === 'string' ? payload.summary : report.diagnosticRequest.complaintText,
          confidence:
            typeof payload.confidence === 'number' ? payload.confidence : report.diagnosticRequest.classificationConfidence,
          vehicle: report.diagnosticRequest.vehicle,
        };
      }),
    };
  }

  public async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            vehicles: true,
            requests: true,
            conversations: true,
          },
        },
        vehicles: {
          select: {
            id: true,
            mqttCarId: true,
            make: true,
            model: true,
            year: true,
            status: true,
            device: {
              select: {
                id: true,
                deviceCode: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return Promise.all(
      users.map(async (user) => {
        const confidence = await this.prisma.diagnosticRequest.aggregate({
          where: {
            userId: user.id,
            classificationConfidence: {
              not: null,
            },
          },
          _avg: {
            classificationConfidence: true,
          },
        });

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          stats: {
            vehicleCount: user._count.vehicles,
            diagnosticRequestCount: user._count.requests,
            conversationCount: user._count.conversations,
            averageClassificationConfidence: confidence._avg.classificationConfidence ?? null,
          },
          vehicles: user.vehicles,
        };
      }),
    );
  }

  public async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        vehicles: {
          include: {
            device: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  public async createUser(dto: AdminCreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.displayName,
        role: dto.role ?? UserRole.USER,
      },
    });
  }

  public async updateUser(userId: string, dto: UpdateUserDto) {
    await this.getUser(userId);

    const data: Prisma.UserUpdateInput = {
      email: dto.email?.toLowerCase(),
      displayName: dto.displayName,
      role: dto.role,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists.');
      }
      throw error;
    }
  }

  public async deleteUser(userId: string) {
    await this.getUser(userId);
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      deleted: true,
      userId,
    };
  }

  public async listVehicles() {
    return this.prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        device: true,
      },
    });
  }

  public async createVehicleForUser(userId: string, dto: CreateVehicleDto) {
    await this.getUser(userId);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.vehicle.create({
          data: {
            userId,
            mqttCarId: this.generateMqttCarId(dto),
            vin: dto.vin,
            make: dto.make,
            model: dto.model,
            year: dto.year,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
            device: true,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const targetFields = Array.isArray(error.meta?.target)
            ? (error.meta?.target as string[]).join(', ')
            : 'unknown';
          if (targetFields.includes('mqttCarId')) {
            continue;
          }
          throw new ConflictException('Vehicle conflicts with an existing unique field.');
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to allocate a unique MQTT vehicle identifier. Please retry.');
  }

  public async updateVehicle(vehicleId: string, dto: UpdateVehicleDto) {
    const existingVehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existingVehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

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
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
          device: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Vehicle conflicts with an existing unique field.');
      }
      throw error;
    }
  }

  public async deleteVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { device: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

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
        where: { id: vehicleId },
      });
    });

    return {
      deleted: true,
      vehicleId,
    };
  }

  public async listDevices() {
    return this.prisma.device.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        vehicle: {
          select: {
            id: true,
            mqttCarId: true,
            vin: true,
            make: true,
            model: true,
            year: true,
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
    });
  }

  public async createSystemDevice(dto: CreateSystemDeviceDto) {
    try {
      return await this.prisma.device.create({
        data: {
          deviceCode: dto.deviceCode,
          serialNumber: dto.serialNumber,
          firmwareVersion: dto.firmwareVersion,
          status: dto.status ?? DeviceStatus.AVAILABLE,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A device with the same code or serial number already exists.');
      }

      throw error;
    }
  }

  public async getDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        vehicle: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found.');
    }

    return device;
  }

  public async updateSystemDevice(deviceId: string, dto: UpdateSystemDeviceDto) {
    await this.getDevice(deviceId);

    try {
      return await this.prisma.device.update({
        where: { id: deviceId },
        data: {
          deviceCode: dto.deviceCode,
          serialNumber: dto.serialNumber,
          firmwareVersion: dto.firmwareVersion,
          status: dto.status,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A device with the same code or serial number already exists.');
      }
      throw error;
    }
  }

  public async deleteSystemDevice(deviceId: string) {
    await this.getDevice(deviceId);
    await this.prisma.device.delete({
      where: { id: deviceId },
    });

    return {
      deleted: true,
      deviceId,
    };
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

  public async seedMissingDeviceCodes() {
    const updated = await this.prisma.$executeRawUnsafe(`
      UPDATE "Device"
      SET "deviceCode" = COALESCE("deviceCode", "serialNumber", "id")
      WHERE "deviceCode" IS NULL
    `);

    return { updatedRows: Number(updated) };
  }
}
