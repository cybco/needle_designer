use crate::licensing::api::{LicenseApiClient, TrialInitRequest};
use crate::licensing::config::{get_platform, TRIAL_DAYS};
use crate::licensing::device::get_device_id;
use crate::licensing::storage::{load_license_state, save_license_state};
use crate::licensing::types::{LicenseError, LicenseInfo, LicenseState, LicenseStatus, PlatformInfo};
use chrono::{Duration, Utc};

/// Get the current app version from Cargo.toml
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Tauri commands for license management
pub mod commands {
    use super::*;

    /// Initialize license system on app startup
    /// Returns current license state after checking/updating status
    #[tauri::command]
    pub async fn init_license(app: tauri::AppHandle) -> Result<LicenseInfo, String> {
        // Load existing state
        let mut state = load_license_state(&app).map_err(|e| e.to_string())?;

        // Ensure we have a device ID
        if state.device_id.is_empty() {
            state.device_id = get_device_id()
                .map_err(|e| format!("Failed to get device ID: {}", e))?;
            state.platform = get_platform().to_string();
        }

        // Update trial status if applicable
        update_trial_status(&mut state);

        // Save updated state
        save_license_state(&app, &state).map_err(|e| e.to_string())?;

        Ok(LicenseInfo::from(&state))
    }

    /// Get current license status without making network calls
    #[tauri::command]
    pub fn get_license_status(app: tauri::AppHandle) -> Result<LicenseInfo, String> {
        let mut state = load_license_state(&app).map_err(|e| e.to_string())?;
        update_trial_status(&mut state);

        // Save if status changed
        let _ = save_license_state(&app, &state);

        Ok(LicenseInfo::from(&state))
    }

    /// Start a new trial
    /// Makes API call to register trial on server
    #[tauri::command]
    pub async fn start_trial(app: tauri::AppHandle) -> Result<LicenseInfo, String> {
        let mut state = load_license_state(&app).map_err(|e| e.to_string())?;

        // Check if trial was already started
        if state.trial_start.is_some() {
            return Err(LicenseError::TrialAlreadyStarted.to_string());
        }

        // Ensure we have device ID
        if state.device_id.is_empty() {
            state.device_id = get_device_id()
                .map_err(|e| format!("Failed to get device ID: {}", e))?;
            state.platform = get_platform().to_string();
        }

        // Try to register trial with server
        let client = LicenseApiClient::new();
        let request = TrialInitRequest {
            device_id: state.device_id.clone(),
            platform: state.platform.clone(),
            app_version: get_app_version(),
        };

        match client.init_trial(request).await {
            Ok(response) => {
                if response.success {
                    // Use server-provided dates if available, otherwise calculate locally
                    state.trial_start = response.trial_start.or_else(|| Some(Utc::now()));
                    state.trial_expires = response.trial_expires.or_else(|| {
                        Some(Utc::now() + Duration::days(TRIAL_DAYS))
                    });
                    state.status = LicenseStatus::Trial;
                } else {
                    // Server rejected trial (e.g., already started)
                    let error = response.error.unwrap_or_else(|| "Unknown error".to_string());
                    return Err(error);
                }
            }
            Err(e) => {
                // Network error - start trial locally
                // The server will reconcile when we can connect
                eprintln!("Could not reach license server, starting local trial: {}", e);
                state.trial_start = Some(Utc::now());
                state.trial_expires = Some(Utc::now() + Duration::days(TRIAL_DAYS));
                state.status = LicenseStatus::Trial;
            }
        }

        // Save the state
        save_license_state(&app, &state).map_err(|e| e.to_string())?;

        Ok(LicenseInfo::from(&state))
    }

    /// Get platform information (device ID, platform, version)
    #[tauri::command]
    pub fn get_platform_info(app: tauri::AppHandle) -> Result<PlatformInfo, String> {
        let state = load_license_state(&app).map_err(|e| e.to_string())?;

        let device_id = if state.device_id.is_empty() {
            get_device_id().map_err(|e| format!("Failed to get device ID: {}", e))?
        } else {
            state.device_id
        };

        let is_app_store = {
            #[cfg(target_os = "macos")]
            {
                std::env::var("APP_SANDBOX_CONTAINER_ID").is_ok()
            }
            #[cfg(target_os = "windows")]
            {
                std::env::var("PACKAGE_NAME").is_ok()
            }
            #[cfg(target_os = "ios")]
            {
                true // iOS is always App Store
            }
            #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "ios")))]
            {
                false
            }
        };

        Ok(PlatformInfo {
            platform: get_platform().to_string(),
            device_id,
            app_version: get_app_version(),
            is_app_store,
        })
    }

    /// Check if exports should be watermarked (for PDF export)
    #[tauri::command]
    pub fn should_watermark_export(app: tauri::AppHandle) -> Result<bool, String> {
        let state = load_license_state(&app).map_err(|e| e.to_string())?;
        Ok(state.should_watermark())
    }

    /// Reset license state (for testing/debugging only)
    #[cfg(debug_assertions)]
    #[tauri::command]
    pub fn reset_license_state(app: tauri::AppHandle) -> Result<(), String> {
        crate::licensing::storage::clear_license_state(&app).map_err(|e| e.to_string())
    }
}

/// Update trial status based on current time
fn update_trial_status(state: &mut LicenseState) {
    if state.status == LicenseStatus::Trial {
        if let Some(expires) = state.trial_expires {
            if Utc::now() > expires {
                state.status = LicenseStatus::TrialExpired;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_trial_status_active() {
        let mut state = LicenseState {
            status: LicenseStatus::Trial,
            trial_expires: Some(Utc::now() + Duration::days(10)),
            ..Default::default()
        };

        update_trial_status(&mut state);
        assert_eq!(state.status, LicenseStatus::Trial);
    }

    #[test]
    fn test_update_trial_status_expired() {
        let mut state = LicenseState {
            status: LicenseStatus::Trial,
            trial_expires: Some(Utc::now() - Duration::days(1)),
            ..Default::default()
        };

        update_trial_status(&mut state);
        assert_eq!(state.status, LicenseStatus::TrialExpired);
    }
}
