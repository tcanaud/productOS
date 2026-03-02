import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const devUser = await prisma.user.upsert({
    where: { email: 'dev@productoOs.local' },
    update: {},
    create: {
      email: 'dev@productoOs.local',
      name: 'Dev User',
      password: 'devpassword', // In production, this should be hashed
    },
  });

  const devWorkspace = await prisma.workspace.upsert({
    where: { id: 'dev-workspace-seed-id' },
    update: {},
    create: {
      id: 'dev-workspace-seed-id',
      name: 'Dev Workspace',
      description: 'Default development workspace',
      ownerId: devUser.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: devWorkspace.id,
        userId: devUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: devWorkspace.id,
      userId: devUser.id,
      role: 'owner',
    },
  });

  console.log('Seed complete:', { devUser: devUser.email, devWorkspace: devWorkspace.name });
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
