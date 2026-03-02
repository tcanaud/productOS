'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Briefcase, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/hooks/use-sidebar';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workspaces', label: 'Workspaces', icon: Briefcase },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={toggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0',
          collapsed ? '-translate-x-full' : 'translate-x-0'
        )}
        aria-label="Main navigation"
      >
        {/* Mobile close button */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4 lg:hidden">
          <span className="font-semibold">Menu</span>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 p-3" role="navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  // Close mobile sidebar on navigation
                  if (window.innerWidth < 1024) toggle();
                }}
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
    </>
  );
}
