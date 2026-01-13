use crate::licensing::config::endpoints;
use crate::licensing::types::LicenseError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ============================================================================
// Common Response Types (Server uses consistent format)
// ============================================================================

/// Error object returned by the server
#[derive(Deserialize, Debug, Clone)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub details: Option<serde_json::Value>,
}

// ============================================================================
// Trial Init
// ============================================================================

/// Request to initialize a trial
#[derive(Serialize)]
pub struct TrialInitRequest {
    pub device_id: String,
    pub platform: String,
    pub app_version: String,
}

/// Data returned on successful trial init
#[derive(Deserialize, Debug)]
pub struct TrialInitData {
    pub expires_at: DateTime<Utc>,
    pub days_remaining: i64,
}

/// Response from trial initialization
#[derive(Deserialize, Debug)]
pub struct TrialInitResponse {
    pub success: bool,
    pub data: Option<TrialInitData>,
    pub error: Option<ApiError>,
    pub timestamp: Option<String>,
    pub signature: Option<String>,
}

impl TrialInitResponse {
    /// Get trial_start (calculated from expires_at - 30 days)
    pub fn trial_start(&self) -> Option<DateTime<Utc>> {
        self.data.as_ref().map(|d| d.expires_at - chrono::Duration::days(30))
    }

    /// Get trial_expires
    pub fn trial_expires(&self) -> Option<DateTime<Utc>> {
        self.data.as_ref().map(|d| d.expires_at)
    }

    /// Get days remaining
    pub fn days_remaining(&self) -> Option<i64> {
        self.data.as_ref().map(|d| d.days_remaining)
    }

    /// Get error message
    pub fn error_message(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.message.clone())
    }

    /// Get error code
    pub fn error_code(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.code.clone())
    }
}

// ============================================================================
// Validate License
// ============================================================================

/// Request to validate a license
#[derive(Serialize)]
pub struct ValidateRequest {
    pub license_key: String,
    pub device_id: String,
    pub platform: String,
    pub app_version: String,
}

/// Data returned on successful validation
#[derive(Deserialize, Debug)]
pub struct ValidateData {
    pub valid: bool,
    pub status: String,
    pub updates_expire: Option<DateTime<Utc>>,
    pub devices_used: u32,
    pub devices_max: u32,
}

/// Response from license validation
#[derive(Deserialize, Debug)]
pub struct ValidateResponse {
    pub success: bool,
    pub data: Option<ValidateData>,
    pub error: Option<ApiError>,
    pub timestamp: Option<String>,
    pub signature: Option<String>,
}

impl ValidateResponse {
    pub fn is_valid(&self) -> bool {
        self.data.as_ref().map(|d| d.valid).unwrap_or(false)
    }

    pub fn error_message(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.message.clone())
    }

    pub fn error_code(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.code.clone())
    }
}

// ============================================================================
// Activate License
// ============================================================================

/// Request to activate a license
#[derive(Serialize)]
pub struct ActivateRequest {
    pub license_key: String,
    pub device_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_name: Option<String>,
    pub platform: String,
    pub app_version: String,
}

/// Data returned on successful activation
#[derive(Deserialize, Debug)]
pub struct ActivateData {
    pub license_key: String,
    pub updates_expire: DateTime<Utc>,
    pub devices_used: u32,
    pub devices_max: u32,
}

/// Response from license activation
#[derive(Deserialize, Debug)]
pub struct ActivateResponse {
    pub success: bool,
    pub data: Option<ActivateData>,
    pub error: Option<ApiError>,
    pub timestamp: Option<String>,
    pub signature: Option<String>,
}

impl ActivateResponse {
    pub fn error_message(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.message.clone())
    }

    pub fn error_code(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.code.clone())
    }
}

// ============================================================================
// Deactivate Device
// ============================================================================

/// Request to deactivate a device
#[derive(Serialize)]
pub struct DeactivateRequest {
    pub license_key: String,
    pub device_id: String,
}

/// Data returned on successful deactivation
#[derive(Deserialize, Debug)]
pub struct DeactivateData {
    pub devices_used: u32,
    pub devices_max: u32,
}

/// Response from device deactivation
#[derive(Deserialize, Debug)]
pub struct DeactivateResponse {
    pub success: bool,
    pub data: Option<DeactivateData>,
    pub error: Option<ApiError>,
    pub timestamp: Option<String>,
}

impl DeactivateResponse {
    pub fn error_message(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.message.clone())
    }

    pub fn error_code(&self) -> Option<String> {
        self.error.as_ref().map(|e| e.code.clone())
    }
}

// ============================================================================
// HTTP Client
// ============================================================================

/// HTTP client for license server API
pub struct LicenseApiClient {
    client: reqwest::Client,
}

impl LicenseApiClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    /// Initialize a trial
    pub async fn init_trial(&self, request: TrialInitRequest) -> Result<TrialInitResponse, LicenseError> {
        let response = self
            .client
            .post(endpoints::trial_init())
            .json(&request)
            .send()
            .await
            .map_err(|e| LicenseError::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(LicenseError::RateLimited);
        }

        // Parse response body regardless of status code (server returns JSON errors)
        let result: TrialInitResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

        // Check for error in response
        if !result.success {
            if let Some(ref error) = result.error {
                return match error.code.as_str() {
                    "TRIAL_ALREADY_USED" => Err(LicenseError::TrialAlreadyStarted),
                    "RATE_LIMITED" => Err(LicenseError::RateLimited),
                    _ => Err(LicenseError::ServerError(error.message.clone())),
                };
            }
        }

        Ok(result)
    }

    /// Validate a license
    pub async fn validate(&self, request: ValidateRequest) -> Result<ValidateResponse, LicenseError> {
        let response = self
            .client
            .post(endpoints::validate())
            .json(&request)
            .send()
            .await
            .map_err(|e| LicenseError::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(LicenseError::RateLimited);
        }

        let result: ValidateResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

        if !result.success {
            if let Some(ref error) = result.error {
                return match error.code.as_str() {
                    "INVALID_LICENSE_KEY" => Err(LicenseError::InvalidKey),
                    "LICENSE_REVOKED" => Err(LicenseError::LicenseRevoked),
                    "RATE_LIMITED" => Err(LicenseError::RateLimited),
                    _ => Err(LicenseError::ServerError(error.message.clone())),
                };
            }
        }

        Ok(result)
    }

    /// Activate a license
    pub async fn activate(&self, request: ActivateRequest) -> Result<ActivateResponse, LicenseError> {
        let response = self
            .client
            .post(endpoints::activate())
            .json(&request)
            .send()
            .await
            .map_err(|e| LicenseError::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(LicenseError::RateLimited);
        }

        let result: ActivateResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

        if !result.success {
            if let Some(ref error) = result.error {
                return match error.code.as_str() {
                    "INVALID_LICENSE_KEY" => Err(LicenseError::InvalidKey),
                    "LICENSE_REVOKED" => Err(LicenseError::LicenseRevoked),
                    "DEVICE_LIMIT_REACHED" => {
                        // Try to extract device counts from error details
                        Err(LicenseError::DeviceLimitReached { used: 3, max: 3 })
                    }
                    "RATE_LIMITED" => Err(LicenseError::RateLimited),
                    _ => Err(LicenseError::ServerError(error.message.clone())),
                };
            }
        }

        Ok(result)
    }

    /// Deactivate a device
    pub async fn deactivate(&self, request: DeactivateRequest) -> Result<DeactivateResponse, LicenseError> {
        let response = self
            .client
            .post(endpoints::deactivate())
            .json(&request)
            .send()
            .await
            .map_err(|e| LicenseError::Network(e.to_string()))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(LicenseError::RateLimited);
        }

        let result: DeactivateResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

        if !result.success {
            if let Some(ref error) = result.error {
                return match error.code.as_str() {
                    "INVALID_LICENSE_KEY" => Err(LicenseError::InvalidKey),
                    "DEVICE_NOT_FOUND" => Err(LicenseError::ServerError("Device not found".to_string())),
                    _ => Err(LicenseError::ServerError(error.message.clone())),
                };
            }
        }

        Ok(result)
    }
}

impl Default for LicenseApiClient {
    fn default() -> Self {
        Self::new()
    }
}
