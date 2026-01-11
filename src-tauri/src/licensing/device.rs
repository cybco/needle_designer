use std::error::Error;

/// Get platform-specific device ID
pub fn get_device_id() -> Result<String, Box<dyn Error + Send + Sync>> {
    #[cfg(target_os = "windows")]
    {
        get_windows_device_id()
    }

    #[cfg(target_os = "macos")]
    {
        get_macos_device_id()
    }

    #[cfg(target_os = "ios")]
    {
        get_ios_device_id()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "ios")))]
    {
        // Fallback for other platforms - generate a random UUID
        Ok(uuid::Uuid::new_v4().to_string())
    }
}

/// Windows device ID using machine GUID from registry
#[cfg(target_os = "windows")]
fn get_windows_device_id() -> Result<String, Box<dyn Error + Send + Sync>> {
    use machineid_rs::{Encryption, HWIDComponent, IdBuilder};

    let id = IdBuilder::new(Encryption::SHA256)
        .add_component(HWIDComponent::SystemID)
        .build("needlepoint")?;

    Ok(id)
}

/// macOS device ID - IOPlatformUUID for direct download, Keychain UUID for App Store
#[cfg(target_os = "macos")]
fn get_macos_device_id() -> Result<String, Box<dyn Error + Send + Sync>> {
    // Check if running as Mac App Store app (sandboxed)
    if is_mac_app_store() {
        // For Phase 1, we'll use a simple approach - full Keychain integration in Phase 6
        // Generate and store a UUID in a local file within the sandbox
        get_or_create_sandboxed_device_id()
    } else {
        // Direct download: Use IOPlatformUUID via machineid
        use machineid_rs::{Encryption, HWIDComponent, IdBuilder};

        let id = IdBuilder::new(Encryption::SHA256)
            .add_component(HWIDComponent::SystemID)
            .build("needlepoint")?;

        Ok(id)
    }
}

/// Check if running as Mac App Store app (sandboxed)
#[cfg(target_os = "macos")]
fn is_mac_app_store() -> bool {
    // Check for App Store receipt or sandbox entitlement
    std::path::Path::new("../Library/Receipts/receipt").exists()
        || std::env::var("APP_SANDBOX_CONTAINER_ID").is_ok()
}

/// Get or create a device ID stored in the sandbox (Mac App Store)
#[cfg(target_os = "macos")]
fn get_or_create_sandboxed_device_id() -> Result<String, Box<dyn Error + Send + Sync>> {
    // For now, use a simple file-based approach
    // Full Keychain integration will be added in Phase 6
    let home = std::env::var("HOME")?;
    let device_id_path = std::path::PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("com.stitchalot.needlepoint")
        .join(".device_id");

    // Try to read existing ID
    if let Ok(id) = std::fs::read_to_string(&device_id_path) {
        let id = id.trim();
        if !id.is_empty() {
            return Ok(id.to_string());
        }
    }

    // Generate new UUID and store it
    let device_id = uuid::Uuid::new_v4().to_string();

    // Create directory if needed
    if let Some(parent) = device_id_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(&device_id_path, &device_id)?;
    Ok(device_id)
}

/// iOS device ID using identifierForVendor
#[cfg(target_os = "ios")]
fn get_ios_device_id() -> Result<String, Box<dyn Error + Send + Sync>> {
    // For Phase 1, we use a file-based approach similar to macOS sandbox
    // Full identifierForVendor integration via Swift bridge will be added in Phase 6
    let device_id_path = dirs::data_local_dir()
        .ok_or("Could not get local data directory")?
        .join("com.stitchalot.needlepoint")
        .join(".device_id");

    // Try to read existing ID
    if let Ok(id) = std::fs::read_to_string(&device_id_path) {
        let id = id.trim();
        if !id.is_empty() {
            return Ok(id.to_string());
        }
    }

    // Generate new UUID and store it
    let device_id = uuid::Uuid::new_v4().to_string();

    if let Some(parent) = device_id_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(&device_id_path, &device_id)?;
    Ok(device_id)
}

/// Check if running as Microsoft Store app
#[cfg(target_os = "windows")]
pub fn is_ms_store_app() -> bool {
    // Check if running in app container (UWP/MSIX)
    std::env::var("PACKAGE_NAME").is_ok()
}

/// Get Microsoft Store user ID (for MS Store purchases)
#[cfg(target_os = "windows")]
pub fn get_ms_store_user_id() -> Option<String> {
    // Full implementation in Phase 7
    // For now, return None (use device ID instead)
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_device_id() {
        let result = get_device_id();
        assert!(result.is_ok());
        let id = result.unwrap();
        assert!(!id.is_empty());
        println!("Device ID: {}", id);
    }
}
