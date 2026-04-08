import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listProfiles() {
    return this.prisma.diagnosticProfile.findMany({
      orderBy: { code: 'asc' },
    });
  }

  public async findByCode(code: string) {
    return this.prisma.diagnosticProfile.findUnique({ where: { code } });
  }

  public async findById(id: string) {
    return this.prisma.diagnosticProfile.findUnique({ where: { id } });
  }
}
