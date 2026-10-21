//! Invite AES-256-GCM — wire-compatible with CryptoServiceImpl.encryptInviteData.
//! Format: `base64(iv || ciphertext_with_tag)` (no ?v= suffix).
//! @see specs/backend/crypto-native-invite-aes-design-2026-10.md

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

const IV_LEN: usize = 12;
const KEY_LEN: usize = 32;
const MIN_COMBINED_LEN: usize = IV_LEN + 16;

fn parse_key_hex(key_hex: &str) -> Result<[u8; KEY_LEN], String> {
    let normalized = key_hex.trim().to_lowercase();
    if normalized.len() != 64 || !normalized.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("keyHex must be 64-char hex".to_string());
    }
    let mut key = [0u8; KEY_LEN];
    for i in 0..KEY_LEN {
        key[i] = u8::from_str_radix(&normalized[i * 2..i * 2 + 2], 16)
            .map_err(|_| "keyHex must be 64-char hex".to_string())?;
    }
    Ok(key)
}

pub fn encrypt_invite_data(plaintext: &str, key_hex: &str) -> Result<String, String> {
    let key = parse_key_hex(key_hex)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut iv = [0u8; IV_LEN];
    getrandom::getrandom(&mut iv).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&iv), plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut combined = Vec::with_capacity(IV_LEN + ciphertext.len());
    combined.extend_from_slice(&iv);
    combined.extend_from_slice(&ciphertext);
    Ok(BASE64.encode(combined))
}

pub fn decrypt_invite_data(ciphertext: &str, key_hex: &str) -> Result<String, String> {
    let key = parse_key_hex(key_hex)?;
    let combined = BASE64
        .decode(ciphertext.trim())
        .map_err(|_| "Invalid invite cipher encoding".to_string())?;
    if combined.len() < MIN_COMBINED_LEN {
        return Err("Invalid invite cipher payload length".to_string());
    }
    let iv = &combined[..IV_LEN];
    let encrypted = &combined[IV_LEN..];
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(iv), encrypted)
        .map_err(|_| "Invite decryption failed".to_string())?;
    String::from_utf8(plaintext).map_err(|_| "Invite plaintext is not UTF-8".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let key = "ab".repeat(32);
        let wire = encrypt_invite_data("invite-payload", &key).expect("encrypt");
        assert!(!wire.contains("?v="));
        let plain = decrypt_invite_data(&wire, &key).expect("decrypt");
        assert_eq!(plain, "invite-payload");
    }

    #[test]
    fn rejects_bad_key() {
        assert!(encrypt_invite_data("x", "short").is_err());
    }
}
