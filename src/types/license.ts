// License types matching the Rust backend

export type LicenseStatus =
  | 'none'
  | 'trial'
  | 'trial_expired'
  | 'licensed'
  | 'licensed_updates_expired'
  | 'invalid'
  | 'grace_period';

export type LicenseSource = 'license_key' | 'apple_iap' | 'microsoft_store';

// Matches Rust LicenseInfo struct
export interface LicenseInfo {
  status: LicenseStatus;
  source: LicenseSource | null;
  trial_days_remaining: number | null;
  updates_expire: string | null; // ISO date string
  devices_used: number;
  devices_max: number;
  needs_online_validation: boolean;
  platform: 'windows' | 'macos' | 'ios';
  can_use_app: boolean;
  should_watermark: boolean;
}

export interface PlatformInfo {
  platform: string;
  device_id: string;
  app_version: string;
  is_app_store: boolean;
}

export interface ActivationResult {
  success: boolean;
  error?: string;
  error_code?: string;
  devices_used?: number;
  devices_max?: number;
}

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  update_allowed: boolean;
  download_url?: string;
  release_notes?: string;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  email_sent?: boolean;
}

// Helper to mask license key for display
export function maskLicenseKey(key: string): string {
  // STCH-ABCD-EFGH-IJKL-MNOP → STCH-****-****-****-MNOP
  const parts = key.split('-');
  if (parts.length !== 5) return key;
  return `${parts[0]}-****-****-****-${parts[4]}`;
}

// Get human-readable status message
export function getLicenseStatusMessage(status: LicenseStatus): string {
  switch (status) {
    case 'none':
      return 'Not activated';
    case 'trial':
      return 'Trial version';
    case 'trial_expired':
      return 'Trial expired';
    case 'licensed':
      return 'Licensed';
    case 'licensed_updates_expired':
      return 'Licensed (updates expired)';
    case 'invalid':
      return 'Invalid license';
    case 'grace_period':
      return 'Offline validation required';
    default:
      return 'Unknown';
  }
}

// Get status color for UI
export function getLicenseStatusColor(status: LicenseStatus): string {
  switch (status) {
    case 'licensed':
    case 'licensed_updates_expired':
      return 'text-green-600';
    case 'trial':
      return 'text-blue-600';
    case 'trial_expired':
    case 'invalid':
      return 'text-red-600';
    case 'grace_period':
      return 'text-yellow-600';
    default:
      return 'text-gray-600';
  }
}
