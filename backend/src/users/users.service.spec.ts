import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prismaMock as unknown as PrismaService);
  });

  it('creates first user as admin role', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      passwordHash: 'hash',
      displayName: 'Admin',
      role: UserRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createUser({
      email: 'Admin@Example.com',
      passwordHash: 'hash',
      displayName: 'Admin',
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@example.com',
          role: UserRole.ADMIN,
        }),
      }),
    );
    expect(result.role).toBe(UserRole.ADMIN);
  });

  it('throws conflict when email already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'existing@example.com',
    });

    await expect(
      service.createUser({
        email: 'existing@example.com',
        passwordHash: 'hash',
        displayName: 'Existing',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws not found when user id does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
