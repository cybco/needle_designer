use crate::licensing::types::{LicenseError, LicenseState};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// Storage key for license state in app data
const LICENSE_STATE_FILE: &str = "license-state.json";

/// In-memory cache for license state
static LICENSE_STATE_CACHE: Mutex<Option<LicenseState>> = Mutex::new(None);

/// Get the license state storage path
fn get_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, LicenseError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| LicenseError::Storage(format!("Failed to get app data dir: {}", e)))?;

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| LicenseError::Storage(format!("Failed to create app data dir: {}", e)))?;

    Ok(app_dir.join(LICENSE_STATE_FILE))
}

/// Load license state from storage
pub fn load_license_state(app: &tauri::AppHandle) -> Result<LicenseState, LicenseError> {
    // Check in-memory cache first
    {
        let cache = LICENSE_STATE_CACHE.lock().unwrap();
        if let Some(state) = cache.as_ref() {
            return Ok(state.clone());
        }
    }

    // Load from file
    let path = get_storage_path(app)?;

    if !path.exists() {
        // No saved state, return default
        return Ok(LicenseState::default());
    }

    let contents = std::fs::read_to_string(&path)
        .map_err(|e| LicenseError::Storage(format!("Failed to read license state: {}", e)))?;

    let state: LicenseState = serde_json::from_str(&contents)
        .map_err(|e| LicenseError::Storage(format!("Failed to parse license state: {}", e)))?;

    // Update cache
    {
        let mut cache = LICENSE_STATE_CACHE.lock().unwrap();
        *cache = Some(state.clone());
    }

    Ok(state)
}

/// Save license state to storage
pub fn save_license_state(app: &tauri::AppHandle, state: &LicenseState) -> Result<(), LicenseError> {
    let path = get_storage_path(app)?;

    let json = serde_json::to_string_pretty(state)
        .map_err(|e| LicenseError::Storage(format!("Failed to serialize license state: {}", e)))?;

    std::fs::write(&path, json)
        .map_err(|e| LicenseError::Storage(format!("Failed to write license state: {}", e)))?;

    // Update cache
    {
        let mut cache = LICENSE_STATE_CACHE.lock().unwrap();
        *cache = Some(state.clone());
    }

    Ok(())
}

/// Clear the in-memory cache (useful for testing or reset)
pub fn clear_cache() {
    let mut cache = LICENSE_STATE_CACHE.lock().unwrap();
    *cache = None;
}

/// Delete all stored license data (for testing or reset)
pub fn clear_license_state(app: &tauri::AppHandle) -> Result<(), LicenseError> {
    clear_cache();

    let path = get_storage_path(app)?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| LicenseError::Storage(format!("Failed to delete license state: {}", e)))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require a Tauri app handle which isn't available in unit tests
    // Integration tests will be added later
}
