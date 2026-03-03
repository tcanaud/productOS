'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, GitBranch, FileText, MessageCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const WORKSPACE_NAV = [
  { segment: 'overview', label: 'Overview', icon: LayoutDashboard },
  { segment: 'studio', label: 'Studio', icon: Sparkles },
  { segment: 'diagrams', label: 'Diagrams', icon: GitBranch },
  { segment: 'specs', label: 'Specs', icon: FileText },
  { segment: 'chat', label: 'Chat', icon: MessageCircle },
];

type WorkspaceSidebarProps = {
  workspaceId: string;
};

export function WorkspaceSidebar({ workspaceId }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}`;

  return (
    <aside
      className="hidden w-56 shrink-0 border-r border-border bg-sidebar lg:flex lg:flex-col"
      aria-label="Workspace navigation"
    >
      <nav className="flex-1 space-y-1 p-3" role="navigation">
        {WORKSPACE_NAV.map(({ segment, label, icon: Icon }) => {
          const href = `${base}/${segment}`;
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={segment}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
