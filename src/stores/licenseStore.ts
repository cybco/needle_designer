import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { LicenseInfo, PlatformInfo } from '../types/license';

interface LicenseStore {
  // State
  licenseInfo: LicenseInfo | null;
  platformInfo: PlatformInfo | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  startTrial: () => Promise<void>;
  shouldWatermark: () => boolean;
  canUseApp: () => boolean;
  clearError: () => void;

  // Debug actions (only in dev)
  resetLicenseState: () => Promise<void>;
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  // Initial state
  licenseInfo: null,
  platformInfo: null,
  isLoading: false,
  error: null,
  initialized: false,

  // Initialize license system on app startup
  initialize: async () => {
    if (get().initialized) return;

    set({ isLoading: true, error: null });

    try {
      // Get platform info first
      const platformInfo = await invoke<PlatformInfo>('get_platform_info');

      // Initialize license state
      const licenseInfo = await invoke<LicenseInfo>('init_license');

      set({
        licenseInfo,
        platformInfo,
        isLoading: false,
        initialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize license:', error);
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
        initialized: true,
      });
    }
  },

  // Refresh license status (without full initialization)
  refreshStatus: async () => {
    set({ isLoading: true, error: null });

    try {
      const licenseInfo = await invoke<LicenseInfo>('get_license_status');
      set({ licenseInfo, isLoading: false });
    } catch (error) {
      console.error('Failed to refresh license status:', error);
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },

  // Start a new trial
  startTrial: async () => {
    set({ isLoading: true, error: null });

    try {
      const licenseInfo = await invoke<LicenseInfo>('start_trial');
      set({ licenseInfo, isLoading: false });
    } catch (error) {
      console.error('Failed to start trial:', error);
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error; // Re-throw so UI can handle
    }
  },

  // Check if exports should be watermarked
  shouldWatermark: () => {
    const { licenseInfo } = get();
    return licenseInfo?.should_watermark ?? false;
  },

  // Check if user can use the app
  canUseApp: () => {
    const { licenseInfo } = get();
    return licenseInfo?.can_use_app ?? false;
  },

  // Clear error state
  clearError: () => {
    set({ error: null });
  },

  // Reset license state (dev only)
  resetLicenseState: async () => {
    if (import.meta.env.DEV) {
      try {
        await invoke('reset_license_state');
        set({
          licenseInfo: null,
          initialized: false,
          error: null,
        });
        // Re-initialize
        await get().initialize();
      } catch (error) {
        console.error('Failed to reset license state:', error);
      }
    }
  },
}));
