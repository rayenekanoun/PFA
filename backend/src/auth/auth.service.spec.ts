import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    createUser: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const prismaMock = {
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const jwtServiceMock = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret-123456',
        JWT_REFRESH_SECRET: 'test-refresh-secret-123456',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '30d',
      };
      return map[key];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersServiceMock as unknown as UsersService,
      prismaMock as unknown as PrismaService,
      jwtServiceMock as unknown as JwtService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it('registers a user and issues token pair', async () => {
    const createdUser = {
      id: 'user-1',
      email: 'tester@example.com',
      passwordHash: 'hash',
      displayName: 'Tester',
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    usersServiceMock.createUser.mockResolvedValue(createdUser);
    jwtServiceMock.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
    jwtServiceMock.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
    prismaMock.refreshToken.create.mockResolvedValue({
      id: 'rt-1',
      userId: createdUser.id,
      tokenHash: 'hashed',
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      revokedAt: null,
    });

    const response = await service.register({
      email: 'tester@example.com',
      password: 'strong-password-1',
      displayName: 'Tester',
    });

    expect(usersServiceMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'tester@example.com',
        displayName: 'Tester',
      }),
    );
    expect(prismaMock.refreshToken.create).toHaveBeenCalled();
    expect(response.user.email).toBe('tester@example.com');
    expect(response.accessToken).toBe('access-token');
    expect(response.refreshToken).toBe('refresh-token');
  });

  it('rejects login when password is incorrect', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 10);
    usersServiceMock.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'tester@example.com',
      passwordHash,
      displayName: 'Tester',
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.login({
        email: 'tester@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refreshes token pair when refresh token is valid', async () => {
    usersServiceMock.findById.mockResolvedValue({
      id: 'user-1',
      email: 'tester@example.com',
      passwordHash: 'hash',
      displayName: 'Tester',
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jwtServiceMock.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'tester@example.com',
      role: UserRole.USER,
    });
    prismaMock.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: 'hashed',
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      revokedAt: null,
    });
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.refreshToken.create.mockResolvedValue({
      id: 'rt-2',
      userId: 'user-1',
      tokenHash: 'hashed-new',
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      revokedAt: null,
    });
    jwtServiceMock.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');
    jwtServiceMock.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

    const response = await service.refresh({ refreshToken: 'old-refresh-token' });

    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
    expect(prismaMock.refreshToken.create).toHaveBeenCalled();
    expect(response.accessToken).toBe('new-access');
    expect(response.refreshToken).toBe('new-refresh');
  });
});
