//! AUTH-K2 — single Rust boot owner for native session hydrate before JS auth UI.

use crate::commands::session::{force_session_restore_for_window, session_status_for_window};
use crate::native_keychain;
use crate::profiles::{DesktopProfileState, resolve_profile_for_window};
use crate::session::{SessionState, SessionStatus};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, WebviewWindow};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthBootSnapshotWire {
    pub profile_id: String,
    pub phase: String,
    pub stored_public_key_hex: Option<String>,
    pub session_public_key_hex: Option<String>,
    pub keychain_present: bool,
    pub restore_eligible: bool,
    pub at_unix_ms: u64,
}

fn normalize_public_key_hex(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    nostr::PublicKey::parse(trimmed)
        .ok()
        .map(|pubkey| pubkey.to_string())
}

fn derive_boot_phase(
    restore_eligible: bool,
    expected_public_key_hex: Option<&str>,
    session_public_key_hex: Option<&str>,
    session_active: bool,
    keychain_present: bool,
) -> String {
    if !restore_eligible {
        return "locked".to_string();
    }
    let expected = expected_public_key_hex.and_then(normalize_public_key_hex);
    let session = session_public_key_hex.and_then(normalize_public_key_hex);
    if session_active {
        if let (Some(expected), Some(session)) = (expected.as_ref(), session.as_ref()) {
            if expected != session {
                return "mismatch".to_string();
            }
        }
        return "unlocked".to_string();
    }
    if keychain_present {
        return "locked".to_string();
    }
    "locked".to_string()
}

fn session_status_to_snapshot(
    profile_id: String,
    expected_pubkey_hex: Option<String>,
    restore_eligible: bool,
    keychain_present: bool,
    status: SessionStatus,
) -> AuthBootSnapshotWire {
    let session_public_key_hex = status
        .npub
        .as_deref()
        .and_then(normalize_public_key_hex);
    let phase = derive_boot_phase(
        restore_eligible,
        expected_pubkey_hex.as_deref(),
        session_public_key_hex.as_deref(),
        status.is_active,
        keychain_present,
    );

    AuthBootSnapshotWire {
        profile_id,
        phase,
        stored_public_key_hex: expected_pubkey_hex,
        session_public_key_hex,
        keychain_present,
        restore_eligible,
        at_unix_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    }
}

/// Hydrate in-memory session from OS keychain for this window profile — canonical AUTH-K2 boot probe.
#[tauri::command]
pub async fn auth_boot_snapshot(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
    expected_pubkey_hex: Option<String>,
    restore_eligible: bool,
) -> Result<AuthBootSnapshotWire, String> {
    let profile_id = resolve_profile_for_window(&app, &profiles, &window).await?;
    let keychain_present = native_keychain::read_nsec_for_profile(&profile_id)?
        .is_some();

    let status = if restore_eligible {
        force_session_restore_for_window(
            &app,
            &window,
            session.inner(),
            &profiles,
            expected_pubkey_hex.clone(),
            true,
        )
        .await?
    } else if keychain_present {
        session_status_for_window(&app, &window, session.inner(), &profiles).await?
    } else {
        SessionStatus {
            is_active: false,
            npub: None,
            is_native: true,
        }
    };

    Ok(session_status_to_snapshot(
        profile_id,
        expected_pubkey_hex,
        restore_eligible,
        keychain_present,
        status,
    ))
}

#[cfg(test)]
mod tests {
    use super::derive_boot_phase;

    #[test]
    fn boot_phase_unlocked_when_session_matches_expected() {
        let hex = "0000000000000000000000000000000000000000000000000000000000000001";
        assert_eq!(
            derive_boot_phase(true, Some(hex), Some(hex), true, true),
            "unlocked"
        );
    }

    #[test]
    fn boot_phase_mismatch_when_session_differs_from_expected() {
        let a = "0000000000000000000000000000000000000000000000000000000000000001";
        let b = "0000000000000000000000000000000000000000000000000000000000000002";
        assert_eq!(
            derive_boot_phase(true, Some(a), Some(b), true, true),
            "mismatch"
        );
    }
}
