import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { selectProfilesForComplaint } from './profile-matching.util';

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

  public async listCandidateProfilesForComplaint(complaintText: string, limit = 48) {
    const profiles = await this.prisma.diagnosticProfile.findMany({
      orderBy: { code: 'asc' },
    });

    return selectProfilesForComplaint(profiles, complaintText, { limit, maxPerFamily: 4 });
  }
}
