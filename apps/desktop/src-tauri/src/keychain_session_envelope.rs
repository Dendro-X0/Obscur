//! OS keychain session envelope — KEY-MOAT Phase 3 (K2).
//! Stores AES-GCM wrapped signing material instead of plaintext `nsec1…` strings.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

pub const KEYCHAIN_ENVELOPE_PREFIX: &str = "OBSCUR_KCV1:";
pub const KEYCHAIN_ENVELOPE_ALG: &str = "AES-256-GCM/DEVICE";
const KEYCHAIN_WRAP_CONTEXT: &[u8] = b"obscur.keychain-wrap.v1";

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
struct KeychainSessionEnvelope {
    v: u8,
    alg: String,
    pubkey_hex: String,
    iv_b64: String,
    ciphertext_b64: String,
}

fn derive_wrap_key(profile_id: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(KEYCHAIN_WRAP_CONTEXT);
    hasher.update(profile_id.trim().as_bytes());
    hasher.finalize().into()
}

fn normalize_secret_to_hex(secret_material: &str) -> Result<String, String> {
    let trimmed = secret_material.trim();
    if trimmed.is_empty() {
        return Err("Empty session secret".to_string());
    }
    if trimmed.starts_with("nsec") {
        let keys = nostr::Keys::parse(trimmed).map_err(|e| e.to_string())?;
        return Ok(keys.secret_key().to_secret_hex());
    }
    nostr::SecretKey::from_hex(trimmed)
        .map(|secret_key| nostr::Keys::new(secret_key).secret_key().to_secret_hex())
        .map_err(|e| e.to_string())
}

pub fn is_wrapped_keychain_payload(payload: &str) -> bool {
    payload.starts_with(KEYCHAIN_ENVELOPE_PREFIX)
}

pub fn is_legacy_plaintext_keychain_secret(payload: &str) -> bool {
    let trimmed = payload.trim();
    trimmed.starts_with("nsec1") || (trimmed.len() == 64 && trimmed.chars().all(|c| c.is_ascii_hexdigit()))
}

pub fn pubkey_hex_from_keychain_payload(payload: &str) -> Option<String> {
    if is_wrapped_keychain_payload(payload) {
        let json = payload.trim_start_matches(KEYCHAIN_ENVELOPE_PREFIX);
        let envelope: KeychainSessionEnvelope = serde_json::from_str(json).ok()?;
        let normalized = envelope.pubkey_hex.trim().to_lowercase();
        if normalized.len() == 64 && normalized.chars().all(|c| c.is_ascii_hexdigit()) {
            return Some(normalized);
        }
        return None;
    }
    let trimmed = payload.trim();
    if let Ok(keys) = nostr::Keys::parse(trimmed) {
        return Some(keys.public_key().to_string());
    }
    nostr::SecretKey::from_hex(trimmed)
        .ok()
        .map(|secret_key| nostr::Keys::new(secret_key).public_key().to_string())
}

pub fn wrap_session_secret_for_keychain(
    profile_id: &str,
    secret_material: &str,
) -> Result<String, String> {
    let secret_hex = Zeroizing::new(normalize_secret_to_hex(secret_material)?);
    let pubkey_hex = nostr::SecretKey::from_hex(&*secret_hex)
        .map_err(|e| e.to_string())
        .map(|secret_key| nostr::Keys::new(secret_key).public_key().to_string())?;

    let key = derive_wrap_key(profile_id);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut iv = [0u8; 12];
    getrandom::getrandom(&mut iv).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&iv), secret_hex.as_bytes())
        .map_err(|e| e.to_string())?;

    let envelope = KeychainSessionEnvelope {
        v: 1,
        alg: KEYCHAIN_ENVELOPE_ALG.to_string(),
        pubkey_hex,
        iv_b64: base64::engine::general_purpose::STANDARD.encode(iv),
        ciphertext_b64: base64::engine::general_purpose::STANDARD.encode(ciphertext),
    };
    let json = serde_json::to_string(&envelope).map_err(|e| e.to_string())?;
    Ok(format!("{KEYCHAIN_ENVELOPE_PREFIX}{json}"))
}

pub fn unwrap_session_secret_from_keychain(
    profile_id: &str,
    payload: &str,
) -> Result<Option<String>, String> {
    if is_legacy_plaintext_keychain_secret(payload) {
        return Ok(Some(payload.trim().to_string()));
    }
    if !is_wrapped_keychain_payload(payload) {
        return Ok(None);
    }
    let json = payload.trim_start_matches(KEYCHAIN_ENVELOPE_PREFIX);
    let envelope: KeychainSessionEnvelope =
        serde_json::from_str(json).map_err(|e| format!("Invalid keychain envelope: {e}"))?;
    if envelope.alg != KEYCHAIN_ENVELOPE_ALG || envelope.v != 1 {
        return Err("Unsupported keychain envelope version".to_string());
    }

    let key = derive_wrap_key(profile_id);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let iv = base64::engine::general_purpose::STANDARD
        .decode(envelope.iv_b64.trim())
        .map_err(|e| e.to_string())?;
    if iv.len() != 12 {
        return Err("Invalid keychain envelope IV".to_string());
    }
    let ciphertext = base64::engine::general_purpose::STANDARD
        .decode(envelope.ciphertext_b64.trim())
        .map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| "Keychain envelope decrypt failed".to_string())?;
    let secret_hex = String::from_utf8(plaintext).map_err(|_| "Invalid keychain secret payload".to_string())?;
    Ok(Some(secret_hex))
}

pub const KEYCHAIN_PDK_ENVELOPE_PREFIX: &str = "OBSCUR_PDK1:";
const KEYCHAIN_PDK_WRAP_CONTEXT: &[u8] = b"obscur.keychain-pdk-wrap.v1";

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
struct KeychainStorageKeyEnvelope {
    v: u8,
    alg: String,
    iv_b64: String,
    ciphertext_b64: String,
}

fn derive_pdk_wrap_key(profile_id: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(KEYCHAIN_PDK_WRAP_CONTEXT);
    hasher.update(profile_id.trim().as_bytes());
    hasher.finalize().into()
}

pub fn wrap_storage_key_material_for_keychain(
    profile_id: &str,
    key_material: &[u8; 32],
) -> Result<String, String> {
    let key = derive_pdk_wrap_key(profile_id);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut iv = [0u8; 12];
    getrandom::getrandom(&mut iv).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&iv), key_material.as_ref())
        .map_err(|e| e.to_string())?;

    let envelope = KeychainStorageKeyEnvelope {
        v: 1,
        alg: KEYCHAIN_ENVELOPE_ALG.to_string(),
        iv_b64: base64::engine::general_purpose::STANDARD.encode(iv),
        ciphertext_b64: base64::engine::general_purpose::STANDARD.encode(ciphertext),
    };
    let json = serde_json::to_string(&envelope).map_err(|e| e.to_string())?;
    Ok(format!("{KEYCHAIN_PDK_ENVELOPE_PREFIX}{json}"))
}

pub fn unwrap_storage_key_material_from_keychain(
    profile_id: &str,
    payload: &str,
) -> Result<Option<[u8; 32]>, String> {
    if !payload.starts_with(KEYCHAIN_PDK_ENVELOPE_PREFIX) {
        return Ok(None);
    }
    let json = payload.trim_start_matches(KEYCHAIN_PDK_ENVELOPE_PREFIX);
    let envelope: KeychainStorageKeyEnvelope =
        serde_json::from_str(json).map_err(|e| format!("Invalid storage key envelope: {e}"))?;
    if envelope.alg != KEYCHAIN_ENVELOPE_ALG || envelope.v != 1 {
        return Err("Unsupported storage key envelope version".to_string());
    }

    let key = derive_pdk_wrap_key(profile_id);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let iv = base64::engine::general_purpose::STANDARD
        .decode(envelope.iv_b64.trim())
        .map_err(|e| e.to_string())?;
    if iv.len() != 12 {
        return Err("Invalid storage key envelope IV".to_string());
    }
    let ciphertext = base64::engine::general_purpose::STANDARD
        .decode(envelope.ciphertext_b64.trim())
        .map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| "Storage key envelope decrypt failed".to_string())?;
    if plaintext.len() != 32 {
        return Err("Storage key envelope payload must be 32 bytes".to_string());
    }
    let mut key_material = [0u8; 32];
    key_material.copy_from_slice(&plaintext);
    Ok(Some(key_material))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrapped_payload_has_no_nsec_prefix() {
        let hex = "0000000000000000000000000000000000000000000000000000000000000001";
        let wrapped = wrap_session_secret_for_keychain("default", hex).expect("wrap");
        assert!(wrapped.starts_with(KEYCHAIN_ENVELOPE_PREFIX));
        assert!(!wrapped.contains("nsec1"));
    }

    #[test]
    fn roundtrip_wrap_unwrap_hex_secret() {
        let hex = "0000000000000000000000000000000000000000000000000000000000000001";
        let wrapped = wrap_session_secret_for_keychain("profile-a", hex).expect("wrap");
        let restored = unwrap_session_secret_from_keychain("profile-a", &wrapped)
            .expect("unwrap")
            .expect("secret");
        assert_eq!(restored, hex);
    }

    #[test]
    fn pubkey_hint_available_without_unwrap() {
        let hex = "0000000000000000000000000000000000000000000000000000000000000001";
        let wrapped = wrap_session_secret_for_keychain("default", hex).expect("wrap");
        let pubkey = pubkey_hex_from_keychain_payload(&wrapped);
        assert!(pubkey.is_some());
        assert!(!pubkey.unwrap_or_default().starts_with("nsec"));
    }

    #[test]
    fn legacy_plaintext_detected() {
        assert!(is_legacy_plaintext_keychain_secret(
            "nsec1abcdefghijklmnopqrstuvwxyz01234567890123456789012"
        ));
        assert!(is_legacy_plaintext_keychain_secret(
            "0000000000000000000000000000000000000000000000000000000000000001"
        ));
    }
}
