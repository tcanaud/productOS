'use client';

import { useCallback, useRef, useState } from 'react';

export interface CanvasViewportState {
  pan: { x: number; y: number };
  zoom: number;
  isPanning: boolean;
}

export interface CanvasViewportHandlers {
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * useCanvasViewport — Story 8.2
 *
 * Manages pan/zoom state for the infinite canvas viewport.
 *
 * Pan: pointer drag on blank viewport area.
 * Zoom: wheel scroll (no modifier = pan, ctrlKey = zoom toward cursor,
 *       trackpad pinch fires wheel with ctrlKey = true).
 */
export function useCanvasViewport() {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);

  // Track last pointer position during pan drag
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.ctrlKey) {
      // Zoom toward cursor
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prevZoom) => {
        const newZoom = clamp(prevZoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
        if (!viewportRef.current) return newZoom;

        const rect = viewportRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setPan((prevPan) => ({
          x: cursorX - (cursorX - prevPan.x) * (newZoom / prevZoom),
          y: cursorY - (cursorY - prevPan.y) * (newZoom / prevZoom),
        }));

        return newZoom;
      });
    } else {
      // Pan (regular scroll or two-finger swipe)
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only start pan when clicking directly on the viewport (not on a card)
    if (e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: 0, // will be filled from current pan via closure
      panY: 0,
    };
    // Store actual current pan values via a ref trick: re-assign after state read
    setPan((prev) => {
      if (panStartRef.current) {
        panStartRef.current.panX = prev.x;
        panStartRef.current.panY = prev.y;
      }
      return prev;
    });
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    panStartRef.current = null;
    setIsPanning(false);
  }, []);

  const worldTransform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return {
    viewportRef,
    pan,
    zoom,
    isPanning,
    worldTransform,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
  };
}
