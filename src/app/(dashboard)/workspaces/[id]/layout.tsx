import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';

type WorkspaceLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const workspace = await prisma.workspace.findFirst({
    where: { id, members: { some: { userId: user.id } } },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  return (
    <div className="flex h-full overflow-hidden">
      <WorkspaceSidebar workspaceId={id} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <Breadcrumb
            items={[
              { label: 'Workspaces', href: '/workspaces' },
              { label: workspace.name, href: `/workspaces/${id}/overview` },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
      </div>
    </div>
  );
}
