'use client';

/**
 * PortEditor — Story 9.5
 *
 * Modal panel for viewing and editing I/O ports on a composite node's child LayerGraph.
 * Supports add, inline-edit, reorder, and remove with edge-reference confirmation.
 * Saves via PATCH /api/workspaces/[id]/layers/[layerId] (ports field).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Plus, Trash2, GripVertical, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LayerPort } from '@/lib/layer/types';
import { SOFT_LIMITS } from '@/lib/layer/types';
import { validatePortContract, countEdgeReferences } from '@/lib/layer/validate-port-contract';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { PortContractWarning } from '@/lib/layer/validate-port-contract';

interface PortEditorProps {
  layerId: string;
  workspaceId: string;
  /** The graph of the parent diagram — used for edge-reference checks and contract validation. */
  graph?: JsonGraph;
  onClose: () => void;
}

interface PendingRemove {
  portId: string;
  refCount: number;
}

export function PortEditor({ layerId, workspaceId, graph, onClose }: PortEditorProps) {
  const router = useRouter();
  const [ports, setPorts] = useState<LayerPort[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [contractWarnings, setContractWarnings] = useState<PortContractWarning[]>([]);
  const [showSoftLimitWarning, setShowSoftLimitWarning] = useState(false);

  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Load ports on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function loadPorts() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/layers/${layerId}`);
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = (await res.json()) as { layer: { ports: LayerPort[] } };
        if (!cancelled) {
          setPorts((data.layer?.ports ?? []) as LayerPort[]);
        }
      } catch {
        toast.error('Failed to load ports');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadPorts();
    return () => {
      cancelled = true;
    };
  }, [layerId, workspaceId]);

  // -------------------------------------------------------------------------
  // Debounced PATCH (500ms)
  // -------------------------------------------------------------------------
  const schedulePatch = useCallback(
    (updatedPorts: LayerPort[]) => {
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
      patchTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const res = await fetch(`/api/workspaces/${workspaceId}/layers/${layerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ports: updatedPorts }),
          });
          if (!res.ok) throw new Error(`Server error ${res.status}`);
          // Cache invalidation (AC 6)
          router.refresh();
        } catch {
          toast.error('Failed to save ports');
        } finally {
          setIsSaving(false);
        }
      }, 500);
    },
    [layerId, workspaceId, router]
  );

  // -------------------------------------------------------------------------
  // Debounced contract validation (2s) — AC 10
  // -------------------------------------------------------------------------
  const scheduleContractValidation = useCallback(
    (updatedPorts: LayerPort[]) => {
      if (!graph) return;
      if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
      contractTimerRef.current = setTimeout(() => {
        const warnings = validatePortContract(updatedPorts, graph);
        setContractWarnings(warnings);
      }, 2000);
    },
    [graph]
  );

  // -------------------------------------------------------------------------
  // Mutate helpers
  // -------------------------------------------------------------------------
  const updatePorts = useCallback(
    (updatedPorts: LayerPort[]) => {
      setPorts(updatedPorts);
      schedulePatch(updatedPorts);
      scheduleContractValidation(updatedPorts);
    },
    [schedulePatch, scheduleContractValidation]
  );

  // -------------------------------------------------------------------------
  // Add port — AC 3, 4, 9
  // -------------------------------------------------------------------------
  const handleAddPort = useCallback(() => {
    const n = ports.length + 1;
    const newPort: LayerPort = {
      id: crypto.randomUUID(),
      name: `port_${n}`,
      direction: 'input',
      order: n - 1,
    };
    const updated = [...ports, newPort];
    // Soft limit check (AC 9)
    if (updated.length > SOFT_LIMITS.ports) {
      setShowSoftLimitWarning(true);
    }
    updatePorts(updated);
  }, [ports, updatePorts]);

  // -------------------------------------------------------------------------
  // Field edit — AC 5
  // -------------------------------------------------------------------------
  const handleFieldChange = useCallback(
    (portId: string, field: keyof LayerPort, value: string | number) => {
      const updated = ports.map((p) => (p.id === portId ? { ...p, [field]: value } : p));
      updatePorts(updated);
    },
    [ports, updatePorts]
  );

  // -------------------------------------------------------------------------
  // Remove port — AC 7, 8
  // -------------------------------------------------------------------------
  const handleRemoveRequest = useCallback(
    (portId: string) => {
      const refCount = graph ? countEdgeReferences(portId, graph) : 0;
      if (refCount > 0) {
        // Show confirmation (AC 8)
        setPendingRemove({ portId, refCount });
      } else {
        // Remove immediately
        const updated = ports
          .filter((p) => p.id !== portId)
          .map((p, idx) => ({ ...p, order: idx }));
        updatePorts(updated);
        if (updated.length <= SOFT_LIMITS.ports) setShowSoftLimitWarning(false);
      }
    },
    [graph, ports, updatePorts]
  );

  const confirmRemove = useCallback(() => {
    if (!pendingRemove) return;
    const updated = ports
      .filter((p) => p.id !== pendingRemove.portId)
      .map((p, idx) => ({ ...p, order: idx }));
    updatePorts(updated);
    if (updated.length <= SOFT_LIMITS.ports) setShowSoftLimitWarning(false);
    setPendingRemove(null);
  }, [pendingRemove, ports, updatePorts]);

  const cancelRemove = useCallback(() => setPendingRemove(null), []);

  // -------------------------------------------------------------------------
  // Close — cleanup timers
  // -------------------------------------------------------------------------
  const handleClose = useCallback(() => {
    if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
    onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleClose]);

  // -------------------------------------------------------------------------
  // Derive per-port contract warnings
  // -------------------------------------------------------------------------
  const warningsByPortId = new Map<string, PortContractWarning[]>();
  for (const w of contractWarnings) {
    if (w.portId) {
      const existing = warningsByPortId.get(w.portId) ?? [];
      warningsByPortId.set(w.portId, [...existing, w]);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={handleClose}
        data-testid="port-editor-backdrop"
      />

      {/* Modal panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col border-l border-border bg-background shadow-xl"
        role="dialog"
        aria-label="Port Editor"
        data-testid="port-editor"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Port Editor</h2>
            <p className="text-xs text-muted-foreground">Define I/O interface for this layer</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 hover:bg-accent transition-colors"
            aria-label="Close port editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Soft limit warning banner — AC 9 */}
        {showSoftLimitWarning && (
          <div
            className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
            data-testid="soft-limit-warning"
            role="alert"
          >
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              You have reached the recommended maximum of {SOFT_LIMITS.ports} ports. Additional
              ports may affect readability.
            </span>
          </div>
        )}

        {/* Contract validation summary — AC 10 */}
        {contractWarnings.length > 0 && (
          <div
            className="border-b border-orange-200 bg-orange-50 px-4 py-2 text-xs text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200"
            data-testid="contract-warnings"
            role="alert"
          >
            <p className="font-medium">
              {contractWarnings.length} port↔edge inconsistenc
              {contractWarnings.length === 1 ? 'y' : 'ies'} detected
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : ports.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No ports defined. Click &quot;Add Port&quot; to start.
            </p>
          ) : (
            <div className="space-y-2" data-testid="port-list">
              {ports.map((port) => {
                const portWarnings = warningsByPortId.get(port.id) ?? [];
                const isRemovePending = pendingRemove?.portId === port.id;

                return (
                  <div
                    key={port.id}
                    className="group rounded-md border border-border bg-card p-2"
                    data-testid={`port-row-${port.id}`}
                  >
                    {/* Row: grip + name + direction + type + remove */}
                    <div className="flex items-center gap-2">
                      {/* Drag handle (visual only for now) */}
                      <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />

                      {/* Name */}
                      <input
                        type="text"
                        value={port.name}
                        onChange={(e) => handleFieldChange(port.id, 'name', e.target.value)}
                        placeholder="port name"
                        className="h-7 flex-1 min-w-0 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        aria-label="Port name"
                        data-testid={`port-name-${port.id}`}
                      />

                      {/* Direction */}
                      <select
                        value={port.direction}
                        onChange={(e) =>
                          handleFieldChange(
                            port.id,
                            'direction',
                            e.target.value as 'input' | 'output'
                          )
                        }
                        className="h-7 rounded border border-input bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        aria-label="Port direction"
                        data-testid={`port-direction-${port.id}`}
                      >
                        <option value="input">in</option>
                        <option value="output">out</option>
                      </select>

                      {/* Type (optional) */}
                      <input
                        type="text"
                        value={port.type ?? ''}
                        onChange={(e) => handleFieldChange(port.id, 'type', e.target.value || '')}
                        placeholder="type"
                        className="h-7 w-20 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        aria-label="Port type"
                        data-testid={`port-type-${port.id}`}
                      />

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRequest(port.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label={`Remove port ${port.name}`}
                        data-testid={`port-remove-${port.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Contract warning badges — AC 10 */}
                    {portWarnings.length > 0 && (
                      <div className="mt-1.5 space-y-0.5" data-testid={`port-warnings-${port.id}`}>
                        {portWarnings.map((w, i) => (
                          <p
                            key={i}
                            className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400"
                          >
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            {w.message}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Edge-reference removal confirmation — AC 8 */}
                    {isRemovePending && (
                      <div
                        className="mt-2 rounded bg-destructive/10 p-2 text-xs"
                        data-testid={`port-remove-confirm-${port.id}`}
                      >
                        <p className="text-destructive font-medium mb-1">
                          This port is referenced by {pendingRemove!.refCount} edge(s). Remove
                          anyway?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            onClick={confirmRemove}
                            data-testid="confirm-remove-btn"
                          >
                            Remove
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={cancelRemove}
                            data-testid="cancel-remove-btn"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddPort}
              className="gap-1.5"
              data-testid="add-port-btn"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Port
            </Button>
            {isSaving && (
              <span className="text-xs text-muted-foreground" data-testid="saving-indicator">
                Saving…
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {ports.length}/{SOFT_LIMITS.ports} ports
          </p>
        </div>
      </div>
    </>
  );
}
