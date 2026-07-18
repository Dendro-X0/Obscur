//! Canonical OS keychain entry names for per-profile native sessions.
//! `init_native_session` previously wrote a legacy entry (`nsec:: {profile_id}` with a space);
//! restore paths read `nsec::{profile_id}`. Reads migrate legacy → canonical on success.
//! KEY-MOAT Phase 3: new writes store `OBSCUR_KCV1` wrapped envelopes — never plaintext `nsec1`.

#[cfg(not(target_os = "android"))]
use crate::keychain_session_envelope;
#[cfg(not(target_os = "android"))]
use keyring::Entry;
#[cfg(not(target_os = "android"))]
use zeroize::Zeroizing;

pub const APP_SERVICE: &str = "app.obscur.desktop";
const KEY_NAME: &str = "nsec";
const PDK_KEY_NAME: &str = "pdk";
const LOGIN_ASSIST_KEY_NAME: &str = "login_assist";

pub fn key_name_for_profile(profile_id: &str) -> String {
    format!("{KEY_NAME}::{profile_id}")
}

pub fn login_assist_key_name_for_profile(profile_id: &str) -> String {
    format!("{LOGIN_ASSIST_KEY_NAME}_{}", profile_id.replace(':', "_"))
}

pub fn pdk_key_name_for_profile(profile_id: &str) -> String {
    format!("{PDK_KEY_NAME}::{profile_id}")
}

#[cfg(not(target_os = "android"))]
use std::collections::HashMap;
#[cfg(not(target_os = "android"))]
use std::sync::{LazyLock, Mutex};

#[cfg(not(target_os = "android"))]
static LOGIN_ASSIST_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[cfg(not(target_os = "android"))]
static SESSION_SECRET_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[cfg(not(target_os = "android"))]
static PDK_SECRET_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[cfg(not(target_os = "android"))]
fn remember_session_secret_payload(profile_id: &str, secret: &str) {
    if let Ok(mut cache) = SESSION_SECRET_CACHE.lock() {
        cache.insert(profile_id.to_string(), secret.to_string());
    }
}

#[cfg(not(target_os = "android"))]
fn cached_session_secret_payload(profile_id: &str) -> Option<String> {
    SESSION_SECRET_CACHE
        .lock()
        .ok()
        .and_then(|cache| cache.get(profile_id).cloned())
}

#[cfg(not(target_os = "android"))]
fn forget_session_secret_payload(profile_id: &str) {
    if let Ok(mut cache) = SESSION_SECRET_CACHE.lock() {
        cache.remove(profile_id);
    }
}

#[cfg(not(target_os = "android"))]
fn decode_stored_session_payload(profile_id: &str, stored: &str) -> Result<Option<String>, String> {
    if keychain_session_envelope::is_wrapped_keychain_payload(stored) {
        return keychain_session_envelope::unwrap_session_secret_from_keychain(profile_id, stored);
    }
    if keychain_session_envelope::is_legacy_plaintext_keychain_secret(stored) {
        let secret_zero = Zeroizing::new(stored.trim().to_string());
        let wrapped =
            keychain_session_envelope::wrap_session_secret_for_keychain(profile_id, &secret_zero)?;
        let canonical =
            Entry::new(APP_SERVICE, &key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
        write_password(&canonical, &wrapped).map_err(|e| e.to_string())?;
        eprintln!(
            "[SESSION] Migrated plaintext keychain entry to wrapped envelope for profile {}",
            profile_id
        );
        return Ok(Some(secret_zero.to_string()));
    }
    Ok(None)
}

#[cfg(not(target_os = "android"))]
pub fn pubkey_hex_from_stored_keychain_payload(payload: &str) -> Option<String> {
    keychain_session_envelope::pubkey_hex_from_keychain_payload(payload)
}

#[cfg(target_os = "android")]
pub fn pubkey_hex_from_stored_keychain_payload(_payload: &str) -> Option<String> {
    None
}

#[cfg(not(target_os = "android"))]
fn remember_login_assist_payload(profile_id: &str, payload: &str) {
    if let Ok(mut cache) = LOGIN_ASSIST_CACHE.lock() {
        cache.insert(profile_id.to_string(), payload.to_string());
    }
}

#[cfg(not(target_os = "android"))]
fn cached_login_assist_payload(profile_id: &str) -> Option<String> {
    LOGIN_ASSIST_CACHE
        .lock()
        .ok()
        .and_then(|cache| cache.get(profile_id).cloned())
}

#[cfg(not(target_os = "android"))]
fn forget_login_assist_payload(profile_id: &str) {
    if let Ok(mut cache) = LOGIN_ASSIST_CACHE.lock() {
        cache.remove(profile_id);
    }
}

/// Legacy typo from early `init_native_session` — kept for one-time migration reads.
pub fn legacy_key_name_for_profile(profile_id: &str) -> String {
    format!("{KEY_NAME}:: {}", profile_id)
}

#[cfg(not(target_os = "android"))]
fn read_password(entry: &Entry) -> Result<String, keyring::Error> {
    entry.get_password()
}

#[cfg(not(target_os = "android"))]
fn write_password(entry: &Entry, nsec: &str) -> Result<(), keyring::Error> {
    entry.set_password(nsec)
}

#[cfg(not(target_os = "android"))]
fn delete_entry(entry: &Entry) -> Result<(), keyring::Error> {
    entry.delete_credential()
}

/// Read nsec for `profile_id`, migrating a legacy keychain entry when found.
#[cfg(not(target_os = "android"))]
pub fn read_nsec_for_profile(profile_id: &str) -> Result<Option<String>, String> {
    if let Some(cached) = cached_session_secret_payload(profile_id) {
        return Ok(Some(cached));
    }
    let canonical = Entry::new(APP_SERVICE, &key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match read_password(&canonical) {
        Ok(stored) => {
            let secret = decode_stored_session_payload(profile_id, &stored)?;
            if let Some(secret) = secret {
                remember_session_secret_payload(profile_id, &secret);
                return Ok(Some(secret));
            }
        }
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(e.to_string()),
    }

    let legacy = Entry::new(APP_SERVICE, &legacy_key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match read_password(&legacy) {
        Ok(stored) => {
            let secret = decode_stored_session_payload(profile_id, &stored)?;
            let Some(secret) = secret else {
                return Ok(None);
            };
            let secret_zero = Zeroizing::new(secret);
            let wrapped = keychain_session_envelope::wrap_session_secret_for_keychain(profile_id, &secret_zero)?;
            write_password(&canonical, &wrapped).map_err(|e| e.to_string())?;
            let _ = delete_entry(&legacy);
            remember_session_secret_payload(profile_id, &secret_zero);
            eprintln!(
                "[SESSION] Migrated legacy keychain entry to canonical wrapped envelope for profile {}",
                profile_id
            );
            Ok(Some(secret_zero.to_string()))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
pub fn read_nsec_for_profile(_profile_id: &str) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(target_os = "android"))]
pub fn write_nsec_for_profile(profile_id: &str, nsec: &str) -> Result<(), String> {
    let wrapped = keychain_session_envelope::wrap_session_secret_for_keychain(profile_id, nsec)?;
    let canonical = Entry::new(APP_SERVICE, &key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    write_password(&canonical, &wrapped).map_err(|e| e.to_string())?;
    // Best-effort cleanup of the legacy misnamed entry after a successful login/import.
    if let Ok(legacy) = Entry::new(APP_SERVICE, &legacy_key_name_for_profile(profile_id)) {
        let _ = delete_entry(&legacy);
    }
    match read_password(&canonical) {
        Ok(stored) if stored == wrapped => {
            remember_session_secret_payload(profile_id, nsec);
            Ok(())
        }
        Ok(_) => Err("Keychain entry did not round-trip".to_string()),
        Err(keyring::Error::NoEntry) => {
            // Windows Credential Manager can lag between Entry instances; keep in-process cache.
            remember_session_secret_payload(profile_id, nsec);
            eprintln!(
                "[SESSION] Keychain read-back missed for profile {}; using in-process cache",
                profile_id
            );
            Ok(())
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
pub fn write_nsec_for_profile(_profile_id: &str, _nsec: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "android"))]
fn remember_pdk_payload(profile_id: &str, payload: &str) {
    if let Ok(mut cache) = PDK_SECRET_CACHE.lock() {
        cache.insert(profile_id.to_string(), payload.to_string());
    }
}

#[cfg(not(target_os = "android"))]
fn cached_pdk_payload(profile_id: &str) -> Option<String> {
    PDK_SECRET_CACHE
        .lock()
        .ok()
        .and_then(|cache| cache.get(profile_id).cloned())
}

#[cfg(not(target_os = "android"))]
fn forget_pdk_payload(profile_id: &str) {
    if let Ok(mut cache) = PDK_SECRET_CACHE.lock() {
        cache.remove(profile_id);
    }
}

#[cfg(not(target_os = "android"))]
pub fn write_pdk_for_profile(profile_id: &str, key_material: &[u8; 32]) -> Result<(), String> {
    let wrapped = keychain_session_envelope::wrap_storage_key_material_for_keychain(profile_id, key_material)?;
    let entry = Entry::new(APP_SERVICE, &pdk_key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    write_password(&entry, &wrapped).map_err(|e| e.to_string())?;
    remember_pdk_payload(profile_id, &wrapped);
    Ok(())
}

#[cfg(not(target_os = "android"))]
pub fn read_pdk_for_profile(profile_id: &str) -> Result<Option<[u8; 32]>, String> {
    if let Some(cached) = cached_pdk_payload(profile_id) {
        return keychain_session_envelope::unwrap_storage_key_material_from_keychain(profile_id, &cached);
    }
    let entry = Entry::new(APP_SERVICE, &pdk_key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match read_password(&entry) {
        Ok(payload) => {
            remember_pdk_payload(profile_id, &payload);
            keychain_session_envelope::unwrap_storage_key_material_from_keychain(profile_id, &payload)
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(not(target_os = "android"))]
pub fn delete_pdk_for_profile(profile_id: &str) -> Result<(), String> {
    forget_pdk_payload(profile_id);
    let entry = Entry::new(APP_SERVICE, &pdk_key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match delete_entry(&entry) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
pub fn write_pdk_for_profile(_profile_id: &str, _key_material: &[u8; 32]) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "android")]
pub fn read_pdk_for_profile(_profile_id: &str) -> Result<Option<[u8; 32]>, String> {
    Ok(None)
}

#[cfg(target_os = "android")]
pub fn delete_pdk_for_profile(_profile_id: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "android"))]
pub fn delete_nsec_for_profile(profile_id: &str) -> Result<(), String> {
    forget_session_secret_payload(profile_id);
    let _ = delete_pdk_for_profile(profile_id);
    for key_name in [
        key_name_for_profile(profile_id),
        legacy_key_name_for_profile(profile_id),
    ] {
        let entry = Entry::new(APP_SERVICE, &key_name).map_err(|e| e.to_string())?;
        match delete_entry(&entry) {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

#[cfg(target_os = "android")]
pub fn delete_nsec_for_profile(_profile_id: &str) -> Result<(), String> {
    Ok(())
}

/// Read saved username/password JSON for local login assist (no private key material).
#[cfg(not(target_os = "android"))]
pub fn read_login_assist_for_profile(profile_id: &str) -> Result<Option<String>, String> {
    if let Some(cached) = cached_login_assist_payload(profile_id) {
        return Ok(Some(cached));
    }
    let entry = Entry::new(APP_SERVICE, &login_assist_key_name_for_profile(profile_id))
        .map_err(|e| e.to_string())?;
    match read_password(&entry) {
        Ok(payload) => {
            remember_login_assist_payload(profile_id, &payload);
            Ok(Some(payload))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
pub fn read_login_assist_for_profile(_profile_id: &str) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(target_os = "android"))]
pub fn write_login_assist_for_profile(profile_id: &str, payload: &str) -> Result<(), String> {
    let entry = Entry::new(APP_SERVICE, &login_assist_key_name_for_profile(profile_id))
        .map_err(|e| e.to_string())?;
    write_password(&entry, payload).map_err(|e| e.to_string())?;
    match read_password(&entry) {
        Ok(stored) if stored == payload => {
            remember_login_assist_payload(profile_id, payload);
            Ok(())
        }
        Ok(_) => Err("Login assist keychain entry did not round-trip".to_string()),
        Err(keyring::Error::NoEntry) => {
            // Windows Credential Manager can lag between Entry instances; keep in-process cache.
            remember_login_assist_payload(profile_id, payload);
            eprintln!(
                "[LOGIN_ASSIST] Keychain read-back missed for profile {}; using in-process cache",
                profile_id
            );
            Ok(())
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
pub fn write_login_assist_for_profile(_profile_id: &str, _payload: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "android"))]
pub fn delete_login_assist_for_profile(profile_id: &str) -> Result<(), String> {
    forget_login_assist_payload(profile_id);
    let entry = Entry::new(APP_SERVICE, &login_assist_key_name_for_profile(profile_id))
        .map_err(|e| e.to_string())?;
    match delete_entry(&entry) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
pub fn delete_login_assist_for_profile(_profile_id: &str) -> Result<(), String> {
    Ok(())
}
