'use client';

import { useState } from 'react';
import { History, RotateCcw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type DiagramVersion = {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
};

type Props = {
  versions: DiagramVersion[];
  onRestore: (version: DiagramVersion) => Promise<void>;
};

export function VersionHistory({ versions, onRestore }: Props) {
  const [open, setOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleRestore = async (version: DiagramVersion) => {
    if (confirmId !== version.id) {
      setConfirmId(version.id);
      return;
    }
    setRestoringId(version.id);
    setConfirmId(null);
    try {
      await onRestore(version);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="flex h-full flex-col border-l bg-background">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Version History
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{versions.length}</span>
        </span>
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto">
          {versions.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No versions yet</p>
          )}
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between border-b px-3 py-2 text-xs last:border-b-0"
            >
              <div className="min-w-0 flex-1 truncate text-muted-foreground">
                {new Date(v.createdAt).toLocaleString()}
              </div>
              {confirmId === v.id ? (
                <div className="flex items-center gap-1">
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => void handleRestore(v)}
                  >
                    Confirm
                  </button>
                  <button
                    className="text-muted-foreground hover:underline"
                    onClick={() => setConfirmId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={restoringId === v.id}
                  onClick={() => void handleRestore(v)}
                  title="Restore this version"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
