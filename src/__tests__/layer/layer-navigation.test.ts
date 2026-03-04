/**
 * Tests for Story 9.3: Layer Navigation — useLayerNavigation Zustand store
 *
 * Covers:
 * - pushLayer: adds entry to stack
 * - popLayer: removes last entry
 * - jumpToLayer: trims stack to given index (inclusive)
 * - setStack: replaces entire stack
 * - currentGraphId: returns last entry's graphId or null
 * - reset: clears stack
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useLayerNavigation } from '@/hooks/useLayerNavigation';

// Reset zustand store state between tests
function resetStore() {
  useLayerNavigation.getState().reset();
}

const ROOT: import('@/hooks/useLayerNavigation').LayerEntry = {
  graphId: 'root-id',
  label: 'Root',
};

const CHILD_A: import('@/hooks/useLayerNavigation').LayerEntry = {
  graphId: 'child-a',
  label: 'Child A',
};

const CHILD_B: import('@/hooks/useLayerNavigation').LayerEntry = {
  graphId: 'child-b',
  label: 'Child B',
};

describe('useLayerNavigation — Zustand store (Story 9.3)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with an empty layerStack', () => {
    const { layerStack } = useLayerNavigation.getState();
    expect(layerStack).toEqual([]);
  });

  it('currentGraphId returns null when stack is empty', () => {
    const { currentGraphId } = useLayerNavigation.getState();
    expect(currentGraphId()).toBeNull();
  });

  it('pushLayer adds entry to the stack', () => {
    const { pushLayer } = useLayerNavigation.getState();
    pushLayer(ROOT);
    expect(useLayerNavigation.getState().layerStack).toEqual([ROOT]);
  });

  it('pushLayer stacks multiple entries in order', () => {
    const { pushLayer } = useLayerNavigation.getState();
    pushLayer(ROOT);
    pushLayer(CHILD_A);
    pushLayer(CHILD_B);
    expect(useLayerNavigation.getState().layerStack).toEqual([ROOT, CHILD_A, CHILD_B]);
  });

  it('currentGraphId returns the last entry graphId', () => {
    const { pushLayer, currentGraphId } = useLayerNavigation.getState();
    pushLayer(ROOT);
    pushLayer(CHILD_A);
    expect(currentGraphId()).toBe('child-a');
  });

  it('popLayer removes the last entry', () => {
    useLayerNavigation.getState().pushLayer(ROOT);
    useLayerNavigation.getState().pushLayer(CHILD_A);
    useLayerNavigation.getState().popLayer();
    expect(useLayerNavigation.getState().layerStack).toEqual([ROOT]);
  });

  it('popLayer on single-entry stack results in empty stack', () => {
    useLayerNavigation.getState().pushLayer(ROOT);
    useLayerNavigation.getState().popLayer();
    expect(useLayerNavigation.getState().layerStack).toEqual([]);
  });

  it('popLayer on empty stack is a no-op (no crash)', () => {
    expect(() => useLayerNavigation.getState().popLayer()).not.toThrow();
    expect(useLayerNavigation.getState().layerStack).toEqual([]);
  });

  it('jumpToLayer trims stack to index (inclusive)', () => {
    useLayerNavigation.getState().pushLayer(ROOT);
    useLayerNavigation.getState().pushLayer(CHILD_A);
    useLayerNavigation.getState().pushLayer(CHILD_B);
    useLayerNavigation.getState().jumpToLayer(1);
    expect(useLayerNavigation.getState().layerStack).toEqual([ROOT, CHILD_A]);
  });

  it('jumpToLayer to index 0 keeps only root', () => {
    useLayerNavigation.getState().pushLayer(ROOT);
    useLayerNavigation.getState().pushLayer(CHILD_A);
    useLayerNavigation.getState().pushLayer(CHILD_B);
    useLayerNavigation.getState().jumpToLayer(0);
    expect(useLayerNavigation.getState().layerStack).toEqual([ROOT]);
  });

  it('setStack replaces the full stack', () => {
    useLayerNavigation.getState().pushLayer(ROOT);
    useLayerNavigation.getState().setStack([ROOT, CHILD_A, CHILD_B]);
    expect(useLayerNavigation.getState().layerStack).toEqual([ROOT, CHILD_A, CHILD_B]);
  });

  it('setStack with empty array clears the stack', () => {
    useLayerNavigation.getState().pushLayer(ROOT);
    useLayerNavigation.getState().setStack([]);
    expect(useLayerNavigation.getState().layerStack).toEqual([]);
  });

  it('reset clears the stack', () => {
    useLayerNavigation.getState().pushLayer(ROOT);
    useLayerNavigation.getState().pushLayer(CHILD_A);
    useLayerNavigation.getState().reset();
    expect(useLayerNavigation.getState().layerStack).toEqual([]);
  });

  it('currentGraphId updates correctly after push + pop', () => {
    const { pushLayer, popLayer, currentGraphId } = useLayerNavigation.getState();
    pushLayer(ROOT);
    pushLayer(CHILD_A);
    popLayer();
    expect(currentGraphId()).toBe('root-id');
  });
});
