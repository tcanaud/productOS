'use client';

/**
 * PortInferencePreview — Story 10.2
 *
 * Non-destructive modal presenting AI-inferred port suggestions.
 * The user can Accept All (saves via PATCH), Edit Before Saving
 * (opens PortEditor pre-populated), or Dismiss.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InferredPort, PortInferenceResult } from '@/lib/layer/port-inference';

interface PortInferencePreviewProps {
  layerId: string;
  workspaceId: string;
  inferenceResult: PortInferenceResult;
  onAccept: (ports: InferredPort[]) => void;
  /** Called when user chooses "Edit Before Saving" — parent opens PortEditor pre-populated. */
  onModify: (ports: InferredPort[]) => void;
  onReject: () => void;
}

const CONFIDENCE_STYLES: Record<InferredPort['confidence'], string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function PortInferencePreview({
  layerId,
  workspaceId,
  inferenceResult,
  onAccept,
  onModify,
  onReject,
}: PortInferencePreviewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { ports, consolidationWarning, consolidatedFrom } = inferenceResult;

  async function handleAcceptAll() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ports }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      toast.success('Ports saved successfully');
      onAccept(ports);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save ports';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditBeforeSaving() {
    onModify(ports);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={onReject}
        data-testid="port-inference-backdrop"
      />

      {/* Modal panel */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background shadow-xl"
        role="dialog"
        aria-label="AI Suggested Ports"
        aria-modal="true"
        data-testid="port-inference-preview"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">AI Suggested Ports</h2>
            <p className="text-xs text-muted-foreground">
              Review and accept, edit, or dismiss these suggestions
            </p>
          </div>
          <button
            type="button"
            onClick={onReject}
            className="rounded p-1 hover:bg-accent transition-colors"
            aria-label="Dismiss port suggestions"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Consolidation warning banner — AC 6, Task 6 */}
        {consolidationWarning && (
          <div
            className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
            role="alert"
            data-testid="consolidation-warning"
          >
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              AI consolidated {consolidatedFrom} edge signals into {ports.length} ports (soft limit:
              10)
            </span>
          </div>
        )}

        {/* Port table */}
        <div className="max-h-72 overflow-y-auto p-4">
          {ports.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No ports could be inferred from the graph edges.
            </p>
          ) : (
            <table
              className="w-full text-xs"
              data-testid="port-inference-table"
              aria-label="Inferred ports"
            >
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-1.5 text-left font-medium">Name</th>
                  <th className="pb-1.5 text-left font-medium">Direction</th>
                  <th className="pb-1.5 text-left font-medium">Type</th>
                  <th className="pb-1.5 text-left font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ports.map((port) => (
                  <tr key={port.id} data-testid={`inferred-port-${port.id}`}>
                    <td className="py-1.5 pr-3 font-mono">{port.name}</td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                          port.direction === 'input'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                        )}
                      >
                        {port.direction}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {port.type ?? <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                          CONFIDENCE_STYLES[port.confidence]
                        )}
                        data-testid={`confidence-badge-${port.id}`}
                      >
                        {port.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
            disabled={isSaving}
            data-testid="dismiss-btn"
          >
            Dismiss
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditBeforeSaving}
            disabled={isSaving || ports.length === 0}
            data-testid="edit-before-saving-btn"
          >
            Edit Before Saving
          </Button>
          <Button
            size="sm"
            onClick={handleAcceptAll}
            disabled={isSaving || ports.length === 0}
            data-testid="accept-all-btn"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Accept All'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
