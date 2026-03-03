'use client';

import { useCallback, useRef, useState } from 'react';
import { MessageSquare, GitBranch, Star, FileText, BookOpen, StickyNote } from 'lucide-react';
import type { CanvasArtifact, ArtifactType } from '@/lib/canvas/types';

interface ArtifactCardProps {
  artifact: CanvasArtifact;
  zoom: number;
  onDragEnd: (id: string, x: number, y: number) => void;
}

const TYPE_META: Record<ArtifactType, { icon: React.ElementType; label: string; color: string }> = {
  conversation: { icon: MessageSquare, label: 'Chat', color: 'text-blue-500' },
  diagram: { icon: GitBranch, label: 'Flow', color: 'text-violet-500' },
  review: { icon: Star, label: 'Review', color: 'text-amber-500' },
  spec: { icon: FileText, label: 'Spec', color: 'text-green-500' },
  story: { icon: BookOpen, label: 'Story', color: 'text-rose-500' },
  note: { icon: StickyNote, label: 'Note', color: 'text-orange-500' },
};

/**
 * ArtifactCard — Story 8.2
 *
 * A draggable card positioned absolutely inside the canvas world div.
 * Uses pointer capture for smooth drag even when cursor leaves the element.
 */
export function ArtifactCard({ artifact, zoom, onDragEnd }: ArtifactCardProps) {
  const { position, type, title, id } = artifact;
  const meta = TYPE_META[type] ?? TYPE_META.note;
  const Icon = meta.icon;

  // Local position state for optimistic drag
  const [localPos, setLocalPos] = useState({ x: position.x, y: position.y });
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation(); // Prevent viewport pan from firing
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startX: localPos.x,
        startY: localPos.y,
      };
    },
    [localPos]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      // Convert screen delta to world-space delta by dividing by zoom
      const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
      const dy = (e.clientY - dragStartRef.current.clientY) / zoom;
      setLocalPos({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    },
    [zoom]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
      const dy = (e.clientY - dragStartRef.current.clientY) / zoom;
      const finalX = dragStartRef.current.startX + dx;
      const finalY = dragStartRef.current.startY + dy;
      dragStartRef.current = null;
      setLocalPos({ x: finalX, y: finalY });
      onDragEnd(id, finalX, finalY);
    },
    [id, zoom, onDragEnd]
  );

  return (
    <div
      className="absolute rounded-lg border border-border bg-card shadow-md select-none cursor-default"
      style={{
        left: localPos.x,
        top: localPos.y,
        width: position.width,
        height: position.height,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm font-medium cursor-grab active:cursor-grabbing">
        <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
        <span className="truncate">{title ?? meta.label}</span>
      </div>

      {/* Card body — placeholder preview */}
      <div className="p-3 text-muted-foreground text-xs flex items-center justify-center gap-2 h-[calc(100%-37px)]">
        <Icon className={`h-6 w-6 ${meta.color} opacity-20`} />
        <span className="opacity-50">{meta.label}</span>
      </div>
    </div>
  );
}
