import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  autoGeneratePreview: boolean;
  setAutoGeneratePreview: (value: boolean) => void;
  confirmColorRemoval: boolean;
  setConfirmColorRemoval: (value: boolean) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      autoGeneratePreview: true, // Enabled by default
      setAutoGeneratePreview: (value) => set({ autoGeneratePreview: value }),
      confirmColorRemoval: true, // Enabled by default
      setConfirmColorRemoval: (value) => set({ confirmColorRemoval: value }),
    }),
    {
      name: 'needlepoint-config',
    }
  )
);
