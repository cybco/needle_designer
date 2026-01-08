import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  autoGeneratePreview: boolean;
  setAutoGeneratePreview: (value: boolean) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      autoGeneratePreview: false, // Disabled by default to prevent "not responding" on large images
      setAutoGeneratePreview: (value) => set({ autoGeneratePreview: value }),
    }),
    {
      name: 'needlepoint-config',
    }
  )
);
