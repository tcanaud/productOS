import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { WorkspaceList } from '@/components/workspace/WorkspaceList';

export const metadata = { title: 'Workspaces' };

export default async function WorkspacesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const workspaces = await prisma.workspace.findMany({
    where: {
      members: { some: { userId: user.id } },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
    },
  });

  // Serialize dates for client component
  const serialized = workspaces.map((ws) => ({
    ...ws,
    updatedAt: ws.updatedAt.toISOString(),
  }));

  return <WorkspaceList initialWorkspaces={serialized} />;
}
