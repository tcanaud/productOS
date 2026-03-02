/**
 * Test database lifecycle utilities.
 *
 * Uses a dedicated `productos_test` PostgreSQL database.
 * Requires .env.test with DATABASE_URL pointing to productos_test.
 *
 * Usage in test files:
 *   import { setupTestDB, teardownTestDB, seedTestDB } from '@/test/db';
 *
 *   beforeAll(async () => { await setupTestDB(); await seedTestDB(); });
 *   afterAll(async () => { await teardownTestDB(); });
 */
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
    });
  }
  return prisma;
}

/**
 * Run Prisma migrations against the test database.
 * Call once in beforeAll.
 */
export async function setupTestDB(): Promise<void> {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/productos_test?schema=public';
  execSync('npx prisma migrate deploy', {
    env: { ...process.env },
    stdio: 'pipe',
  });
}

/**
 * Clear all table data (truncate) after tests.
 * Call in afterAll.
 */
export async function teardownTestDB(): Promise<void> {
  const db = getTestPrisma();
  // Order matters: delete dependents before parents
  await db.workspaceMember.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();
  await db.$disconnect();
  prisma = null;
}

/**
 * Seed the test database with minimal data.
 * Override by calling createTest* factories directly in individual tests.
 */
export async function seedTestDB(): Promise<void> {
  const db = getTestPrisma();
  const user = await db.user.create({
    data: {
      email: 'seed@example.com',
      name: 'Seed User',
      password: '$2b$12$seedhashedpasswordfortest000000',
    },
  });
  await db.workspace.create({
    data: {
      name: 'Seed Workspace',
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: 'owner' },
      },
    },
  });
}

export { getTestPrisma };
