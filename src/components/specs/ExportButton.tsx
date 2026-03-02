'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

type ExportScope = 'all' | 'prd' | 'stories' | 'edgecases';

const EXPORT_OPTIONS: { scope: ExportScope; label: string }[] = [
  { scope: 'all', label: 'Full Export' },
  { scope: 'prd', label: 'PRD Only' },
  { scope: 'stories', label: 'Stories Only' },
  { scope: 'edgecases', label: 'Edge Cases Only' },
];

type Props = {
  specId: string;
};

export function ExportButton({ specId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingScope, setLoadingScope] = useState<ExportScope | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleExport = async (scope: ExportScope) => {
    setIsOpen(false);
    setLoadingScope(scope);

    try {
      const res = await fetch(`/api/specs/${specId}/export?scope=${scope}`);

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `specs-${scope}-export.md`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success('Specs exported successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed. Please try again.';
      toast.error(message);
    } finally {
      setLoadingScope(null);
    }
  };

  const isLoading = loadingScope !== null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => !isLoading && setIsOpen((prev) => !prev)}
        disabled={isLoading}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Exporting…
          </>
        ) : (
          <>
            Export
            <svg
              className="h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-40 rounded border bg-popover shadow-md"
        >
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.scope}
              role="menuitem"
              onClick={() => handleExport(opt.scope)}
              className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-muted"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
