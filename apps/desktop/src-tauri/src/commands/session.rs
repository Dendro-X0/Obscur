// Session management commands for native authentication

use tauri::{AppHandle, WebviewWindow};
use crate::native_keychain;
use crate::profiles::{DesktopProfileState, resolve_profile_for_window};
use crate::session::{SessionResponse, SessionState, SessionStatus};
use nostr::{Keys, SecretKey, ToBech32};

fn normalize_public_key_hex(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    nostr::PublicKey::parse(trimmed).ok().map(|pubkey| pubkey.to_string())
}

/// Keychain may hold wrapped OBSCUR_KCV1 envelopes or legacy plaintext bech32/hex secrets.
fn public_key_hex_from_keychain_secret(key_str: &str) -> Option<String> {
    if let Some(pubkey) = native_keychain::pubkey_hex_from_stored_keychain_payload(key_str) {
        return Some(pubkey);
    }
    let trimmed = key_str.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(keys) = Keys::parse(trimmed) {
        return Some(keys.public_key().to_string());
    }
    SecretKey::from_hex(trimmed)
        .ok()
        .map(|secret_key| Keys::new(secret_key).public_key().to_string())
}

async fn hydrate_profile_session(
    session: &SessionState,
    profile_id: &str,
) -> Result<Option<SessionStatus>, String> {
    if let Some(keys) = session.get_keys(profile_id).await {
        return Ok(Some(SessionStatus {
            is_active: true,
            npub: Some(keys.public_key().to_string()),
            is_native: true,
        }));
    }
    if let Some(nsec) = native_keychain::read_nsec_for_profile(profile_id)? {
        session.set_keys(profile_id, &nsec).await?;
        if let Some(keys) = session.get_keys(profile_id).await {
            eprintln!(
                "[SESSION] Native session re-hydrated from OS keychain for profile {}",
                profile_id
            );
            return Ok(Some(SessionStatus {
                is_active: true,
                npub: Some(keys.public_key().to_string()),
                is_native: true,
            }));
        }
    }
    Ok(None)
}

async fn find_profile_id_with_matching_keychain_pubkey(
    profiles: &DesktopProfileState,
    expected_pubkey_hex: &str,
) -> Result<Option<String>, String> {
    let expected = normalize_public_key_hex(expected_pubkey_hex)
        .ok_or_else(|| "expected_pubkey_hex is invalid".to_string())?;
    for profile in profiles.list_profiles().await {
        let Some(stored) = read_raw_keychain_payload(&profile.profile_id)? else {
            continue;
        };
        let Some(pubkey_hex) = public_key_hex_from_keychain_secret(&stored) else {
            continue;
        };
        let normalized = normalize_public_key_hex(&pubkey_hex).unwrap_or(pubkey_hex);
        if normalized == expected {
            return Ok(Some(profile.profile_id));
        }
    }
    Ok(None)
}

#[cfg(not(target_os = "android"))]
fn read_raw_keychain_payload(profile_id: &str) -> Result<Option<String>, String> {
    use keyring::Entry;
    let canonical = Entry::new(native_keychain::APP_SERVICE, &native_keychain::key_name_for_profile(profile_id))
        .map_err(|e| e.to_string())?;
    match canonical.get_password() {
        Ok(payload) => Ok(Some(payload)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
fn read_raw_keychain_payload(_profile_id: &str) -> Result<Option<String>, String> {
    Ok(None)
}

/// First profile in registry order that has a readable keychain entry (window profile wins ties).
async fn find_any_keychain_profile_id(
    profiles: &DesktopProfileState,
    preferred_profile_id: &str,
) -> Result<Option<String>, String> {
    if native_keychain::read_nsec_for_profile(preferred_profile_id)?.is_some() {
        return Ok(Some(preferred_profile_id.to_string()));
    }
    for profile in profiles.list_profiles().await {
        if profile.profile_id == preferred_profile_id {
            continue;
        }
        if native_keychain::read_nsec_for_profile(&profile.profile_id)?.is_some() {
            return Ok(Some(profile.profile_id));
        }
    }
    Ok(None)
}

/// Hydrate session for this window, rebinding to the profile that owns the keychain entry when needed.
/// When `strict_profile_scope` is true (AUTH-KERN-4 auth boot), only the window-bound profile keychain is used.
pub async fn force_session_restore_for_window(
    app: &AppHandle,
    window: &WebviewWindow,
    session: &SessionState,
    profiles: &tauri::State<'_, DesktopProfileState>,
    expected_pubkey_hex: Option<String>,
    strict_profile_scope: bool,
) -> Result<SessionStatus, String> {
    let window_label = window.label().to_string();
    let mut profile_id = resolve_profile_for_window(app, profiles, window).await?;

    if let Some(status) = hydrate_profile_session(session, &profile_id).await? {
        if let Some(expected) = expected_pubkey_hex.as_deref() {
            let expected_normalized = normalize_public_key_hex(expected);
            let active_normalized = status
                .npub
                .as_deref()
                .and_then(normalize_public_key_hex);
            if expected_normalized.is_some()
                && active_normalized.is_some()
                && expected_normalized != active_normalized
            {
                if strict_profile_scope {
                    return Ok(status);
                }
                // Window profile keychain does not match stored identity — scan other profiles.
            } else {
                return Ok(status);
            }
        } else {
            return Ok(status);
        }
    }

    if strict_profile_scope {
        return Ok(SessionStatus {
            is_active: false,
            npub: None,
            is_native: true,
        });
    }

    if let Some(expected) = expected_pubkey_hex.as_deref() {
        if let Some(matching_profile_id) =
            find_profile_id_with_matching_keychain_pubkey(profiles.inner(), expected).await?
        {
            if matching_profile_id != profile_id {
                eprintln!(
                    "[SESSION] Rebinding window '{}' from profile {} to {} for keychain restore",
                    window_label, profile_id, matching_profile_id
                );
                profiles
                    .bind_window_profile(app, &window_label, &matching_profile_id)
                    .await?;
                profile_id = matching_profile_id;
            }
            if let Some(status) = hydrate_profile_session(session, &profile_id).await? {
                return Ok(status);
            }
        }
    }

    if let Some(matching_profile_id) =
        find_any_keychain_profile_id(profiles.inner(), &profile_id).await?
    {
        if matching_profile_id != profile_id {
            eprintln!(
                "[SESSION] Rebinding window '{}' from profile {} to {} for any-keychain restore",
                window_label, profile_id, matching_profile_id
            );
            profiles
                .bind_window_profile(app, &window_label, &matching_profile_id)
                .await?;
            profile_id = matching_profile_id;
        }
        if let Some(status) = hydrate_profile_session(session, &profile_id).await? {
            return Ok(status);
        }
    }

    Ok(SessionStatus {
        is_active: false,
        npub: None,
        is_native: true,
    })
}

pub async fn session_status_for_window(
    app: &AppHandle,
    window: &WebviewWindow,
    session: &SessionState,
    profiles: &tauri::State<'_, DesktopProfileState>,
) -> Result<SessionStatus, String> {
    let profile_id = resolve_profile_for_window(app, profiles, window).await?;
    if session.get_keys(&profile_id).await.is_none() {
        if let Ok(Some(nsec)) = native_keychain::read_nsec_for_profile(&profile_id) {
            let _ = session.set_keys(&profile_id, &nsec).await;
        }
    }
    let keys_opt = session.get_keys(&profile_id).await;
    let npub = keys_opt.map(|k| k.public_key().to_string());
    let is_active = npub.is_some();

    Ok(SessionStatus {
        is_active,
        npub,
        is_native: true,
    })
}

#[tauri::command]
pub async fn desktop_force_session_restore(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
    expected_pubkey_hex: Option<String>,
) -> Result<SessionStatus, String> {
    force_session_restore_for_window(
        &app,
        &window,
        session.inner(),
        &profiles,
        expected_pubkey_hex,
        false,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::public_key_hex_from_keychain_secret;

    #[test]
    fn keychain_secret_pubkey_from_wrapped_envelope() {
        let hex = "0000000000000000000000000000000000000000000000000000000000000001";
        let wrapped = crate::keychain_session_envelope::wrap_session_secret_for_keychain("default", hex)
            .expect("wrap");
        let pubkey = public_key_hex_from_keychain_secret(&wrapped);
        assert!(pubkey.is_some(), "wrapped keychain payloads must expose pubkey hint for restore scan");
        assert!(!wrapped.contains("nsec1"));
    }
}

#[tauri::command]
pub async fn init_native_session(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
    nsec: String,
) -> Result<SessionResponse, String> {
    let profile_id = resolve_profile_for_window(&app, &profiles, &window).await?;
    match session.set_keys(&profile_id, &nsec).await {
        Ok(_pubkey) => {
            let keys = session
                .get_keys(&profile_id)
                .await
                .ok_or_else(|| "Session keys missing after init".to_string())?;
            let nsec_for_keychain = keys
                .secret_key()
                .to_bech32()
                .map_err(|e| e.to_string())?;
            native_keychain::write_nsec_for_profile(&profile_id, &nsec_for_keychain)?;
            if native_keychain::read_nsec_for_profile(&profile_id)?.is_none() {
                eprintln!(
                    "[SESSION] Native session keys active in memory for profile {} (keychain verify pending)",
                    profile_id
                );
            }
            let npub = keys.public_key().to_bech32().map_err(|e| e.to_string())?;
            eprintln!("[SESSION] Native session initialized and persisted for {} on profile {}", npub, profile_id);
            Ok(SessionResponse {
                success: true,
                npub: Some(npub),
                message: None,
            })
        }
        Err(e) => Ok(SessionResponse {
            success: false,
            npub: None,
            message: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn clear_native_session(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<(), String> {
    let profile_id = resolve_profile_for_window(&app, &profiles, &window).await?;
    session.clear(Some(&profile_id)).await;
    eprintln!("[SESSION] Native session cleared for profile {}", profile_id);
    Ok(())
}

#[tauri::command]
pub async fn get_session_status(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<crate::session::SessionStatus, String> {
    session_status_for_window(&app, &window, session.inner(), &profiles).await
}
