use nostr::nips::nip44::{self, Version};
use nostr::{SecretKey, PublicKey};
use std::str::FromStr;

/// NIP-44 Encryption (v2).
pub fn encrypt_nip44(secret_key_hex: &str, public_key_hex: &str, content: &str) -> Result<String, String> {
    let sk = SecretKey::from_str(secret_key_hex).map_err(|e| e.to_string())?;
    let pk = PublicKey::from_str(public_key_hex).map_err(|e| e.to_string())?;

    nip44::encrypt(&sk, &pk, content, Version::V2).map_err(|e| e.to_string())
}

/// NIP-44 Decryption (v2).
pub fn decrypt_nip44(secret_key_hex: &str, public_key_hex: &str, payload: &str) -> Result<String, String> {
    let sk = SecretKey::from_str(secret_key_hex).map_err(|e| e.to_string())?;
    let pk = PublicKey::from_str(public_key_hex).map_err(|e| e.to_string())?;

    nip44::decrypt(&sk, &pk, payload).map_err(|e| e.to_string())
}
