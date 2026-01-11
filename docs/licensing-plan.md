# NeedlePoint Designer - Complete Licensing System Plan

## Overview

A complete licensing system with three app platforms and a central license server, **integrated into the existing stitchalot.studio website**.

| Component | Technology | Distribution | Purpose |
|-----------|------------|--------------|---------|
| **Windows App** | Tauri + Rust + React | Direct download + Microsoft Store | Desktop pattern design |
| **macOS App** | Tauri + Rust + React | Direct download + Mac App Store | Desktop pattern design |
| **iPad App** | Tauri + Rust + React | Apple App Store | Tablet pattern design |
| **Website/API** | Next.js + TypeScript | Vercel (stitchalot.studio) | License server, admin, marketing, e-commerce |

### Pricing Strategy
- **Price**: $59.99 USD (same across all platforms)
- **App Store Commission**: Apple/Microsoft take 30% (~$18), net ~$42
- **Direct Purchase**: Full $59.99 minus Stripe fees (~3%), net ~$58
- **Strategy**: Uniform pricing for customer simplicity; accept lower margin on store purchases

### Features
- **30-day trial** with full features but watermarked PDF exports
- **Perpetual license** with 1-year update entitlement
- **Optional subscription** for continuous updates (future)
- **Up to 3 device activations** per license
- **Hybrid online/offline validation** with 30-day cache + 7-day grace period
- **Multi-store support**: Stripe (web), Apple IAP (iPad/Mac), Microsoft Store (Windows)
- **Cross-platform licenses**: Buy anywhere, use on any platform
- **Brevo emails** for license delivery

### Platform Status
- **Tauri iOS Support**: Verified production-ready for this project
- **Integration**: License server integrated into existing stitchalot.studio website

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Order Integration** | Always create Order record | Unified reporting and accounting across all purchase sources |
| **IAP Recovery** | Restore Purchases only | IAP customers use Apple/MS "Restore Purchases"; no email needed |
| **Subscription Support** | Schema ready, API deferred | Tables included now; implementation when business needs it |
| **Device ID Change** | Self-service deactivation | Users deactivate via app or web portal; no support tickets needed |
| **Key Rotation** | App update required | Accept risk since compromise is rare; updates are routine |
| **Trial Abuse** | Device ID + IP rate limiting | 5 trial inits/hour per IP; device ID uniqueness |
| **Order Creation** | License webhook creates Order | All purchases (Stripe, Apple, MS) create Order record for unified accounting |
| **Trial Conversion** | Link Trial to License | Update Trial.convertedToLicenseId on purchase; enables conversion analytics |
| **Key Display** | Masked with reveal button | Show STCH-****-****-****-XXXX by default; "Show Key" button to reveal |
| **Mac Distribution** | Both MAS + Direct | Release on Mac App Store AND direct download; two builds |
| **Public Key Storage** | Rust constant | Embed Ed25519 public key in config.rs; compiled into binary |

---

# PART 1: DESKTOP & TABLET APPS (Tauri + Rust + React)

## Supported Platforms

| Platform | Distribution | Payment Method | Device ID Strategy |
|----------|--------------|----------------|-------------------|
| Windows | Direct download | Stripe (website) | `machineid-rs` (hardware UUID) |
| Windows | Microsoft Store | MS Store IAP | MS Store user ID |
| macOS | Direct download | Stripe (website) | `machineid-rs` (IOPlatformUUID) |
| macOS | Mac App Store | Apple IAP | Keychain-stored UUID |
| iPad/iOS | Apple App Store | Apple IAP | `identifierForVendor` |

## App Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NeedlePoint Designer (Tauri)                 │
│                    Windows / macOS / iPad                       │
│                                                                 │
│  ┌──────────────────┐     ┌─────────────────────────────────┐  │
│  │   App Startup    │────►│  LicenseGate Component          │  │
│  │   (main.tsx)     │     │  (Blocks app if not licensed)   │  │
│  └──────────────────┘     └───────────────┬─────────────────┘  │
│                                           │                     │
│  ┌──────────────────┐     ┌───────────────▼─────────────────┐  │
│  │  License Store   │◄───►│  License Manager (Rust)         │  │
│  │  (Zustand)       │     │  - Validation logic             │  │
│  └──────────────────┘     │  - API communication            │  │
│                           │  - IAP verification (iOS/MS)    │  │
│  ┌──────────────────┐     │  - Offline caching              │  │
│  │  TrialBanner     │     └───────────────┬─────────────────┘  │
│  │  Component       │                     │                     │
│  └──────────────────┘     ┌───────────────▼─────────────────┐  │
│                           │  Stronghold (Encrypted Storage) │  │
│  ┌──────────────────┐     │  - License key / receipt        │  │
│  │  PDF Export      │     │  - Device ID                     │  │
│  │  (+ Watermark)   │     │  - Cached validation             │  │
│  └──────────────────┘     │  - Trial start date              │  │
│                           └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API Calls
                              ▼
                    ┌─────────────────────┐
                    │  stitchalot.studio  │
                    │  (License Server)   │
                    └─────────────────────┘
```

---

## App: Dependencies

### `src-tauri/Cargo.toml`

```toml
[dependencies]
# Encrypted local storage
tauri-plugin-stronghold = "2"

# Device fingerprinting (desktop)
machineid-rs = "1"

# HTTP client for license server
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }

# Date/time handling
chrono = { version = "0.4", features = ["serde"] }

# Signature verification (verify server responses)
ed25519-dalek = "2"

# Base64 encoding for signatures
base64 = "0.22"

# iOS-specific (conditionally compiled)
[target.'cfg(target_os = "ios")'.dependencies]
# StoreKit bindings via Tauri plugin or swift bridge
```

---

## App: Platform-Specific Device ID

### `src-tauri/src/licensing/device.rs`

```rust
use std::error::Error;

/// Platform-specific device ID generation
pub fn get_device_id() -> Result<String, Box<dyn Error>> {
    #[cfg(target_os = "windows")]
    {
        // Windows: Use machine GUID from registry
        let id = machineid_rs::IdBuilder::new(machineid_rs::Encryption::SHA256)
            .add_component(machineid_rs::HWIDComponent::SystemID)
            .build("needlepoint")?;
        Ok(id)
    }

    #[cfg(target_os = "macos")]
    {
        // Check if running as Mac App Store app
        if is_mac_app_store() {
            // Use Keychain-stored UUID (persists across reinstalls, sandboxed)
            get_or_create_keychain_device_id()
        } else {
            // Direct download: Use IOPlatformUUID
            let id = machineid_rs::IdBuilder::new(machineid_rs::Encryption::SHA256)
                .add_component(machineid_rs::HWIDComponent::SystemID)
                .build("needlepoint")?;
            Ok(id)
        }
    }

    #[cfg(target_os = "ios")]
    {
        // iOS/iPadOS: Use identifierForVendor (persists across app reinstalls)
        // This requires calling into Swift/ObjC via Tauri's mobile plugin system
        get_ios_vendor_id()
    }
}

/// Check if running as Mac App Store app (sandboxed)
#[cfg(target_os = "macos")]
fn is_mac_app_store() -> bool {
    // Check for App Store receipt or sandbox entitlement
    std::path::Path::new("../Library/Receipts/receipt").exists()
        || std::env::var("APP_SANDBOX_CONTAINER_ID").is_ok()
}

/// Get or create a persistent device ID stored in Keychain (Mac App Store)
#[cfg(target_os = "macos")]
fn get_or_create_keychain_device_id() -> Result<String, Box<dyn Error>> {
    use security_framework::passwords::{get_generic_password, set_generic_password};

    let service = "com.stitchalot.needlepoint";
    let account = "device_id";

    // Try to retrieve existing ID
    if let Ok(password) = get_generic_password(service, account) {
        return Ok(String::from_utf8(password)?);
    }

    // Generate new UUID and store it
    let device_id = uuid::Uuid::new_v4().to_string();
    set_generic_password(service, account, device_id.as_bytes())?;
    Ok(device_id)
}

/// For Microsoft Store users, use their MS account ID instead
pub fn get_ms_store_user_id() -> Result<Option<String>, Box<dyn Error>> {
    #[cfg(target_os = "windows")]
    {
        // Check if running as MS Store app and get user ID
        // Returns None if not a Store app
        Ok(None) // Implement via Windows.Services.Store API
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}
```

---

## App: New Files to Create

### Rust Backend

| File | Purpose |
|------|---------|
| `src-tauri/src/licensing/mod.rs` | Module entry point, exports |
| `src-tauri/src/licensing/types.rs` | License data structures |
| `src-tauri/src/licensing/config.rs` | Constants (URLs, keys, timeouts) |
| `src-tauri/src/licensing/manager.rs` | Core license validation logic |
| `src-tauri/src/licensing/storage.rs` | Stronghold read/write operations |
| `src-tauri/src/licensing/device.rs` | Platform-specific device ID |
| `src-tauri/src/licensing/api.rs` | License server HTTP client |
| `src-tauri/src/licensing/signature.rs` | Ed25519 signature verification |
| `src-tauri/src/licensing/iap.rs` | In-app purchase handling (iOS/MS Store) |
| `src-tauri/src/licensing/updates.rs` | Version checking logic |

### React Frontend

| File | Purpose |
|------|---------|
| `src/stores/licenseStore.ts` | Zustand store for license state |
| `src/components/LicenseGate.tsx` | Startup gate (blocks app if unlicensed) |
| `src/components/ActivationDialog.tsx` | License key entry form |
| `src/components/TrialBanner.tsx` | Trial countdown banner |
| `src/components/LicenseExpiredDialog.tsx` | Trial/license expired modal |
| `src/components/PurchaseOptions.tsx` | Shows IAP or web purchase options |
| `src/components/UpdateAvailableDialog.tsx` | Notifies of available updates |
| `src/components/LicenseRecoveryDialog.tsx` | Recover license by email |

---

## App: Rust Data Structures

### `src-tauri/src/licensing/types.rs`

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum LicenseStatus {
    None,                    // No license, no trial started
    Trial,                   // In active trial period
    TrialExpired,            // Trial has expired
    Licensed,                // Valid perpetual license
    LicensedUpdatesExpired,  // Licensed but updates expired (still functional)
    Invalid,                 // License revoked or invalid
    GracePeriod,             // Offline too long, needs validation
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum LicenseSource {
    LicenseKey,      // Activated via STCH-XXXX key (web purchase)
    AppleIap,        // Purchased via Apple App Store
    MicrosoftStore,  // Purchased via Microsoft Store
}

#[derive(Serialize, Deserialize, Clone, Debug)]
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
```

---

## App: TypeScript Types

### `src/types/license.ts`

```typescript
export type LicenseStatus =
  | 'none'
  | 'trial'
  | 'trial_expired'
  | 'licensed'
  | 'licensed_updates_expired'
  | 'invalid'
  | 'grace_period';

export type LicenseSource = 'license_key' | 'apple_iap' | 'microsoft_store';

export interface LicenseState {
  status: LicenseStatus;
  source: LicenseSource | null;
  licenseKey: string | null;
  trialDaysRemaining: number | null;
  updatesExpire: Date | null;
  devicesUsed: number;
  devicesMax: number;
  needsOnlineValidation: boolean;
  platform: 'windows' | 'macos' | 'ios';
}

export interface ActivationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  devicesUsed?: number;
  devicesMax?: number;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  updateAllowed: boolean;
  downloadUrl?: string;
  releaseNotes?: string;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  emailSent?: boolean;
}

// Helper for masked key display
export function maskLicenseKey(key: string): string {
  // STCH-ABCD-EFGH-IJKL-MNOP → STCH-****-****-****-MNOP
  const parts = key.split('-');
  if (parts.length !== 5) return key;
  return `${parts[0]}-****-****-****-${parts[4]}`;
}
```

---

## App: Tauri Commands

Add to `src-tauri/src/lib.rs`:

```rust
mod licensing;

.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    // License management
    licensing::commands::init_license,
    licensing::commands::get_license_status,
    licensing::commands::start_trial,
    licensing::commands::activate_license,
    licensing::commands::deactivate_device,
    licensing::commands::validate_license,
    // IAP (iOS/MS Store)
    licensing::commands::purchase_iap,
    licensing::commands::restore_purchases,
    licensing::commands::verify_iap_receipt,
    // Recovery & Updates
    licensing::commands::recover_license,
    licensing::commands::check_for_updates,
    licensing::commands::get_platform_info,
])
```

| Command | Parameters | Returns | Purpose |
|---------|------------|---------|---------|
| `init_license` | none | `LicenseState` | Called on app startup |
| `get_license_status` | none | `LicenseState` | Get current state |
| `start_trial` | none | `Result<LicenseState>` | Initialize 30-day trial |
| `activate_license` | `key: String` | `Result<ActivationResult>` | Activate license key |
| `deactivate_device` | none | `Result<()>` | Remove this device |
| `validate_license` | `force: bool` | `Result<LicenseState>` | Validate license |
| `purchase_iap` | `product_id: String` | `Result<IapResult>` | Initiate IAP (iOS/MS) |
| `restore_purchases` | none | `Result<LicenseState>` | Restore IAP purchases |
| `verify_iap_receipt` | `receipt: String` | `Result<LicenseState>` | Verify IAP receipt |
| `recover_license` | `email: String` | `Result<RecoveryResult>` | Request license recovery email |
| `check_for_updates` | none | `Result<UpdateInfo>` | Check for app updates |
| `get_platform_info` | none | `PlatformInfo` | Get platform/device info |

---

## App: Startup Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP LAUNCH                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  invoke('init_      │
                    │  license')          │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ status:     │     │ status:     │     │ status:     │
   │ 'none'      │     │ 'trial'     │     │ 'licensed'  │
   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
          │                   │                   │
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ Show        │     │ days > 0?   │     │ Validate    │
   │ Activation  │     │             │     │ (cached OK) │
   │ Dialog      │     └──────┬──────┘     └──────┬──────┘
   │ (+ IAP opt) │            │                   │
   └─────────────┘   ┌────────┴────────┐          │
                     ▼                 ▼          ▼
              ┌───────────┐    ┌───────────┐  ┌───────────┐
              │ Show      │    │ Show      │  │ Check for │
              │ Trial     │    │ Expired   │  │ Updates   │
              │ Banner    │    │ Dialog    │  └─────┬─────┘
              └─────┬─────┘    └───────────┘        │
                    ▼                               ▼
              ┌───────────┐                   ┌───────────┐
              │ Continue  │                   │ Continue  │
              │ to App    │                   │ to App    │
              └───────────┘                   └───────────┘
```

---

## App: In-App Purchase Flow (iOS / MS Store)

### iOS (Apple StoreKit)

```rust
// src-tauri/src/licensing/iap.rs

#[cfg(target_os = "ios")]
pub async fn purchase_product(product_id: &str) -> Result<IapReceipt, IapError> {
    // 1. Get product info from StoreKit
    // 2. Present purchase sheet
    // 3. Wait for transaction completion
    // 4. Get receipt data
    // 5. Send to server for verification
    Ok(receipt)
}

#[cfg(target_os = "ios")]
pub async fn restore_purchases() -> Result<Vec<IapReceipt>, IapError> {
    // 1. Call StoreKit's restoreCompletedTransactions
    // 2. Collect all valid receipts
    // 3. Verify each with server
    Ok(receipts)
}
```

### Microsoft Store

```rust
#[cfg(target_os = "windows")]
pub async fn purchase_ms_store(product_id: &str) -> Result<MsStoreReceipt, MsStoreError> {
    // 1. Use Windows.Services.Store API
    // 2. Request purchase
    // 3. Get receipt/license info
    // 4. Verify with server
    Ok(receipt)
}
```

---

## App: Files to Modify

| File | Changes |
|------|---------|
| `src-tauri/Cargo.toml` | Add dependencies |
| `src-tauri/src/lib.rs` | Add `mod licensing;` and commands |
| `src-tauri/tauri.conf.json` | Add stronghold plugin, iOS capabilities |
| `src-tauri/capabilities/default.json` | Add permissions |
| `src/App.tsx` | Wrap with `<LicenseGate>` |
| `src/utils/pdfExport.ts` | Add trial watermark |

---

## App: PDF Watermark

```typescript
// src/utils/pdfExport.ts
export async function exportToPdf(
  pattern: Pattern,
  options: ExportOptions,
  licenseStatus: LicenseStatus
): Promise<void> {
  // ... existing code ...

  if (licenseStatus === 'trial') {
    addTrialWatermark(pdf, pageWidth, pageHeight);
  }
}

function addTrialWatermark(pdf: jsPDF, pageWidth: number, pageHeight: number): void {
  const pageCount = pdf.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.saveGraphicsState();
    pdf.setGState(new pdf.GState({ opacity: 0.3 }));
    pdf.setFontSize(60);
    pdf.setTextColor(128, 128, 128);
    pdf.text('TRIAL VERSION - stitchalot.studio', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    pdf.restoreGraphicsState();
  }
}
```

---

## App: Offline Handling

### Cache Rules
1. **Cache TTL**: 30 days from last successful online validation
2. **Grace Period**: 7 additional days after cache expires (with warning)
3. **Hard Block**: After grace period, require online validation

### Same Device, Different Distribution
A user might install both direct download AND Mac App Store versions on the same Mac. The device ID strategies differ:
- **Direct download**: `machineid-rs` (IOPlatformUUID)
- **Mac App Store**: Keychain-stored UUID (sandboxed)

**Behavior**: These count as **two different devices** since they have different device IDs. This is intentional:
- Prevents App Store sandbox bypass
- Each installation is isolated
- User must use same license key in both, consuming 2 device slots

If this causes customer complaints, admin can manually increase `maxDevices` for that license.

### Validation Flow

```rust
pub fn validate_cached(state: &LicenseState) -> ValidationResult {
    let Some(cached) = &state.cached_validation else {
        return ValidationResult::NeedsOnline;
    };

    if !verify_signature(cached) {
        return ValidationResult::Invalid("Signature verification failed");
    }

    let days_since_validation = (Utc::now() - cached.cached_at).num_days();

    if days_since_validation <= 30 {
        ValidationResult::Valid
    } else if days_since_validation <= 37 {
        ValidationResult::GracePeriod(37 - days_since_validation)
    } else {
        ValidationResult::NeedsOnline
    }
}
```

---

## App: Configuration

### `src-tauri/capabilities/default.json`

```json
{
  "permissions": [
    "stronghold:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://stitchalot.studio/*" }
      ]
    }
  ]
}
```

### `src-tauri/src/licensing/config.rs`

```rust
#[cfg(debug_assertions)]
pub const LICENSE_SERVER_URL: &str = "http://localhost:3000";

#[cfg(not(debug_assertions))]
pub const LICENSE_SERVER_URL: &str = "https://stitchalot.studio";

pub const TRIAL_DAYS: i64 = 30;
pub const CACHE_TTL_DAYS: i64 = 30;
pub const GRACE_PERIOD_DAYS: i64 = 7;

// App Store product IDs
pub const APPLE_PRODUCT_ID: &str = "com.stitchalot.needlepoint.license";
pub const MS_STORE_PRODUCT_ID: &str = "NeedlePointDesignerLicense";

// Ed25519 public key for signature verification (base64 encoded)
// Generate keypair on server, embed public key here
// IMPORTANT: Update this when rotating keys (requires app update)
pub const LICENSE_SERVER_PUBLIC_KEY: &str = "BASE64_ENCODED_32_BYTE_PUBLIC_KEY_HERE";
```

### Signature Verification (Rust)

```rust
// src-tauri/src/licensing/signature.rs
use ed25519_dalek::{Signature, VerifyingKey};
use base64::{Engine as _, engine::general_purpose::STANDARD};

pub fn verify_response_signature(data: &str, signature_b64: &str) -> bool {
    let public_key_bytes = match STANDARD.decode(super::config::LICENSE_SERVER_PUBLIC_KEY) {
        Ok(bytes) => bytes,
        Err(_) => return false,
    };

    let verifying_key = match VerifyingKey::try_from(public_key_bytes.as_slice()) {
        Ok(key) => key,
        Err(_) => return false,
    };

    let signature_bytes = match STANDARD.decode(signature_b64) {
        Ok(bytes) => bytes,
        Err(_) => return false,
    };

    let signature = match Signature::try_from(signature_bytes.as_slice()) {
        Ok(sig) => sig,
        Err(_) => return false,
    };

    verifying_key.verify_strict(data.as_bytes(), &signature).is_ok()
}
```

---

# PART 2: WEBSITE & LICENSE SERVER (Integrated into Existing Site)

**Domain:** `https://stitchalot.studio`
**Hosting:** Vercel
**Stack:** Next.js 15 + TypeScript + Prisma + Neon PostgreSQL (existing)

## Integration Strategy

The license server will be **integrated into the existing stitchalot.studio website**, not a separate project. This provides:

- **Unified admin dashboard** - License management alongside existing product/order management
- **Shared authentication** - Use existing NextAuth setup for admin access
- **Linked data models** - Connect `License` to existing `User` and `Order` models
- **Single deployment** - One Vercel project, one database
- **Consistent branding** - Same UI components and styling

### Files to Add to Existing Project

```
app/
├── (root)/
│   ├── download/page.tsx           # NEW: Download links per platform
│   ├── recover/page.tsx            # NEW: License recovery form
│   ├── releases/page.tsx           # NEW: Release notes/changelog
│   └── purchase/
│       └── software/
│           ├── page.tsx            # NEW: Software purchase (Stripe)
│           └── success/page.tsx    # NEW: Post-purchase license display
│
├── admin/
│   ├── licenses/                   # NEW: License management
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── new/page.tsx
│   ├── trials/page.tsx             # NEW: Trial tracking
│   ├── software-analytics/page.tsx # NEW: License analytics dashboard
│   └── app-versions/page.tsx       # NEW: Manage app releases
│
└── api/
    ├── v1/                         # NEW: License API (versioned)
    │   ├── trial/init/route.ts
    │   ├── activate/route.ts
    │   ├── validate/route.ts
    │   ├── deactivate/route.ts
    │   ├── recover/route.ts
    │   ├── check-updates/route.ts
    │   └── iap/
    │       ├── apple/route.ts
    │       └── microsoft/route.ts
    │
    └── webhooks/
        ├── stripe/route.ts         # MODIFY: Add license creation
        ├── apple/route.ts          # NEW: App Store Server Notifications
        └── microsoft/route.ts      # NEW: MS Store notifications

lib/
├── license-keys.ts                 # NEW
├── signing.ts                      # NEW
├── rate-limit.ts                   # NEW (or extend existing)
├── apple-iap.ts                    # NEW
├── microsoft-store.ts              # NEW
└── license-analytics.ts            # NEW

components/
└── admin/
    ├── license-table.tsx           # NEW
    ├── license-detail.tsx          # NEW
    ├── trial-table.tsx             # NEW
    └── license-analytics-charts.tsx # NEW
```

## Web Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VERCEL (stitchalot.studio)                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Next.js Application                          │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ Public Pages │  │ Admin Pages  │  │ API Routes               │  │   │
│  │  │ /, /pricing  │  │ /admin/*     │  │ /api/v1/trial/init       │  │   │
│  │  │ /download    │  │ Dashboard    │  │ /api/v1/activate         │  │   │
│  │  │ /features    │  │ Licenses     │  │ /api/v1/validate         │  │   │
│  │  │ /purchase    │  │ Trials       │  │ /api/v1/deactivate       │  │   │
│  │  └──────────────┘  └──────────────┘  │ /api/v1/recover          │  │   │
│  │                                      │ /api/v1/check-updates    │  │   │
│  │                                      │ /api/v1/iap/apple        │  │   │
│  │                                      │ /api/v1/iap/microsoft    │  │   │
│  │                                      │ /api/webhooks/stripe     │  │   │
│  │                                      │ /api/webhooks/apple      │  │   │
│  │                                      └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                              ┌────────┴────────┐                            │
│                              │     Prisma      │                            │
│                              └────────┬────────┘                            │
└───────────────────────────────────────┼─────────────────────────────────────┘
                                        │
                               ┌────────┴────────┐
                               │ Neon PostgreSQL │
                               └─────────────────┘
```

---

## Web: URL Structure

| URL | Purpose |
|-----|---------|
| `https://stitchalot.studio` | Landing page |
| `https://stitchalot.studio/features` | Feature list |
| `https://stitchalot.studio/pricing` | Pricing info |
| `https://stitchalot.studio/download` | Download links (per platform) |
| `https://stitchalot.studio/purchase` | Stripe Checkout redirect |
| `https://stitchalot.studio/purchase/success` | Post-purchase license display |
| `https://stitchalot.studio/recover` | License recovery page |
| `https://stitchalot.studio/account/licenses` | Customer portal: view licenses & devices |
| `https://stitchalot.studio/account/licenses/[id]` | Customer portal: manage specific license |
| `https://stitchalot.studio/admin` | Admin dashboard |
| `https://stitchalot.studio/api/v1/*` | License API |

---

## Web: Project Structure

```
stitchalot-studio/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Landing page
│   ├── features/page.tsx
│   ├── pricing/page.tsx
│   ├── download/page.tsx
│   ├── support/page.tsx
│   ├── releases/page.tsx
│   ├── recover/page.tsx          # License recovery form
│   │
│   ├── purchase/
│   │   ├── page.tsx              # Stripe redirect
│   │   └── success/page.tsx      # Shows license key
│   │
│   ├── account/                  # Customer self-service portal
│   │   ├── layout.tsx            # Requires user auth
│   │   └── licenses/
│   │       ├── page.tsx          # List user's licenses
│   │       └── [id]/
│   │           └── page.tsx      # Manage devices, deactivate remotely
│   │
│   ├── admin/
│   │   ├── layout.tsx            # Admin auth wrapper
│   │   ├── page.tsx              # Dashboard
│   │   ├── licenses/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── trials/page.tsx
│   │   ├── analytics/page.tsx    # License analytics
│   │   └── settings/page.tsx
│   │
│   └── api/
│       ├── v1/
│       │   ├── trial/init/route.ts
│       │   ├── activate/route.ts
│       │   ├── validate/route.ts
│       │   ├── deactivate/route.ts
│       │   ├── recover/route.ts          # License recovery
│       │   ├── check-updates/route.ts    # Version checking
│       │   └── iap/
│       │       ├── apple/route.ts        # Apple receipt verification
│       │       └── microsoft/route.ts    # MS Store verification
│       │
│       ├── admin/
│       │   ├── auth/route.ts
│       │   ├── licenses/route.ts
│       │   └── analytics/route.ts
│       │
│       └── webhooks/
│           ├── stripe/route.ts
│           └── apple/route.ts            # App Store Server Notifications
│
├── lib/
│   ├── db.ts                     # Prisma client
│   ├── license-keys.ts           # Key generation
│   ├── signing.ts                # Ed25519 signing
│   ├── rate-limit.ts             # Upstash rate limiting
│   ├── auth.ts                   # Admin auth
│   ├── email.ts                  # Brevo email
│   ├── errors.ts                 # Standardized error responses
│   ├── apple-iap.ts              # Apple receipt verification
│   ├── microsoft-store.ts        # MS Store verification
│   └── analytics.ts              # Event logging
│
├── components/
│   ├── ui/
│   ├── admin/
│   └── marketing/
│
└── types/
    └── license.ts
```

---

## Web: Additional Dependencies

Add these to the existing `package.json`:

```json
{
  "dependencies": {
    // Existing dependencies remain unchanged...

    // License system additions:
    "@upstash/ratelimit": "^1.0.0",      // Rate limiting
    "@upstash/redis": "^1.28.0",          // Redis for rate limiting
    "@noble/ed25519": "^2.0.0",           // Response signing
    "app-store-server-api": "^1.0.0",     // Apple IAP verification
    "@azure/msal-node": "^2.6.0"          // Microsoft Store auth
  }
}
```

Note: The existing site already has: Next.js 15, React 19, Prisma, Stripe, NextAuth, Brevo (@getbrevo/brevo), Zod, Tailwind CSS, etc.

---

## Web: Database Schema (Prisma)

Add these models to the existing `prisma/schema.prisma` file:

```prisma
// ===========================================
// LICENSE SYSTEM MODELS (Add to existing schema)
// ===========================================

model License {
  id              String   @id @default(cuid())
  licenseKey      String   @unique @map("license_key")  // STCH-XXXX-XXXX-XXXX-XXXX
  email           String
  customerName    String?  @map("customer_name")
  purchaseDate    DateTime @default(now()) @map("purchase_date")
  updatesExpire   DateTime @map("updates_expire")
  maxDevices      Int      @default(3) @map("max_devices")
  isRevoked       Boolean  @default(false) @map("is_revoked")
  revokeReason    String?  @map("revoke_reason")

  // Link to existing site models
  userId          String?  @map("user_id")
  orderId         String?  @map("order_id")
  user            User?    @relation(fields: [userId], references: [id])
  // Note: Order relation requires adding `licenses License[]` to Order model

  // License type (perpetual vs subscription)
  licenseType     LicenseType @default(PERPETUAL) @map("license_type")

  // Payment source tracking
  source          LicenseSource @default(STRIPE)
  paymentId       String?  @map("payment_id")       // Stripe payment_intent, Apple transaction_id, etc.

  // Refund tracking
  isRefunded      Boolean  @default(false) @map("is_refunded")
  refundedAt      DateTime? @map("refunded_at")
  refundReason    String?  @map("refund_reason")

  notes           String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  devices              DeviceActivation[]
  subscription         Subscription?
  appleTransactions    AppleTransaction[]
  microsoftTransactions MicrosoftTransaction[]

  @@index([email])
  @@index([userId])
  @@map("licenses")
}

enum LicenseType {
  PERPETUAL        // One-time purchase, 1-year updates
  SUBSCRIPTION     // Recurring payment, continuous updates
}

enum LicenseSource {
  STRIPE           // Web purchase via Stripe
  APPLE_IAP        // Apple App Store In-App Purchase (iPad/Mac)
  MICROSOFT_STORE  // Microsoft Store
  MANUAL           // Admin-created
}

// ===========================================
// SUBSCRIPTION SUPPORT (Future-ready)
// ===========================================

model Subscription {
  id                  String   @id @default(cuid())
  licenseId           String   @unique @map("license_id")
  license             License  @relation(fields: [licenseId], references: [id], onDelete: Cascade)

  // Subscription status
  status              SubscriptionStatus @default(ACTIVE)
  currentPeriodStart  DateTime @map("current_period_start")
  currentPeriodEnd    DateTime @map("current_period_end")
  canceledAt          DateTime? @map("canceled_at")
  cancelReason        String?  @map("cancel_reason")

  // Payment provider subscription IDs
  stripeSubscriptionId     String? @unique @map("stripe_subscription_id")
  appleOriginalTxId        String? @unique @map("apple_original_tx_id")
  microsoftSubscriptionId  String? @unique @map("microsoft_subscription_id")

  // Billing
  pricePerPeriod      Decimal  @map("price_per_period") @db.Decimal(10, 2)
  billingInterval     BillingInterval @default(YEARLY) @map("billing_interval")
  currency            String   @default("USD")

  // Grace period for failed payments
  gracePeriodEnd      DateTime? @map("grace_period_end")

  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  renewalHistory      SubscriptionRenewal[]

  @@map("subscriptions")
}

enum SubscriptionStatus {
  ACTIVE             // Currently paid and valid
  PAST_DUE           // Payment failed, in grace period
  CANCELED           // User canceled, still active until period end
  EXPIRED            // Subscription ended
  PAUSED             // Temporarily paused (if supported)
}

enum BillingInterval {
  MONTHLY
  YEARLY
}

model SubscriptionRenewal {
  id              String   @id @default(cuid())
  subscriptionId  String   @map("subscription_id")
  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  periodStart     DateTime @map("period_start")
  periodEnd       DateTime @map("period_end")
  amount          Decimal  @db.Decimal(10, 2)
  currency        String   @default("USD")
  status          String   // "succeeded", "failed", "refunded"
  paymentId       String?  @map("payment_id")
  failureReason   String?  @map("failure_reason")

  createdAt       DateTime @default(now()) @map("created_at")

  @@index([subscriptionId, createdAt])
  @@map("subscription_renewals")
}

model DeviceActivation {
  id              String   @id @default(cuid())
  licenseId       String   @map("license_id")
  deviceId        String   @map("device_id")
  deviceName      String?  @map("device_name")
  platform        String?  // "windows", "macos", "ios"
  appVersion      String?  @map("app_version")
  firstActivated  DateTime @default(now()) @map("first_activated")
  lastValidated   DateTime @default(now()) @map("last_validated")
  isActive        Boolean  @default(true) @map("is_active")
  deactivatedAt   DateTime? @map("deactivated_at")

  license         License  @relation(fields: [licenseId], references: [id], onDelete: Cascade)

  @@unique([licenseId, deviceId])
  @@index([deviceId])
  @@map("device_activations")
}

model Trial {
  id                    String   @id @default(cuid())
  deviceId              String   @unique @map("device_id")
  startedAt             DateTime @default(now()) @map("started_at")
  expiresAt             DateTime @map("expires_at")
  convertedToLicenseId  String?  @map("converted_to_license_id")
  ipAddress             String?  @map("ip_address")
  appVersion            String?  @map("app_version")
  platform              String?

  @@map("trials")
}

model AdminUser {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String   @map("password_hash")
  name          String?
  role          String   @default("admin")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  lastLogin     DateTime? @map("last_login")

  @@map("admin_users")
}

// Analytics & Audit
model AnalyticsEvent {
  id          String   @id @default(cuid())
  eventType   String   @map("event_type")  // See EventTypes below
  result      String   // "success", "failure", "error"
  licenseId   String?  @map("license_id")
  deviceId    String?  @map("device_id")
  platform    String?
  appVersion  String?  @map("app_version")
  ipAddress   String?  @map("ip_address")
  country     String?  // Derived from IP
  errorCode   String?  @map("error_code")
  details     Json?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([eventType, createdAt])
  @@index([licenseId])
  @@map("analytics_events")
}

// App version tracking for updates
model AppVersion {
  id            String   @id @default(cuid())
  version       String   @unique  // "1.2.0"
  platform      String   // "windows", "macos", "ios"
  releaseDate   DateTime @map("release_date")
  downloadUrl   String?  @map("download_url")
  releaseNotes  String?  @map("release_notes")
  minOsVersion  String?  @map("min_os_version")
  isLatest      Boolean  @default(false) @map("is_latest")
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([version, platform])
  @@map("app_versions")
}

// Apple IAP transaction tracking
model AppleTransaction {
  id                      String   @id @default(cuid())
  transactionId           String   @unique @map("transaction_id")
  originalTransactionId   String   @map("original_transaction_id")
  productId               String   @map("product_id")
  purchaseDate            DateTime @map("purchase_date")
  licenseId               String?  @map("license_id")
  license                 License? @relation(fields: [licenseId], references: [id])
  environment             String   // "Production" or "Sandbox"
  status                  String   // "active", "refunded", "revoked"
  rawReceipt              String?  @map("raw_receipt")
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  @@index([originalTransactionId])
  @@map("apple_transactions")
}

// Microsoft Store transaction tracking
model MicrosoftTransaction {
  id                String   @id @default(cuid())
  userStoreId       String   @map("user_store_id")
  productId         String   @map("product_id")
  acquisitionType   String   @map("acquisition_type")  // "Purchase", "Trial"
  purchaseDate      DateTime @map("purchase_date")
  licenseId         String?  @map("license_id")
  license           License? @relation(fields: [licenseId], references: [id])
  status            String   // "active", "refunded", "revoked"
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@unique([userStoreId, productId])
  @@map("microsoft_transactions")
}
```

### Event Types for Analytics

```typescript
// lib/analytics.ts
export const EventTypes = {
  // Trial events
  TRIAL_STARTED: 'trial.started',
  TRIAL_EXPIRED: 'trial.expired',
  TRIAL_CONVERTED: 'trial.converted',

  // License events
  LICENSE_ACTIVATED: 'license.activated',
  LICENSE_VALIDATED: 'license.validated',
  LICENSE_DEACTIVATED: 'license.deactivated',
  LICENSE_REVOKED: 'license.revoked',
  LICENSE_RECOVERED: 'license.recovered',

  // Purchase events
  PURCHASE_STRIPE: 'purchase.stripe',
  PURCHASE_APPLE: 'purchase.apple',
  PURCHASE_MICROSOFT: 'purchase.microsoft',
  REFUND_PROCESSED: 'refund.processed',

  // Error events
  ACTIVATION_FAILED: 'activation.failed',
  VALIDATION_FAILED: 'validation.failed',
  IAP_VERIFICATION_FAILED: 'iap.verification_failed',

  // Update events
  UPDATE_CHECK: 'update.check',
} as const;
```

---

## Web: Standardized Error Responses

### `lib/errors.ts`

```typescript
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
  signature?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Error codes
export const ErrorCodes = {
  // Validation errors (400)
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_LICENSE_KEY: 'INVALID_LICENSE_KEY',
  INVALID_DEVICE_ID: 'INVALID_DEVICE_ID',
  INVALID_RECEIPT: 'INVALID_RECEIPT',

  // Authorization errors (401/403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  LICENSE_REVOKED: 'LICENSE_REVOKED',
  LICENSE_REFUNDED: 'LICENSE_REFUNDED',
  DEVICE_NOT_ACTIVATED: 'DEVICE_NOT_ACTIVATED',

  // Limit errors (403)
  DEVICE_LIMIT_REACHED: 'DEVICE_LIMIT_REACHED',
  TRIAL_ALREADY_USED: 'TRIAL_ALREADY_USED',

  // Not found (404)
  LICENSE_NOT_FOUND: 'LICENSE_NOT_FOUND',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',

  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  IAP_VERIFICATION_ERROR: 'IAP_VERIFICATION_ERROR',
} as const;

export function errorResponse(
  code: keyof typeof ErrorCodes,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return {
    success: false,
    error: {
      code: ErrorCodes[code],
      message,
      details,
    },
  };
}

export function successResponse<T>(data: T, signature?: string): ApiSuccess<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    signature,
  };
}
```

---

## Web: Rate Limiting

### `lib/rate-limit.ts`

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Rate limits by endpoint
export const rateLimits = {
  // Trial init: 5 per hour per IP (prevent abuse)
  trialInit: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:trial',
  }),

  // Activation: 10 per hour per license key
  activate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:activate',
  }),

  // Validation: 60 per hour per device (normal app usage)
  validate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 h'),
    prefix: 'rl:validate',
  }),

  // Recovery: 3 per hour per email (prevent spam)
  recover: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'rl:recover',
  }),

  // IAP verification: 20 per hour per device
  iapVerify: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:iap',
  }),
};
```

### Rate Limit Documentation

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/v1/trial/init` | 5 requests | 1 hour | IP address |
| `POST /api/v1/activate` | 10 requests | 1 hour | License key |
| `POST /api/v1/validate` | 60 requests | 1 hour | Device ID |
| `POST /api/v1/recover` | 3 requests | 1 hour | Email |
| `POST /api/v1/iap/*` | 20 requests | 1 hour | Device ID |

---

## Web: API Endpoints

### POST `/api/v1/trial/init`

**Request:**
```json
{
  "device_id": "hashed_device_fingerprint",
  "app_version": "1.2.0",
  "platform": "windows"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "expires_at": "2026-02-09T12:00:00Z",
    "days_remaining": 30
  },
  "timestamp": "2026-01-10T12:00:00Z",
  "signature": "base64_ed25519_signature"
}
```

**Response (Error - Already Used):**
```json
{
  "success": false,
  "error": {
    "code": "TRIAL_ALREADY_USED",
    "message": "A trial has already been started on this device"
  }
}
```

### POST `/api/v1/activate`

**Request:**
```json
{
  "license_key": "STCH-ABCD-EFGH-IJKL-MNOP",
  "device_id": "hashed_device_fingerprint",
  "device_name": "DESKTOP-ABC123",
  "platform": "windows",
  "app_version": "1.2.0"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "devices_used": 1,
    "devices_max": 3,
    "updates_expire": "2027-01-10T12:00:00Z"
  },
  "timestamp": "2026-01-10T12:00:00Z",
  "signature": "base64_ed25519_signature"
}
```

**Response (Error - Device Limit):**
```json
{
  "success": false,
  "error": {
    "code": "DEVICE_LIMIT_REACHED",
    "message": "Maximum device limit (3) reached. Deactivate a device first.",
    "details": {
      "devices_used": 3,
      "devices_max": 3
    }
  }
}
```

### POST `/api/v1/validate`

**Request:**
```json
{
  "license_key": "STCH-ABCD-EFGH-IJKL-MNOP",
  "device_id": "hashed_device_fingerprint",
  "app_version": "1.2.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "status": "licensed",
    "updates_expire": "2027-01-10T12:00:00Z",
    "devices_used": 2,
    "devices_max": 3
  },
  "timestamp": "2026-01-10T12:00:00Z",
  "signature": "base64_ed25519_signature"
}
```

### POST `/api/v1/deactivate`

**Request:**
```json
{
  "license_key": "STCH-ABCD-EFGH-IJKL-MNOP",
  "device_id": "hashed_device_fingerprint"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "devices_used": 1,
    "devices_max": 3
  },
  "timestamp": "2026-01-10T12:00:00Z"
}
```

### POST `/api/v1/devices/deactivate` (Remote Deactivation)

Allows users to deactivate a device remotely (e.g., from web portal or different device).

**Request:**
```json
{
  "license_key": "STCH-ABCD-EFGH-IJKL-MNOP",
  "device_id_to_deactivate": "target_device_fingerprint",
  "requesting_device_id": "current_device_fingerprint"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "devices_used": 1,
    "devices_max": 3,
    "deactivated_device_name": "Old MacBook Pro"
  },
  "timestamp": "2026-01-10T12:00:00Z"
}
```

**Note:** For web portal requests (no requesting_device_id), user must be authenticated and own the license.

### POST `/api/v1/recover`

**Request:**
```json
{
  "email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "If a license exists for this email, recovery instructions have been sent.",
    "email_sent": true
  },
  "timestamp": "2026-01-10T12:00:00Z"
}
```

### GET `/api/v1/check-updates`

**Request (Query params):**
```
?platform=windows&version=1.2.0&device_id=xxx&license_key=STCH-XXX
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current_version": "1.2.0",
    "latest_version": "1.3.0",
    "update_available": true,
    "update_allowed": true,
    "download_url": "https://stitchalot.studio/download/windows/1.3.0",
    "release_notes": "Bug fixes and performance improvements",
    "release_date": "2026-01-08T12:00:00Z"
  },
  "timestamp": "2026-01-10T12:00:00Z"
}
```

### POST `/api/v1/iap/apple`

**Request:**
```json
{
  "receipt_data": "base64_encoded_receipt",
  "device_id": "hashed_device_fingerprint",
  "device_name": "iPad Pro",
  "app_version": "1.2.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "license_key": "STCH-XXXX-XXXX-XXXX-XXXX",
    "updates_expire": "2027-01-10T12:00:00Z",
    "devices_used": 1,
    "devices_max": 3
  },
  "timestamp": "2026-01-10T12:00:00Z",
  "signature": "base64_ed25519_signature"
}
```

### POST `/api/v1/iap/microsoft`

**Request:**
```json
{
  "user_id": "ms_store_user_id",
  "product_id": "NeedlePointDesignerLicense",
  "device_id": "hashed_device_fingerprint",
  "device_name": "DESKTOP-ABC123",
  "app_version": "1.2.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "license_key": "STCH-XXXX-XXXX-XXXX-XXXX",
    "updates_expire": "2027-01-10T12:00:00Z",
    "devices_used": 1,
    "devices_max": 3
  },
  "timestamp": "2026-01-10T12:00:00Z",
  "signature": "base64_ed25519_signature"
}
```

---

## Web: License Key Generation

```typescript
// lib/license-keys.ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1

export function generateLicenseKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = '';
    for (let c = 0; c < 4; c++) {
      const idx = Math.floor(Math.random() * ALPHABET.length);
      group += ALPHABET[idx];
    }
    groups.push(group);
  }
  return `STCH-${groups.join('-')}`;
}
// Example: STCH-K7HN-2MRG-XVBP-9LQT
```

---

## Web: Response Signing

```typescript
// lib/signing.ts
import * as ed from '@noble/ed25519';

const PRIVATE_KEY = Buffer.from(process.env.ED25519_PRIVATE_KEY!, 'base64');

export async function signResponse(data: object): Promise<string> {
  const message = JSON.stringify(data);
  const messageBytes = new TextEncoder().encode(message);
  const signature = await ed.signAsync(messageBytes, PRIVATE_KEY);
  return Buffer.from(signature).toString('base64');
}

export function getPublicKeyBase64(): string {
  const publicKey = ed.getPublicKey(PRIVATE_KEY);
  return Buffer.from(publicKey).toString('base64');
}
```

---

## Web: Apple IAP Verification

```typescript
// lib/apple-iap.ts
import {
  AppStoreServerAPI,
  Environment,
  decodeTransaction,
  decodeRenewalInfo,
} from 'app-store-server-api';

const api = new AppStoreServerAPI(
  process.env.APPLE_KEY_ID!,
  process.env.APPLE_ISSUER_ID!,
  process.env.APPLE_BUNDLE_ID!,
  process.env.APPLE_PRIVATE_KEY!,
  process.env.NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox
);

export interface AppleVerificationResult {
  valid: boolean;
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: Date;
  expiresDate?: Date;  // For subscriptions
  isSubscription?: boolean;
  error?: string;
}

export async function verifyAppleReceipt(signedTransaction: string): Promise<AppleVerificationResult> {
  try {
    // Decode the signed transaction (JWS format from StoreKit 2)
    const transaction = await decodeTransaction(signedTransaction);

    return {
      valid: true,
      transactionId: transaction.transactionId,
      originalTransactionId: transaction.originalTransactionId,
      productId: transaction.productId,
      purchaseDate: new Date(transaction.purchaseDate),
      expiresDate: transaction.expiresDate ? new Date(transaction.expiresDate) : undefined,
      isSubscription: transaction.type === 'Auto-Renewable Subscription',
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get transaction history for a user (useful for restore purchases)
export async function getTransactionHistory(originalTransactionId: string) {
  return await api.getTransactionHistory(originalTransactionId);
}

// Get subscription status
export async function getSubscriptionStatus(originalTransactionId: string) {
  return await api.getAllSubscriptionStatuses(originalTransactionId);
}
```

---

## Web: Apple Server Notifications Webhook

Apple sends server-to-server notifications for important events like refunds, subscription renewals, and revocations. This webhook must be configured in App Store Connect.

```typescript
// app/api/webhooks/apple/route.ts
import { prisma } from '@/db/prisma';
import { logEvent, EventTypes } from '@/lib/license-analytics';
import {
  decodeNotificationPayload,
  decodeTransaction,
} from 'app-store-server-api';

// Apple notification types we handle
const NotificationTypes = {
  // One-time purchases
  REFUND: 'REFUND',
  REVOKE: 'REVOKE',
  CONSUMPTION_REQUEST: 'CONSUMPTION_REQUEST',

  // Subscriptions (future use)
  DID_RENEW: 'DID_RENEW',
  DID_FAIL_TO_RENEW: 'DID_FAIL_TO_RENEW',
  DID_CHANGE_RENEWAL_STATUS: 'DID_CHANGE_RENEWAL_STATUS',
  EXPIRED: 'EXPIRED',
  GRACE_PERIOD_EXPIRED: 'GRACE_PERIOD_EXPIRED',
  SUBSCRIBED: 'SUBSCRIBED',
} as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { signedPayload } = body;

    if (!signedPayload) {
      return Response.json(
        { error: 'Missing signedPayload' },
        { status: 400 }
      );
    }

    // Decode and verify the notification (Apple signs it with their key)
    const notification = await decodeNotificationPayload(signedPayload);
    const { notificationType, subtype, data } = notification;

    // Decode the transaction info
    const transaction = data?.signedTransactionInfo
      ? await decodeTransaction(data.signedTransactionInfo)
      : null;

    console.log(`Apple notification: ${notificationType}${subtype ? `/${subtype}` : ''}`, {
      transactionId: transaction?.transactionId,
      originalTransactionId: transaction?.originalTransactionId,
    });

    switch (notificationType) {
      case NotificationTypes.REFUND: {
        // Customer received a refund - revoke their license
        await handleRefund(transaction);
        break;
      }

      case NotificationTypes.REVOKE: {
        // Family sharing access revoked or app removed from family
        await handleRevoke(transaction);
        break;
      }

      case NotificationTypes.CONSUMPTION_REQUEST: {
        // Apple is asking if the purchase was "consumed" (used)
        // For software licenses, we should report it as consumed
        // This helps Apple decide refund requests
        console.log('Consumption request received - license is consumed');
        break;
      }

      // Subscription events (for future subscription support)
      case NotificationTypes.DID_RENEW: {
        await handleSubscriptionRenewal(transaction, data);
        break;
      }

      case NotificationTypes.DID_FAIL_TO_RENEW: {
        await handleRenewalFailure(transaction, subtype);
        break;
      }

      case NotificationTypes.EXPIRED: {
        await handleSubscriptionExpired(transaction);
        break;
      }

      case NotificationTypes.GRACE_PERIOD_EXPIRED: {
        await handleGracePeriodExpired(transaction);
        break;
      }

      default:
        console.log(`Unhandled Apple notification type: ${notificationType}`);
    }

    // Apple expects a 200 response to acknowledge receipt
    return Response.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Apple webhook error:', error);
    // Return 500 so Apple will retry
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleRefund(transaction: any) {
  if (!transaction?.originalTransactionId) return;

  // Find the license linked to this Apple transaction
  const appleTransaction = await prisma.appleTransaction.findFirst({
    where: { originalTransactionId: transaction.originalTransactionId },
    include: { license: true },
  });

  if (!appleTransaction?.licenseId) {
    console.log('No license found for refunded transaction');
    return;
  }

  // Revoke the license
  await prisma.license.update({
    where: { id: appleTransaction.licenseId },
    data: {
      isRefunded: true,
      refundedAt: new Date(),
      refundReason: 'Apple App Store refund',
      isRevoked: true,
      revokeReason: 'Refunded via Apple',
    },
  });

  // Deactivate all devices
  await prisma.deviceActivation.updateMany({
    where: { licenseId: appleTransaction.licenseId },
    data: { isActive: false, deactivatedAt: new Date() },
  });

  // Update Apple transaction status
  await prisma.appleTransaction.update({
    where: { id: appleTransaction.id },
    data: { status: 'refunded' },
  });

  // Log the event
  await logEvent(EventTypes.REFUND_PROCESSED, 'success', {
    licenseId: appleTransaction.licenseId,
    source: 'apple',
    transactionId: transaction.transactionId,
  });

  console.log(`Refund processed for license ${appleTransaction.licenseId}`);
}

async function handleRevoke(transaction: any) {
  if (!transaction?.originalTransactionId) return;

  const appleTransaction = await prisma.appleTransaction.findFirst({
    where: { originalTransactionId: transaction.originalTransactionId },
  });

  if (!appleTransaction?.licenseId) return;

  // Similar to refund, but different reason
  await prisma.license.update({
    where: { id: appleTransaction.licenseId },
    data: {
      isRevoked: true,
      revokeReason: 'Revoked by Apple (family sharing or account issue)',
    },
  });

  await prisma.deviceActivation.updateMany({
    where: { licenseId: appleTransaction.licenseId },
    data: { isActive: false, deactivatedAt: new Date() },
  });

  await prisma.appleTransaction.update({
    where: { id: appleTransaction.id },
    data: { status: 'revoked' },
  });

  await logEvent(EventTypes.LICENSE_REVOKED, 'success', {
    licenseId: appleTransaction.licenseId,
    source: 'apple',
    reason: 'revoke_notification',
  });
}

// Subscription handlers (for future use)
async function handleSubscriptionRenewal(transaction: any, data: any) {
  if (!transaction?.originalTransactionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { appleOriginalTxId: transaction.originalTransactionId },
    include: { license: true },
  });

  if (!subscription) return;

  // Update subscription period
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: new Date(transaction.purchaseDate),
      currentPeriodEnd: transaction.expiresDate ? new Date(transaction.expiresDate) : undefined,
      gracePeriodEnd: null,
    },
  });

  // Extend update entitlement
  await prisma.license.update({
    where: { id: subscription.licenseId },
    data: {
      updatesExpire: transaction.expiresDate ? new Date(transaction.expiresDate) : undefined,
    },
  });

  // Record renewal
  await prisma.subscriptionRenewal.create({
    data: {
      subscriptionId: subscription.id,
      periodStart: new Date(transaction.purchaseDate),
      periodEnd: transaction.expiresDate ? new Date(transaction.expiresDate) : new Date(),
      amount: subscription.pricePerPeriod,
      currency: subscription.currency,
      status: 'succeeded',
      paymentId: transaction.transactionId,
    },
  });

  console.log(`Subscription renewed for license ${subscription.licenseId}`);
}

async function handleRenewalFailure(transaction: any, subtype?: string) {
  if (!transaction?.originalTransactionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { appleOriginalTxId: transaction.originalTransactionId },
  });

  if (!subscription) return;

  // Set grace period (Apple typically gives 16 days for billing retry)
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 16);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'PAST_DUE',
      gracePeriodEnd,
    },
  });

  console.log(`Subscription renewal failed for ${subscription.id}, grace period until ${gracePeriodEnd}`);
}

async function handleSubscriptionExpired(transaction: any) {
  if (!transaction?.originalTransactionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { appleOriginalTxId: transaction.originalTransactionId },
  });

  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'EXPIRED',
      gracePeriodEnd: null,
    },
  });

  console.log(`Subscription expired for ${subscription.id}`);
}

async function handleGracePeriodExpired(transaction: any) {
  if (!transaction?.originalTransactionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { appleOriginalTxId: transaction.originalTransactionId },
  });

  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'EXPIRED',
      gracePeriodEnd: null,
    },
  });

  // License still works (perpetual) but no more updates
  console.log(`Grace period expired for subscription ${subscription.id}`);
}
```

### App Store Connect Configuration

To receive Apple Server Notifications:

1. Go to **App Store Connect** → Your App → **App Information**
2. Scroll to **App Store Server Notifications**
3. Set **Production Server URL**: `https://stitchalot.studio/api/webhooks/apple`
4. Set **Sandbox Server URL**: `https://stitchalot.studio/api/webhooks/apple` (or a staging URL)
5. Select **Version 2** notifications (required for the code above)

---

## Web: Microsoft Store Verification

Microsoft Store uses a different approach - the app requests purchases via the Windows.Services.Store API, and you verify the license server-side using Microsoft's Store Services API.

```typescript
// lib/microsoft-store.ts
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.MS_STORE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.MS_STORE_TENANT_ID}`,
    clientSecret: process.env.MS_STORE_CLIENT_SECRET!,
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

interface MsStoreVerificationResult {
  valid: boolean;
  userId?: string;
  productId?: string;
  acquisitionType?: string;  // 'Purchase', 'Trial', 'Subscription'
  startDate?: Date;
  endDate?: Date;  // For subscriptions
  error?: string;
}

// Get access token for Microsoft Store API
async function getStoreAccessToken(): Promise<string> {
  const result = await cca.acquireTokenByClientCredential({
    scopes: ['https://onestore.microsoft.com/.default'],
  });

  if (!result?.accessToken) {
    throw new Error('Failed to acquire Microsoft Store access token');
  }

  return result.accessToken;
}

// Verify a user's entitlement to your product
export async function verifyMicrosoftStorePurchase(
  userStoreId: string,  // User's Microsoft Store ID (from Windows.Services.Store)
  productId: string
): Promise<MsStoreVerificationResult> {
  try {
    const accessToken = await getStoreAccessToken();

    // Call Microsoft Store Collections API to check user's entitlements
    const response = await fetch(
      'https://collections.mp.microsoft.com/v6.0/collections/query',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          beneficiaries: [
            {
              identityType: 'b2b',
              identityValue: userStoreId,
              localTicketReference: '',
            },
          ],
          productSkuIds: [
            { productId: productId },
          ],
          excludeDuplicates: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        valid: false,
        error: `Microsoft API error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json();

    // Check if user has the product
    const items = data.items || [];
    const entitlement = items.find(
      (item: any) => item.productId === productId && item.status === 'Active'
    );

    if (!entitlement) {
      return {
        valid: false,
        error: 'No active entitlement found',
      };
    }

    return {
      valid: true,
      userId: userStoreId,
      productId: entitlement.productId,
      acquisitionType: entitlement.acquisitionType,
      startDate: entitlement.startDate ? new Date(entitlement.startDate) : undefined,
      endDate: entitlement.endDate ? new Date(entitlement.endDate) : undefined,
    };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// For subscriptions: Check current subscription status
export async function checkMicrosoftSubscriptionStatus(
  userStoreId: string,
  subscriptionId: string
): Promise<{ active: boolean; expiresAt?: Date }> {
  const result = await verifyMicrosoftStorePurchase(userStoreId, subscriptionId);

  if (!result.valid) {
    return { active: false };
  }

  // Check if subscription is still active
  const now = new Date();
  const isActive = result.endDate ? result.endDate > now : true;

  return {
    active: isActive,
    expiresAt: result.endDate,
  };
}
```

### Microsoft Store API Route

```typescript
// app/api/v1/iap/microsoft/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/db/prisma';
import { verifyMicrosoftStorePurchase } from '@/lib/microsoft-store';
import { generateLicenseKey } from '@/lib/license-keys';
import { signResponse } from '@/lib/signing';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/errors';
import { rateLimits } from '@/lib/rate-limit';
import { logEvent, EventTypes } from '@/lib/license-analytics';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, product_id, device_id, device_name, app_version } = body;

    // Validate required fields
    if (!user_id || !product_id || !device_id) {
      return Response.json(
        errorResponse('INVALID_REQUEST', 'Missing required fields'),
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimit = await rateLimits.iapVerify.limit(device_id);
    if (!rateLimit.success) {
      return Response.json(
        errorResponse('RATE_LIMITED', 'Too many requests'),
        { status: 429 }
      );
    }

    // Verify the purchase with Microsoft
    const verification = await verifyMicrosoftStorePurchase(user_id, product_id);

    if (!verification.valid) {
      await logEvent(EventTypes.IAP_VERIFICATION_FAILED, 'failure', {
        source: 'microsoft',
        deviceId: device_id,
        error: verification.error,
      });

      return Response.json(
        errorResponse('INVALID_RECEIPT', verification.error || 'Microsoft Store verification failed'),
        { status: 400 }
      );
    }

    // Check if we already have a license for this Microsoft user
    let license = await prisma.license.findFirst({
      where: {
        source: 'MICROSOFT_STORE',
        paymentId: user_id,  // Using user_id as payment reference
      },
      include: {
        devices: { where: { isActive: true } },
      },
    });

    if (!license) {
      // Create new license
      const licenseKey = generateLicenseKey();
      const updatesExpire = new Date();
      updatesExpire.setFullYear(updatesExpire.getFullYear() + 1);

      license = await prisma.license.create({
        data: {
          licenseKey,
          email: `ms_${user_id}@store.microsoft.com`,  // Placeholder email
          customerName: null,
          updatesExpire,
          source: 'MICROSOFT_STORE',
          paymentId: user_id,
        },
        include: {
          devices: { where: { isActive: true } },
        },
      });

      await logEvent(EventTypes.PURCHASE_MICROSOFT, 'success', {
        licenseId: license.id,
        userId: user_id,
      });
    }

    // Check device limit
    const activeDevices = license.devices.length;
    const existingDevice = license.devices.find(d => d.deviceId === device_id);

    if (!existingDevice && activeDevices >= license.maxDevices) {
      return Response.json(
        errorResponse('DEVICE_LIMIT_REACHED', `Maximum device limit (${license.maxDevices}) reached`),
        { status: 403 }
      );
    }

    // Activate or update device
    if (existingDevice) {
      await prisma.deviceActivation.update({
        where: { id: existingDevice.id },
        data: {
          lastValidated: new Date(),
          appVersion: app_version,
        },
      });
    } else {
      await prisma.deviceActivation.create({
        data: {
          licenseId: license.id,
          deviceId: device_id,
          deviceName: device_name,
          platform: 'windows',
          appVersion: app_version,
        },
      });
    }

    // Prepare response
    const responseData = {
      license_key: license.licenseKey,
      updates_expire: license.updatesExpire.toISOString(),
      devices_used: existingDevice ? activeDevices : activeDevices + 1,
      devices_max: license.maxDevices,
    };

    const signature = await signResponse(responseData);

    return Response.json(successResponse(responseData, signature));

  } catch (error) {
    console.error('Microsoft IAP error:', error);
    return Response.json(
      errorResponse('INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    );
  }
}
```

### Microsoft Partner Center Setup

To use Microsoft Store verification:

1. **Register your app** in [Microsoft Partner Center](https://partner.microsoft.com/)
2. **Create an Azure AD app** for server-to-server auth:
   - Go to Azure Portal → Azure Active Directory → App registrations
   - Create new registration
   - Add client secret
   - Note the Tenant ID, Client ID, and Client Secret
3. **Associate Azure AD app with your Store app**:
   - In Partner Center, go to your app → Services → Product collections and purchases
   - Link your Azure AD application
4. **Configure In-App Product**:
   - Create a "Durable" add-on for the perpetual license
   - Set price to $59.99
   - Product ID should match `MS_STORE_PRODUCT_ID` in your app

---

## Web: Stripe Webhook with Refund Handling

```typescript
// app/api/webhooks/stripe/route.ts
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { generateLicenseKey } from '@/lib/license-keys';
import { sendLicenseEmail } from '@/lib/email';
import { logEvent, EventTypes } from '@/lib/analytics';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Generate license
      const licenseKey = generateLicenseKey();
      const updatesExpire = new Date();
      updatesExpire.setFullYear(updatesExpire.getFullYear() + 1);

      // Create Order record for unified accounting
      const order = await prisma.order.create({
        data: {
          userId: null, // Link if user is logged in during purchase
          email: session.customer_email!,
          status: 'completed',
          totalAmount: 59.99,
          currency: 'USD',
          paymentMethod: 'stripe',
          paymentId: session.payment_intent as string,
          orderType: 'SOFTWARE_LICENSE',
        },
      });

      // Create license linked to Order
      const license = await prisma.license.create({
        data: {
          licenseKey,
          email: session.customer_email!,
          customerName: session.customer_details?.name,
          updatesExpire,
          source: 'STRIPE',
          paymentId: session.payment_intent as string,
          orderId: order.id,
        },
      });

      // Link trial conversion if device_id was passed via metadata
      const deviceId = session.metadata?.device_id;
      if (deviceId) {
        await prisma.trial.updateMany({
          where: { deviceId, convertedToLicenseId: null },
          data: { convertedToLicenseId: license.id },
        });
        await logEvent(EventTypes.TRIAL_CONVERTED, 'success', {
          licenseId: license.id,
          deviceId,
        });
      }

      // Send email
      await sendLicenseEmail(
        session.customer_email!,
        licenseKey,
        session.customer_details?.name
      );

      // Log event
      await logEvent(EventTypes.PURCHASE_STRIPE, 'success', {
        licenseId: license.id,
        orderId: order.id,
        email: session.customer_email,
      });

      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;

      // Find and revoke the license
      const license = await prisma.license.findFirst({
        where: { paymentId: charge.payment_intent as string },
      });

      if (license) {
        await prisma.license.update({
          where: { id: license.id },
          data: {
            isRefunded: true,
            refundedAt: new Date(),
            refundReason: charge.refunds?.data[0]?.reason || 'Customer requested',
            isRevoked: true,
            revokeReason: 'Refunded',
          },
        });

        // Deactivate all devices
        await prisma.deviceActivation.updateMany({
          where: { licenseId: license.id },
          data: { isActive: false, deactivatedAt: new Date() },
        });

        // Log event
        await logEvent(EventTypes.REFUND_PROCESSED, 'success', {
          licenseId: license.id,
          paymentId: charge.payment_intent,
        });
      }

      break;
    }
  }

  return new Response('OK', { status: 200 });
}
```

---

## Web: License Recovery Email

```typescript
// lib/email.ts (additional function)
export async function sendRecoveryEmail(
  email: string,
  licenses: Array<{ licenseKey: string; purchaseDate: Date; devicesUsed: number }>
): Promise<void> {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();

  const licenseList = licenses.map(l => `
    <li>
      <strong>${l.licenseKey}</strong><br>
      Purchased: ${l.purchaseDate.toLocaleDateString()}<br>
      Devices: ${l.devicesUsed}/3 active
    </li>
  `).join('');

  sendSmtpEmail.subject = 'Your NeedlePoint Designer License Keys';
  sendSmtpEmail.sender = {
    name: 'Stitchalot Studio',
    email: process.env.EMAIL_FROM!,
  };
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.htmlContent = `
    <h1>License Recovery</h1>
    <p>Here are the license keys associated with ${email}:</p>
    <ul>${licenseList}</ul>
    <p>If you need to deactivate a device, open the app on that device and go to Settings → License → Deactivate.</p>
    <p>Need help? Visit <a href="https://stitchalot.studio/support">stitchalot.studio/support</a></p>
  `;

  await apiInstance.sendTransacEmail(sendSmtpEmail);
}
```

---

## Web: Environment Variables

```env
# Database (Neon)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# Cryptography
ED25519_PRIVATE_KEY="base64_encoded_32_byte_key"

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."

# Apple App Store
APPLE_KEY_ID="ABC123"
APPLE_ISSUER_ID="xxx-xxx-xxx"
APPLE_BUNDLE_ID="com.stitchalot.needlepoint"
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_SHARED_SECRET="abc123..."  # For receipt verification

# Microsoft Store
MS_STORE_TENANT_ID="xxx"
MS_STORE_CLIENT_ID="xxx"
MS_STORE_CLIENT_SECRET="xxx"

# Upstash Redis
UPSTASH_REDIS_URL="https://..."
UPSTASH_REDIS_TOKEN="..."

# NextAuth
NEXTAUTH_SECRET="random_secret_here"
NEXTAUTH_URL="https://stitchalot.studio"

# Email (Brevo)
BREVO_API_KEY="xkeysib-..."
EMAIL_FROM="licenses@stitchalot.studio"
```

---

## Web: Deployment Steps

1. **Create Neon database** at neon.tech
2. **Create Upstash Redis** at upstash.com
3. **Generate Ed25519 keypair**:
   ```bash
   node -e "const ed = require('@noble/ed25519'); const key = ed.utils.randomPrivateKey(); console.log(Buffer.from(key).toString('base64'));"
   ```
4. **Set up Apple App Store Connect**:
   - Create App Store Connect API key
   - Configure In-App Purchase product
   - Set up Server Notifications URL
5. **Set up Microsoft Partner Center** (if using MS Store):
   - Register app
   - Configure IAP product
   - Get API credentials
6. **Deploy to Vercel**: `vercel`
7. **Push database schema**: `npx prisma db push`
8. **Configure domain**: Add `stitchalot.studio` in Vercel
9. **Set up webhooks**:
   - Stripe: `https://stitchalot.studio/api/webhooks/stripe`
   - Apple: `https://stitchalot.studio/api/webhooks/apple`

---

# IMPLEMENTATION PHASES (Testable End-to-End Slices)

Each phase delivers a complete, testable feature across both app and website. Test after each phase before proceeding.

---

## Phase 1: Trial System (Foundation)
**Goal**: User can install app, start trial, and use app for 30 days with watermarked exports.

### Website Tasks
1. Add Prisma schema: `License`, `Trial`, `DeviceActivation`, `AnalyticsEvent` models
2. Run migration: `npx prisma db push`
3. Implement `lib/errors.ts` (standardized API responses)
4. Implement `lib/signing.ts` (Ed25519 response signing)
5. Implement `lib/rate-limit.ts` (Upstash rate limiting)
6. Implement `POST /api/v1/trial/init` endpoint
7. Deploy to Vercel

### App Tasks (Windows/macOS)
1. Add Rust dependencies to `Cargo.toml`
2. Create `src-tauri/src/licensing/` module structure
3. Implement `types.rs` (LicenseState, LicenseStatus enums)
4. Implement `device.rs` (device ID generation - desktop only for now)
5. Implement `storage.rs` (Stronghold encrypted storage)
6. Implement `api.rs` (HTTP client for trial/init)
7. Implement `manager.rs` (trial logic only)
8. Add Tauri commands: `init_license`, `start_trial`, `get_license_status`
9. Create React `LicenseGate.tsx` component
10. Create React `TrialBanner.tsx` component
11. Modify `src/utils/pdfExport.ts` to add watermark when trial
12. Integrate `<LicenseGate>` wrapper in `App.tsx`

### Test Checklist
- [ ] Fresh app install shows activation dialog with "Start Trial" option
- [ ] Clicking "Start Trial" calls API and stores trial locally
- [ ] Trial banner shows "29 days remaining" (etc.)
- [ ] PDF export has watermark text
- [ ] API rate limits work (5 trial inits/hour per IP)
- [ ] Same device can't start multiple trials
- [ ] App works offline after trial started (reads from local storage)

---

## Phase 2: License Activation (Manual Keys)
**Goal**: Admin can create license keys; users can activate them in the app.

### Website Tasks
1. Implement `lib/license-keys.ts` (STCH-XXXX-XXXX-XXXX-XXXX generation)
2. Implement `POST /api/v1/activate` endpoint
3. Implement `POST /api/v1/validate` endpoint
4. Implement `POST /api/v1/deactivate` endpoint
5. Add admin page: `/admin/licenses/page.tsx` (list licenses)
6. Add admin page: `/admin/licenses/new/page.tsx` (create license manually)
7. Add admin page: `/admin/licenses/[id]/page.tsx` (view/revoke license)
8. Add `lib/license-analytics.ts` (event logging)

### App Tasks
1. Update `manager.rs` to handle activation/validation logic
2. Update `api.rs` with activate/validate/deactivate endpoints
3. Implement offline caching with signature verification
4. Implement grace period logic (30 days cache + 7 days grace)
5. Add Tauri commands: `activate_license`, `validate_license`, `deactivate_device`
6. Create React `ActivationDialog.tsx` (license key entry form)
7. Create React `LicenseExpiredDialog.tsx` (trial/grace period expired)
8. Update `LicenseGate.tsx` to handle all license states
9. Remove watermark when licensed

### Test Checklist
- [ ] Admin can create license key in dashboard
- [ ] User can enter license key in app
- [ ] Valid key activates successfully, shows "Licensed"
- [ ] Invalid key shows error with code
- [ ] PDF exports have NO watermark when licensed
- [ ] Device count shows correctly (1/3)
- [ ] Second device can activate same key (2/3)
- [ ] Fourth device rejected with "device limit reached"
- [ ] User can deactivate device, freeing slot
- [ ] App works offline for 30 days with cached validation
- [ ] Grace period warning appears after 30 days offline
- [ ] App blocks after 37 days offline (requires internet)
- [ ] Admin can revoke license; app shows "invalid" on next validate

---

## Phase 3: Stripe Purchase Flow
**Goal**: Customer can purchase license on website, receive key via email, activate in app.

### Website Tasks
1. Create Stripe Product and Price ($59.99)
2. Add `/purchase/software/page.tsx` (redirects to Stripe Checkout)
3. Add `/purchase/software/success/page.tsx` (displays license key)
4. Modify existing `/api/webhooks/stripe/route.ts` to handle license creation
5. Add `Order` record creation for license purchases
6. Implement `lib/email.ts` - `sendLicenseEmail()` function
7. Configure Brevo transactional email template
8. Add `/download/page.tsx` (platform-specific download links)

### App Tasks
1. Add "Purchase License" button in `ActivationDialog.tsx` that opens website
2. Ensure smooth flow: user clicks purchase → website → Stripe → email → paste key in app

### Test Checklist
- [ ] User clicks "Purchase" in app, browser opens to purchase page
- [ ] Stripe Checkout works, payment succeeds
- [ ] Success page shows license key
- [ ] Email received with license key
- [ ] Order record created in database (linked to license)
- [ ] User pastes key in app, activation succeeds
- [ ] Stripe refund triggers license revocation via webhook
- [ ] After refund, app shows "license revoked" on next validation

---

## Phase 4: License Recovery & Self-Service
**Goal**: User can recover lost license keys and manage devices from web portal.

### Website Tasks
1. Implement `POST /api/v1/recover` endpoint
2. Add `/recover/page.tsx` (license recovery form)
3. Implement `sendRecoveryEmail()` in `lib/email.ts`
4. Add `/account/licenses/page.tsx` (user's license portal - requires login)
5. Add device list view with "Deactivate" button per device
6. Implement `POST /api/admin/licenses/[id]/deactivate-device` for remote deactivation

### App Tasks
1. Add Tauri command: `recover_license`
2. Create React `LicenseRecoveryDialog.tsx`
3. Add "Forgot License Key?" link in `ActivationDialog.tsx`

### Test Checklist
- [ ] User enters email on recovery page
- [ ] Email sent listing all licenses for that email
- [ ] No email sent if no licenses (but same success message - security)
- [ ] Rate limited (3 recovery requests/hour per email)
- [ ] Logged-in user can see their licenses at /account/licenses
- [ ] User can see which devices are activated
- [ ] User can remotely deactivate a device
- [ ] Deactivation frees slot immediately
- [ ] App on deactivated device shows "deactivated" on next validation

---

## Phase 5: Update Checking & Version Management
**Goal**: App can check for updates; users with expired update entitlement are blocked from new versions.

### Website Tasks
1. Add Prisma model: `AppVersion`
2. Implement `GET /api/v1/check-updates` endpoint
3. Add `/admin/app-versions/page.tsx` (manage releases)
4. Add `/releases/page.tsx` (public changelog)
5. Upload app binaries to storage (or link to GitHub releases)

### App Tasks
1. Implement `updates.rs` (version checking logic)
2. Add Tauri command: `check_for_updates`
3. Create React `UpdateAvailableDialog.tsx`
4. Check for updates on app startup (after license validation)
5. Show update prompt if available and entitled
6. Show "update entitlement expired" message if not entitled

### Test Checklist
- [ ] Admin can add new app version in dashboard
- [ ] App checks for updates on startup
- [ ] Update available dialog shows with release notes
- [ ] Download link works for each platform
- [ ] User with active update entitlement can download
- [ ] User with expired entitlement sees "renew to update" message
- [ ] Public releases page shows version history

---

## Phase 6: Apple App Store (iPad + Mac)
**Goal**: Users can purchase via Apple IAP on iPad and Mac App Store.

### Website Tasks
1. Implement `lib/apple-iap.ts` (receipt verification)
2. Implement `POST /api/v1/iap/apple` endpoint
3. Implement `POST /api/webhooks/apple/route.ts` (Server Notifications)
4. Add `AppleTransaction` model and migration
5. Configure App Store Connect (Server Notifications URL)

### App Tasks (iOS/macOS)
1. Implement iOS device ID (`identifierForVendor`) in `device.rs`
2. Implement Mac App Store device ID (Keychain UUID) in `device.rs`
3. Implement `iap.rs` (StoreKit 2 integration)
4. Add Tauri commands: `purchase_iap`, `restore_purchases`, `verify_iap_receipt`
5. Create React `PurchaseOptions.tsx` (shows IAP button on App Store builds)
6. Detect App Store build vs direct download
7. Build and submit to TestFlight / Mac App Store sandbox

### Test Checklist
- [ ] iPad app shows "Purchase" button (IAP)
- [ ] IAP purchase flow completes in sandbox
- [ ] Receipt sent to server, license created
- [ ] License key returned and stored locally
- [ ] App shows "Licensed" after IAP
- [ ] "Restore Purchases" recovers license on new device
- [ ] External license key also works on iPad (cross-platform)
- [ ] Mac App Store build uses Keychain device ID
- [ ] Mac App Store IAP works same as iPad
- [ ] Apple refund notification revokes license
- [ ] Apple revoke notification deactivates license

---

## Phase 7: Microsoft Store
**Goal**: Users can purchase via Microsoft Store IAP on Windows.

### Website Tasks
1. Implement `lib/microsoft-store.ts` (Collections API verification)
2. Implement `POST /api/v1/iap/microsoft` endpoint
3. Configure Azure AD app and Partner Center

### App Tasks (Windows)
1. Implement MS Store detection in `device.rs`
2. Implement `iap.rs` Windows section (Windows.Services.Store API)
3. Add MS Store-specific purchase flow in `PurchaseOptions.tsx`
4. Build MSIX package for Store submission

### Test Checklist
- [ ] Windows Store app shows IAP purchase button
- [ ] IAP purchase flow completes
- [ ] License created on server
- [ ] App shows "Licensed" after IAP
- [ ] External license key also works (cross-platform)
- [ ] MS Store user can use license on non-Store Mac app

---

## Phase 8: Admin Dashboard & Analytics
**Goal**: Complete admin experience with analytics and full license management.

### Website Tasks
1. Add `/admin/trials/page.tsx` (view trial usage, conversion)
2. Add `/admin/software-analytics/page.tsx` (dashboard with charts)
3. Add analytics queries: trials started, converted, licenses sold by source, active devices by platform
4. Add license search/filter in admin
5. Add bulk operations (export CSV, bulk revoke)

### App Tasks
1. Ensure all events are logged (trial start, activation, validation, etc.)

### Test Checklist
- [ ] Admin can see trial conversion rate
- [ ] Admin can see revenue by source (Stripe vs Apple vs Microsoft)
- [ ] Admin can see active users by platform
- [ ] Admin can search licenses by email/key
- [ ] Admin can export license data to CSV
- [ ] Charts render correctly with real data

---

## Phase 9: Polish & Production Hardening
**Goal**: Production-ready with all edge cases handled.

### Website Tasks
1. Add proper error pages (rate limited, server error)
2. Add request logging and monitoring
3. Set up alerts for webhook failures
4. Security audit: rate limits, input validation, SQL injection
5. Load test API endpoints

### App Tasks
1. Handle all network error states gracefully
2. Add retry logic with exponential backoff
3. Improve offline UX (clear messaging)
4. Handle clock skew (user's system time wrong)
5. Final UI polish on all license dialogs
6. Localization if needed

### Test Checklist
- [ ] App handles network timeout gracefully
- [ ] App handles server errors gracefully
- [ ] Rate limiting doesn't break normal usage
- [ ] Offline mode works reliably
- [ ] All error messages are user-friendly
- [ ] No console errors in production build
- [ ] Performance acceptable under load

---

## Launch Checklist

### Pre-Launch
- [ ] All Phase 1-9 tests passing
- [ ] Production Stripe keys configured
- [ ] Production Apple credentials configured
- [ ] Production Microsoft credentials configured
- [ ] DNS configured for stitchalot.studio
- [ ] SSL certificate active
- [ ] Email deliverability tested (check spam folder)
- [ ] App signed and notarized (macOS)
- [ ] App code-signed (Windows)
- [ ] App Store submissions approved

### Launch Day
- [ ] Deploy website to production
- [ ] Release apps on all platforms
- [ ] Monitor error rates
- [ ] Monitor webhook delivery
- [ ] Test one real purchase on each platform

### Post-Launch
- [ ] Monitor trial conversion
- [ ] Monitor support tickets
- [ ] Watch for abuse patterns
- [ ] Plan first update release

---

# VERIFICATION CHECKLIST

## Desktop App - Direct Download (Windows/macOS)
- [ ] Fresh install shows activation dialog
- [ ] "Start Trial" initializes 30-day trial
- [ ] Trial banner shows correct days remaining
- [ ] PDF exports have watermark during trial
- [ ] Trial expiry blocks app
- [ ] Valid license key activates successfully
- [ ] Invalid key shows error with code
- [ ] Device limit (3) enforced with clear message
- [ ] Licensed app has no watermark
- [ ] App works offline with cached validation
- [ ] Grace period warning after 30 days offline
- [ ] App blocks after 37 days offline
- [ ] Deactivation frees device slot
- [ ] License recovery sends email
- [ ] Update check shows available updates
- [ ] Updates blocked when entitlement expired

## iPad App (Apple App Store)
- [ ] All direct download checklist items apply
- [ ] Apple IAP purchase flow works
- [ ] IAP creates/links license on server
- [ ] Restore purchases works
- [ ] External license key also works (for web purchasers)
- [ ] `identifierForVendor` device ID works correctly

## Mac App (Mac App Store)
- [ ] All direct download checklist items apply
- [ ] Apple IAP purchase flow works (same as iPad)
- [ ] IAP creates/links license on server
- [ ] Restore purchases works
- [ ] External license key also works (for web purchasers)
- [ ] Keychain-stored device ID persists across reinstalls
- [ ] Sandbox detection works correctly

## Windows App (Microsoft Store)
- [ ] All direct download checklist items apply
- [ ] MS Store IAP purchase flow works
- [ ] IAP creates/links license on server
- [ ] External license key also works (for web purchasers)
- [ ] MS Store user ID detection works

## Website/API
- [ ] Trial init creates/returns trial
- [ ] Trial init rate limited (5/hour per IP)
- [ ] Activate succeeds with valid key
- [ ] Activate fails at device limit
- [ ] Validate returns correct status
- [ ] Deactivate removes device
- [ ] Remote deactivate works from web portal
- [ ] All endpoints return standardized errors
- [ ] Rate limiting works on all endpoints
- [ ] Stripe checkout creates license AND Order record at $59.99
- [ ] Stripe refund revokes license
- [ ] Apple IAP verification works (iPad + Mac)
- [ ] Apple IAP creates license AND Order record
- [ ] Apple Server Notifications webhook handles refunds
- [ ] Apple Server Notifications webhook handles revocations
- [ ] Microsoft Store verification works
- [ ] Microsoft Store creates license AND Order record
- [ ] Email sent with license key (Stripe purchases only; IAP uses Restore)
- [ ] Recovery email lists all licenses
- [ ] Admin can create/revoke licenses
- [ ] Analytics events logged
- [ ] Update check returns correct info
- [ ] Cross-platform license works (buy on web, use on Mac App Store version)

## Customer Self-Service Portal
- [ ] User can view all their licenses at /account/licenses
- [ ] User can see active devices per license
- [ ] User can remotely deactivate a device
- [ ] Deactivation frees device slot immediately
- [ ] User cannot deactivate their only/current device from web (must use app)
