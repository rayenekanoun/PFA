import 'dotenv/config';
import { PrismaClient, UserRole, type Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DIAGNOSTIC_PROFILES_SEED } from '../src/seeds/seed-data/diagnostic-profiles.seed';
import { OBD_PID_CATALOG_SEED } from '../src/seeds/seed-data/obd-pid-catalog.seed';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = process.env.DEV_ADMIN_EMAIL ?? 'admin@pfa.local';
const DEFAULT_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD ?? 'Admin12345!';
const DEFAULT_ADMIN_DISPLAY_NAME = process.env.DEV_ADMIN_DISPLAY_NAME ?? 'System Admin';

async function seedPidCatalog() {
  for (const item of OBD_PID_CATALOG_SEED) {
    await prisma.obdPidCatalog.upsert({
      where: { key: item.key },
      update: {
        mode: item.mode,
        pidCode: item.pidCode,
        fullCode: item.fullCode,
        label: item.label,
        unit: item.unit,
        valueType: item.valueType,
        description: item.description,
        formula: item.formula,
        isMandatory: item.isMandatory,
      },
      create: item,
    });
  }
}

async function seedDiagnosticProfiles() {
  const activeCodes = new Set(DIAGNOSTIC_PROFILES_SEED.map((profile) => profile.code));

  for (const profile of DIAGNOSTIC_PROFILES_SEED) {
    const pidKeys = profile.defaultRequestedPidsJson.map((entry) => entry.key);
    const existingPids = await prisma.obdPidCatalog.findMany({
      where: { key: { in: pidKeys } },
      select: { key: true },
    });
    const existingKeys = new Set(existingPids.map((entry) => entry.key));
    const missingKeys = pidKeys.filter((key) => !existingKeys.has(key));

    if (missingKeys.length > 0) {
      throw new Error(
        `Cannot seed profile '${profile.code}' because these PID keys are missing: ${missingKeys.join(', ')}.`,
      );
    }

    await prisma.diagnosticProfile.upsert({
      where: { code: profile.code },
      update: {
        name: profile.name,
        description: profile.description,
        defaultRequestedPidsJson: profile.defaultRequestedPidsJson as unknown as Prisma.InputJsonValue,
        includeDtcsByDefault: profile.includeDtcsByDefault,
      },
      create: {
        ...profile,
        defaultRequestedPidsJson: profile.defaultRequestedPidsJson as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.diagnosticProfile.deleteMany({
    where: {
      code: { notIn: [...activeCodes] },
      diagnosticRequests: { none: {} },
      diagnosticPlans: { none: {} },
    },
  });
}

async function upsertDevAdmin() {
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

  return prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL.toLowerCase() },
    update: {
      passwordHash,
      displayName: DEFAULT_ADMIN_DISPLAY_NAME,
      role: UserRole.ADMIN,
    },
    create: {
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      displayName: DEFAULT_ADMIN_DISPLAY_NAME,
      role: UserRole.ADMIN,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    },
  });
}

async function main() {
  await seedPidCatalog();
  await seedDiagnosticProfiles();
  const admin = await upsertDevAdmin();

  console.log('Reference data and development admin are ready.');
  console.log(`Email: ${admin.email}`);
  console.log(`Password: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log(`Display name: ${admin.displayName}`);
  console.log(`Role: ${admin.role}`);
}

void main()
  .catch((error: unknown) => {
    console.error('Failed to seed reference data and development admin.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
