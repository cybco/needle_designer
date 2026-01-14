/// License server URL
pub const LICENSE_SERVER_URL: &str = "https://stitchalot.studio";

/// Trial configuration
pub const TRIAL_DAYS: i64 = 30;

/// Offline caching configuration
pub const CACHE_TTL_DAYS: i64 = 30;
pub const GRACE_PERIOD_DAYS: i64 = 7;

/// App Store product IDs
pub const APPLE_PRODUCT_ID: &str = "com.stitchalot.needlepoint.license";
pub const MS_STORE_PRODUCT_ID: &str = "NeedlePointDesignerLicense";

/// Ed25519 public key for signature verification (base64 encoded)
/// This will be generated and replaced with actual key from the server
/// IMPORTANT: Update this when rotating keys (requires app update)
pub const LICENSE_SERVER_PUBLIC_KEY: &str = "PLACEHOLDER_PUBLIC_KEY_BASE64";

/// Stronghold storage configuration
pub const STRONGHOLD_CLIENT_PATH: &str = "license.hold";
pub const STRONGHOLD_VAULT_PATH: &[u8] = b"license_vault";
pub const STRONGHOLD_RECORD_PATH: &[u8] = b"license_state";

/// API endpoints
pub mod endpoints {
    use super::LICENSE_SERVER_URL;

    pub fn trial_init() -> String {
        format!("{}/api/v1/trial/init", LICENSE_SERVER_URL)
    }

    pub fn activate() -> String {
        format!("{}/api/v1/activate", LICENSE_SERVER_URL)
    }

    pub fn validate() -> String {
        format!("{}/api/v1/validate", LICENSE_SERVER_URL)
    }

    pub fn deactivate() -> String {
        format!("{}/api/v1/deactivate", LICENSE_SERVER_URL)
    }

    pub fn recover() -> String {
        format!("{}/api/v1/recover", LICENSE_SERVER_URL)
    }

    pub fn check_updates() -> String {
        format!("{}/api/v1/check-updates", LICENSE_SERVER_URL)
    }
}

/// Get current platform string
pub fn get_platform() -> &'static str {
    #[cfg(target_os = "windows")]
    return "windows";

    #[cfg(target_os = "macos")]
    return "macos";

    #[cfg(target_os = "ios")]
    return "ios";

    #[cfg(target_os = "android")]
    return "android";

    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    )))]
    return "unknown";
}
