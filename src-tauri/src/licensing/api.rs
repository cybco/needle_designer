use crate::licensing::config::endpoints;
use crate::licensing::types::LicenseError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Request to initialize a trial
#[derive(Serialize)]
pub struct TrialInitRequest {
    pub device_id: String,
    pub platform: String,
    pub app_version: String,
}

/// Response from trial initialization
#[derive(Deserialize, Debug)]
pub struct TrialInitResponse {
    pub success: bool,
    pub trial_start: Option<DateTime<Utc>>,
    pub trial_expires: Option<DateTime<Utc>>,
    pub days_remaining: Option<i64>,
    pub error: Option<String>,
    pub error_code: Option<String>,
    pub signature: Option<String>,
}

/// Request to validate a license
#[derive(Serialize)]
pub struct ValidateRequest {
    pub license_key: Option<String>,
    pub device_id: String,
    pub platform: String,
    pub app_version: String,
}

/// Response from license validation
#[derive(Deserialize, Debug)]
pub struct ValidateResponse {
    pub valid: bool,
    pub status: String,
    pub updates_expire: Option<DateTime<Utc>>,
    pub devices_used: u32,
    pub devices_max: u32,
    pub error: Option<String>,
    pub error_code: Option<String>,
    pub signature: Option<String>,
}

/// Request to activate a license
#[derive(Serialize)]
pub struct ActivateRequest {
    pub license_key: String,
    pub device_id: String,
    pub device_name: Option<String>,
    pub platform: String,
    pub app_version: String,
}

/// Response from license activation
#[derive(Deserialize, Debug)]
pub struct ActivateResponse {
    pub success: bool,
    pub updates_expire: Option<DateTime<Utc>>,
    pub devices_used: u32,
    pub devices_max: u32,
    pub error: Option<String>,
    pub error_code: Option<String>,
    pub signature: Option<String>,
}

/// Request to deactivate a device
#[derive(Serialize)]
pub struct DeactivateRequest {
    pub license_key: Option<String>,
    pub device_id: String,
}

/// Response from device deactivation
#[derive(Deserialize, Debug)]
pub struct DeactivateResponse {
    pub success: bool,
    pub error: Option<String>,
}

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

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LicenseError::ServerError(format!(
                "HTTP {}: {}",
                status, text
            )));
        }

        let result: TrialInitResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

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

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LicenseError::ServerError(format!(
                "HTTP {}: {}",
                status, text
            )));
        }

        let result: ValidateResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

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

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LicenseError::ServerError(format!(
                "HTTP {}: {}",
                status, text
            )));
        }

        let result: ActivateResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

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

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(LicenseError::ServerError(format!(
                "HTTP {}: {}",
                status, text
            )));
        }

        let result: DeactivateResponse = response
            .json()
            .await
            .map_err(|e| LicenseError::Network(format!("Failed to parse response: {}", e)))?;

        Ok(result)
    }
}

impl Default for LicenseApiClient {
    fn default() -> Self {
        Self::new()
    }
}
