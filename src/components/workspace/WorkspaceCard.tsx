'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Briefcase, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type WorkspaceCardData = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string | Date;
};

type WorkspaceCardProps = {
  workspace: WorkspaceCardData;
  onEdit: (workspace: WorkspaceCardData) => void;
  onDelete: (id: string) => void;
};

export function WorkspaceCard({ workspace, onEdit, onDelete }: WorkspaceCardProps) {
  const updatedAt =
    typeof workspace.updatedAt === 'string' ? new Date(workspace.updatedAt) : workspace.updatedAt;

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/workspaces/${workspace.id}/overview`}
            className="flex items-center gap-2 hover:underline"
          >
            <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CardTitle className="text-base">{workspace.name}</CardTitle>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                aria-label="Workspace options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(workspace)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(workspace.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {workspace.description && (
          <CardDescription className="line-clamp-2 mt-1">{workspace.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Modified {formatDistanceToNow(updatedAt, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
