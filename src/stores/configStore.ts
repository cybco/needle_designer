import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  autoGeneratePreview: boolean;
  setAutoGeneratePreview: (value: boolean) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      autoGeneratePreview: true,
      setAutoGeneratePreview: (value) => set({ autoGeneratePreview: value }),
    }),
    {
      name: 'needlepoint-config',
    }
  )
);
