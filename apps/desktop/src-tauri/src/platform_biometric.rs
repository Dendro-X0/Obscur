//! KEY-MOAT Phase 6 — OS biometric step-up (Windows Hello / Touch ID).

use serde::{Deserialize, Serialize};

pub const DEFAULT_BIOMETRIC_REASON: &str = "Verify your identity to unlock Obscur.";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BiometricCapabilityStatus {
    Available,
    NotEnrolled,
    Unavailable,
}

pub fn probe_biometric_capability() -> BiometricCapabilityStatus {
    #[cfg(target_os = "windows")]
    {
        return probe_windows_hello_capability();
    }
    #[cfg(target_os = "macos")]
    {
        return probe_macos_touch_id_capability();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        BiometricCapabilityStatus::Unavailable
    }
}

pub fn request_biometric_verification(message: &str) -> Result<bool, String> {
    let reason = message.trim();
    let reason = if reason.is_empty() {
        DEFAULT_BIOMETRIC_REASON
    } else {
        reason
    };

    #[cfg(target_os = "windows")]
    {
        return request_windows_hello(reason);
    }
    #[cfg(target_os = "macos")]
    {
        return request_macos_touch_id(reason);
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = reason;
        Ok(false)
    }
}

#[cfg(target_os = "windows")]
fn probe_windows_hello_capability() -> BiometricCapabilityStatus {
    use windows::Security::Credentials::UI::{
        UserConsentVerifier, UserConsentVerifierAvailability,
    };

    match UserConsentVerifier::CheckAvailabilityAsync() {
        Ok(operation) => match operation.get() {
            Ok(UserConsentVerifierAvailability::Available) => {
                BiometricCapabilityStatus::Available
            }
            Ok(UserConsentVerifierAvailability::DeviceNotPresent) => {
                BiometricCapabilityStatus::Unavailable
            }
            Ok(UserConsentVerifierAvailability::DisabledByPolicy) => {
                BiometricCapabilityStatus::Unavailable
            }
            Ok(UserConsentVerifierAvailability::DeviceBusy) => {
                BiometricCapabilityStatus::Unavailable
            }
            Ok(_) => BiometricCapabilityStatus::NotEnrolled,
            Err(_) => BiometricCapabilityStatus::Unavailable,
        },
        Err(_) => BiometricCapabilityStatus::Unavailable,
    }
}

#[cfg(target_os = "windows")]
fn request_windows_hello(message: &str) -> Result<bool, String> {
    use windows::core::HSTRING;
    use windows::Security::Credentials::UI::{
        UserConsentVerifier, UserConsentVerificationResult, UserConsentVerifierAvailability,
    };

    let availability = UserConsentVerifier::CheckAvailabilityAsync()
        .map_err(|error| format!("Windows Hello availability check failed: {error}"))?
        .get()
        .map_err(|error| format!("Windows Hello availability check failed: {error}"))?;
    if availability != UserConsentVerifierAvailability::Available {
        return Ok(false);
    }

    let prompt = HSTRING::from(message);
    let result = UserConsentVerifier::RequestVerificationAsync(&prompt)
        .map_err(|error| format!("Windows Hello verification failed: {error}"))?
        .get()
        .map_err(|error| format!("Windows Hello verification failed: {error}"))?;

    Ok(result == UserConsentVerificationResult::Verified)
}

#[cfg(target_os = "macos")]
fn probe_macos_touch_id_capability() -> BiometricCapabilityStatus {
    use localauthentication::prelude::*;

    let context = match LAContext::new() {
        Ok(context) => context,
        Err(_) => return BiometricCapabilityStatus::Unavailable,
    };
    match context.can_evaluate_policy(LAPolicy::DeviceOwnerAuthenticationWithBiometrics) {
        Ok(true) => BiometricCapabilityStatus::Available,
        Ok(false) => BiometricCapabilityStatus::NotEnrolled,
        Err(_) => BiometricCapabilityStatus::Unavailable,
    }
}

#[cfg(target_os = "macos")]
fn request_macos_touch_id(message: &str) -> Result<bool, String> {
    use localauthentication::prelude::*;

    let context = LAContext::new().map_err(|error| error.to_string())?;
    context
        .set_localized_reason(message)
        .map_err(|error| error.to_string())?;
    match context.can_evaluate_policy(LAPolicy::DeviceOwnerAuthenticationWithBiometrics) {
        Ok(true) => context
            .evaluate_policy(LAPolicy::DeviceOwnerAuthenticationWithBiometrics, message)
            .map(|_| true)
            .map_err(|error| error.to_string()),
        Ok(false) => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_reason_is_non_empty() {
        assert!(!DEFAULT_BIOMETRIC_REASON.trim().is_empty());
    }

    #[test]
    fn empty_message_uses_default_reason() {
        let result = request_biometric_verification("");
        assert!(result.is_ok());
    }

    #[test]
    fn capability_probe_returns_known_variant() {
        let status = probe_biometric_capability();
        assert!(matches!(
            status,
            BiometricCapabilityStatus::Available
                | BiometricCapabilityStatus::NotEnrolled
                | BiometricCapabilityStatus::Unavailable
        ));
    }
}
