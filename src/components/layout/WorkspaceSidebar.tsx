'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitBranch,
  FileText,
  MessageCircle,
  Sparkles,
  PanelTop,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudioSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

const WORKSPACE_NAV = [
  { segment: 'overview', label: 'Overview', icon: LayoutDashboard },
  { segment: 'diagrams', label: 'Diagrams', icon: GitBranch },
  { segment: 'specs', label: 'Specs', icon: FileText },
  { segment: 'chat', label: 'Chat', icon: MessageCircle },
  { segment: 'canvas', label: 'Canvas', icon: PanelTop },
];

const MAX_VISIBLE_STUDIOS = 5;

type WorkspaceSidebarProps = {
  workspaceId: string;
};

export function WorkspaceSidebar({ workspaceId }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}`;

  const [studios, setStudios] = useState<StudioSummary[]>([]);
  const [isStudioExpanded, setIsStudioExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Fetch studios list
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/studios`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStudios(data.studios ?? []);
      } catch {
        // Silently ignore
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const studioHref = `${base}/studio`;
  const isStudioActive = pathname.startsWith(studioHref);
  const visibleStudios = showAll ? studios : studios.slice(0, MAX_VISIBLE_STUDIOS);

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

        {/* Studio section — expandable with sub-items */}
        <div>
          <button
            onClick={() => setIsStudioExpanded(!isStudioExpanded)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isStudioActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Studio</span>
            {isStudioExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
            )}
          </button>

          {isStudioExpanded && (
            <div className="ml-4 mt-1 space-y-0.5">
              {/* New studio link */}
              <Link
                href={studioHref}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  pathname === studioHref
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Plus className="h-3 w-3 shrink-0" />
                New Studio
              </Link>

              {/* Studio list */}
              {visibleStudios.map((studio) => {
                const href = `${studioHref}/${studio.id}`;
                const isActive = pathname === href;
                return (
                  <Link
                    key={studio.id}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                    title={studio.title}
                  >
                    {studio.status === 'completed' ? (
                      <Check className="h-3 w-3 shrink-0 text-green-500" />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                    )}
                    <span className="truncate">{studio.title}</span>
                  </Link>
                );
              })}

              {/* Show all / Show less toggle */}
              {studios.length > MAX_VISIBLE_STUDIOS && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="px-3 py-1 text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors"
                >
                  {showAll ? 'Show less' : `Show all (${studios.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
