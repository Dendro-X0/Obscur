//! Canonical OS keychain entry names for per-profile native sessions.
//! `init_native_session` previously wrote a legacy entry (`nsec:: {profile_id}` with a space);
//! restore paths read `nsec::{profile_id}`. Reads migrate legacy → canonical on success.

use keyring::Entry;
#[cfg(not(target_os = "android"))]
use zeroize::Zeroizing;

pub const APP_SERVICE: &str = "app.obscur.desktop";
const KEY_NAME: &str = "nsec";

pub fn key_name_for_profile(profile_id: &str) -> String {
    format!("{KEY_NAME}::{profile_id}")
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
    let canonical = Entry::new(APP_SERVICE, &key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match read_password(&canonical) {
        Ok(nsec) => return Ok(Some(nsec)),
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(e.to_string()),
    }

    let legacy = Entry::new(APP_SERVICE, &legacy_key_name_for_profile(profile_id)).map_err(|e| e.to_string())?;
    match read_password(&legacy) {
        Ok(nsec) => {
            let nsec_zero = Zeroizing::new(nsec);
            write_password(&canonical, &*nsec_zero).map_err(|e| e.to_string())?;
            let _ = delete_entry(&legacy);
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
    Ok(())
}

#[cfg(target_os = "android")]
pub fn write_nsec_for_profile(_profile_id: &str, _nsec: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "android"))]
pub fn delete_nsec_for_profile(profile_id: &str) -> Result<(), String> {
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
