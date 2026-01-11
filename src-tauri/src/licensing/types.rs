use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Current license status
#[derive(Serialize, Deserialize, Clone, PartialEq, Debug, Default)]
#[serde(rename_all = "snake_case")]
pub enum LicenseStatus {
    #[default]
    None,                    // No license, no trial started
    Trial,                   // In active trial period
    TrialExpired,            // Trial has expired
    Licensed,                // Valid perpetual license
    LicensedUpdatesExpired,  // Licensed but updates expired (still functional)
    Invalid,                 // License revoked or invalid
    GracePeriod,             // Offline too long, needs validation
}

/// Source of the license
#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum LicenseSource {
    LicenseKey,      // Activated via STCH-XXXX key (web purchase)
    AppleIap,        // Purchased via Apple App Store
    MicrosoftStore,  // Purchased via Microsoft Store
}

/// Complete license state stored locally
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct LicenseState {
    pub status: LicenseStatus,
    pub source: Option<LicenseSource>,
    pub license_key: Option<String>,
    pub device_id: String,
    pub platform: String,  // "windows", "macos", "ios"
    pub trial_start: Option<DateTime<Utc>>,
    pub trial_expires: Option<DateTime<Utc>>,
    pub license_activated: Option<DateTime<Utc>>,
    pub updates_expire: Option<DateTime<Utc>>,
    pub last_validated: Option<DateTime<Utc>>,
    pub cached_validation: Option<CachedValidation>,
    // IAP-specific
    pub iap_transaction_id: Option<String>,
    pub iap_original_transaction_id: Option<String>,
}

impl LicenseState {
    /// Get days remaining in trial (None if not in trial)
    pub fn trial_days_remaining(&self) -> Option<i64> {
        if self.status != LicenseStatus::Trial {
            return None;
        }

        if let Some(expires) = self.trial_expires {
            let now = Utc::now();
            let days = (expires - now).num_days();
            Some(days.max(0))
        } else {
            None
        }
    }

    /// Check if the user can use the app (trial active or licensed)
    pub fn can_use_app(&self) -> bool {
        matches!(
            self.status,
            LicenseStatus::Trial | LicenseStatus::Licensed | LicenseStatus::LicensedUpdatesExpired
        )
    }

    /// Check if exports should be watermarked
    pub fn should_watermark(&self) -> bool {
        matches!(self.status, LicenseStatus::Trial)
    }
}

/// Cached validation from server (for offline use)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CachedValidation {
    pub valid: bool,
    pub status: String,
    pub updates_expire: Option<DateTime<Utc>>,
    pub devices_used: u32,
    pub devices_max: u32,
    pub signature: String,
    pub cached_at: DateTime<Utc>,
}

/// Result of activation attempt
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActivationResult {
    pub success: bool,
    pub error: Option<String>,
    pub error_code: Option<String>,
    pub devices_used: Option<u32>,
    pub devices_max: Option<u32>,
}

/// Update information
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub update_allowed: bool,  // Based on updates_expire
    pub download_url: Option<String>,
    pub release_notes: Option<String>,
    pub release_date: Option<DateTime<Utc>>,
}

/// License state for frontend (simplified view)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LicenseInfo {
    pub status: LicenseStatus,
    pub source: Option<LicenseSource>,
    pub trial_days_remaining: Option<i64>,
    pub updates_expire: Option<DateTime<Utc>>,
    pub devices_used: u32,
    pub devices_max: u32,
    pub needs_online_validation: bool,
    pub platform: String,
    pub can_use_app: bool,
    pub should_watermark: bool,
}

impl From<&LicenseState> for LicenseInfo {
    fn from(state: &LicenseState) -> Self {
        let (devices_used, devices_max) = state.cached_validation
            .as_ref()
            .map(|v| (v.devices_used, v.devices_max))
            .unwrap_or((0, 3));

        LicenseInfo {
            status: state.status.clone(),
            source: state.source.clone(),
            trial_days_remaining: state.trial_days_remaining(),
            updates_expire: state.updates_expire,
            devices_used,
            devices_max,
            needs_online_validation: state.cached_validation.is_none(),
            platform: state.platform.clone(),
            can_use_app: state.can_use_app(),
            should_watermark: state.should_watermark(),
        }
    }
}

/// Platform information
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PlatformInfo {
    pub platform: String,
    pub device_id: String,
    pub app_version: String,
    pub is_app_store: bool,
}

/// Error types for licensing operations
#[derive(thiserror::Error, Debug)]
pub enum LicenseError {
    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Invalid license key")]
    InvalidKey,

    #[error("Device limit reached ({used}/{max})")]
    DeviceLimitReached { used: u32, max: u32 },

    #[error("License revoked")]
    LicenseRevoked,

    #[error("Trial already started")]
    TrialAlreadyStarted,

    #[error("Trial expired")]
    TrialExpired,

    #[error("Signature verification failed")]
    SignatureInvalid,

    #[error("Server error: {0}")]
    ServerError(String),

    #[error("Rate limited")]
    RateLimited,
}

impl Serialize for LicenseError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
