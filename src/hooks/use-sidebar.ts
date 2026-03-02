'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarStore = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
};

export const useSidebar = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (value) => set({ collapsed: value }),
    }),
    { name: 'sidebar-state' }
  )
);
