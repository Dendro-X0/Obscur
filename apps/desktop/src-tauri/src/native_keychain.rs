//! Canonical OS keychain entry names for per-profile native sessions.
//! `init_native_session` previously wrote a legacy entry (`nsec:: {profile_id}` with a space);
//! restore paths read `nsec::{profile_id}`. Reads migrate legacy → canonical on success.

#[cfg(not(target_os = "android"))]
use keyring::Entry;
#[cfg(not(target_os = "android"))]
use zeroize::Zeroizing;

pub const APP_SERVICE: &str = "app.obscur.desktop";
const KEY_NAME: &str = "nsec";
const LOGIN_ASSIST_KEY_NAME: &str = "login_assist";

pub fn key_name_for_profile(profile_id: &str) -> String {
    format!("{KEY_NAME}::{profile_id}")
}

pub fn login_assist_key_name_for_profile(profile_id: &str) -> String {
    format!("{LOGIN_ASSIST_KEY_NAME}_{}", profile_id.replace(':', "_"))
}

#[cfg(not(target_os = "android"))]
use std::collections::HashMap;
#[cfg(not(target_os = "android"))]
use std::sync::{LazyLock, Mutex};

#[cfg(not(target_os = "android"))]
static LOGIN_ASSIST_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[cfg(not(target_os = "android"))]
static NSEC_CACHE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[cfg(not(target_os = "android"))]
fn remember_nsec_payload(profile_id: &str, nsec: &str) {
    if let Ok(mut cache) = NSEC_CACHE.lock() {
        cache.insert(profile_id.to_string(), nsec.to_string());
    }
}

#[cfg(not(target_os = "android"))]
fn cached_nsec_payload(profile_id: &str) -> Option<String> {
    NSEC_CACHE
        .lock()
        .ok()
        .and_then(|cache| cache.get(profile_id).cloned())
}

#[cfg(not(target_os = "android"))]
fn forget_nsec_payload(profile_id: &str) {
    if let Ok(mut cache) = NSEC_CACHE.lock() {
        cache.remove(profile_id);
    }
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
    if let Some(cached) = cached_nsec_payload(profile_id) {
        return Ok(Some(cached));
    }
    let canonical = Entry::new(APP_SERVICE, &key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match read_password(&canonical) {
        Ok(nsec) => {
            remember_nsec_payload(profile_id, &nsec);
            return Ok(Some(nsec));
        }
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(e.to_string()),
    }

    let legacy = Entry::new(APP_SERVICE, &legacy_key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match read_password(&legacy) {
        Ok(nsec) => {
            let nsec_zero = Zeroizing::new(nsec);
            write_password(&canonical, &*nsec_zero).map_err(|e| e.to_string())?;
            let _ = delete_entry(&legacy);
            remember_nsec_payload(profile_id, &nsec_zero);
            eprintln!(
                "[SESSION] Migrated legacy keychain entry to canonical name for profile {}",
                profile_id
            );
            Ok(Some(nsec_zero.to_string()))
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
    let canonical = Entry::new(APP_SERVICE, &key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    write_password(&canonical, nsec).map_err(|e| e.to_string())?;
    // Best-effort cleanup of the legacy misnamed entry after a successful login/import.
    if let Ok(legacy) = Entry::new(APP_SERVICE, &legacy_key_name_for_profile(profile_id)) {
        let _ = delete_entry(&legacy);
    }
    match read_password(&canonical) {
        Ok(stored) if stored == nsec => {
            remember_nsec_payload(profile_id, nsec);
            Ok(())
        }
        Ok(_) => Err("Keychain entry did not round-trip".to_string()),
        Err(keyring::Error::NoEntry) => {
            // Windows Credential Manager can lag between Entry instances; keep in-process cache.
            remember_nsec_payload(profile_id, nsec);
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
pub fn delete_nsec_for_profile(profile_id: &str) -> Result<(), String> {
    forget_nsec_payload(profile_id);
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
