import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';

type WorkspaceLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { id } = await params;

  return (
    <div className="flex h-full overflow-hidden">
      <WorkspaceSidebar workspaceId={id} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Workspace', href: `/workspaces/${id}` },
              { label: 'Overview' },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
      </div>
    </div>
  );
}
