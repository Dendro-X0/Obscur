//! Group room-key AES-256-GCM — wire-compatible with CryptoServiceImpl / community-bot.
//! Format: `base64(iv || ciphertext_with_tag)?v=1` where IV is 12 bytes.
//! @see specs/backend/crypto-native-group-encrypt-design-2026-10.md

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

const IV_LEN: usize = 12;
const KEY_LEN: usize = 32;
const MIN_COMBINED_LEN: usize = IV_LEN + 16; // IV + GCM tag minimum

fn parse_room_key_hex(room_key_hex: &str) -> Result<[u8; KEY_LEN], String> {
    let normalized = room_key_hex.trim().to_lowercase();
    if normalized.len() != 64 || !normalized.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("roomKeyHex must be 64-char hex".to_string());
    }
    let mut key = [0u8; KEY_LEN];
    for i in 0..KEY_LEN {
        key[i] = u8::from_str_radix(&normalized[i * 2..i * 2 + 2], 16)
            .map_err(|_| "roomKeyHex must be 64-char hex".to_string())?;
    }
    Ok(key)
}

/// Generate a fresh 32-byte room key as lowercase hex.
pub fn generate_group_room_key() -> Result<String, String> {
    let mut key = [0u8; KEY_LEN];
    getrandom::getrandom(&mut key).map_err(|e| e.to_string())?;
    Ok(key.iter().map(|b| format!("{b:02x}")).collect())
}

/// Encrypt plaintext with room key → `base64(iv||ct)?v=1`.
pub fn encrypt_group_message(plaintext: &str, room_key_hex: &str) -> Result<String, String> {
    let key = parse_room_key_hex(room_key_hex)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut iv = [0u8; IV_LEN];
    getrandom::getrandom(&mut iv).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&iv), plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut combined = Vec::with_capacity(IV_LEN + ciphertext.len());
    combined.extend_from_slice(&iv);
    combined.extend_from_slice(&ciphertext);
    Ok(format!("{}?v=1", BASE64.encode(combined)))
}

/// Decrypt wire payload produced by encrypt_group_message / JS twin.
pub fn decrypt_group_message(ciphertext: &str, room_key_hex: &str) -> Result<String, String> {
    let key = parse_room_key_hex(room_key_hex)?;
    let clean = ciphertext.split("?v=").next().unwrap_or(ciphertext);
    let combined = BASE64
        .decode(clean.trim())
        .map_err(|_| "Invalid cipher payload encoding".to_string())?;
    if combined.len() < MIN_COMBINED_LEN {
        return Err("Invalid cipher payload length".to_string());
    }
    let iv = &combined[..IV_LEN];
    let encrypted = &combined[IV_LEN..];
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(iv), encrypted)
        .map_err(|_| "Group message decryption failed".to_string())?;
    String::from_utf8(plaintext).map_err(|_| "Group message plaintext is not UTF-8".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_matches_wire_suffix() {
        let key = generate_group_room_key().expect("key");
        assert_eq!(key.len(), 64);
        let wire = encrypt_group_message("hello group", &key).expect("encrypt");
        assert!(wire.ends_with("?v=1"));
        let plain = decrypt_group_message(&wire, &key).expect("decrypt");
        assert_eq!(plain, "hello group");
    }

    #[test]
    fn decrypt_accepts_payload_without_version_suffix() {
        let key = generate_group_room_key().expect("key");
        let wire = encrypt_group_message("no-suffix", &key).expect("encrypt");
        let bare = wire.split("?v=").next().unwrap();
        let plain = decrypt_group_message(bare, &key).expect("decrypt");
        assert_eq!(plain, "no-suffix");
    }

    #[test]
    fn rejects_bad_key() {
        assert!(encrypt_group_message("x", "deadbeef").is_err());
    }
}
