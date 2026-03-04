import { create } from 'zustand';

export interface LayerEntry {
  graphId: string;
  label: string;
}

interface LayerNavigationState {
  layerStack: LayerEntry[];
  pushLayer: (entry: LayerEntry) => void;
  popLayer: () => void;
  jumpToLayer: (index: number) => void;
  setStack: (stack: LayerEntry[]) => void;
  currentGraphId: () => string | null;
  reset: () => void;
}

/**
 * useLayerNavigation — Story 9.3
 *
 * Zustand store for layer drill-down navigation.
 * layerStack[0] = root layer (if set), last entry = current layer.
 */
export const useLayerNavigation = create<LayerNavigationState>((set, get) => ({
  layerStack: [],

  pushLayer: (entry) => set((s) => ({ layerStack: [...s.layerStack, entry] })),

  popLayer: () => set((s) => ({ layerStack: s.layerStack.slice(0, -1) })),

  jumpToLayer: (index) => set((s) => ({ layerStack: s.layerStack.slice(0, index + 1) })),

  setStack: (stack) => set({ layerStack: stack }),

  currentGraphId: () => {
    const { layerStack } = get();
    return layerStack.length > 0 ? layerStack[layerStack.length - 1].graphId : null;
  },

  reset: () => set({ layerStack: [] }),
}));
