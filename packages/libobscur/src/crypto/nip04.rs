use std::str::FromStr;

use nostr::nips::nip04 as nostr_nip04;
use nostr::{PublicKey, SecretKey};

fn parse_secret_key(secret_key_hex: &str) -> Result<SecretKey, String> {
    SecretKey::from_str(secret_key_hex).map_err(|e| e.to_string())
}

fn parse_public_key(public_key: &str) -> Result<PublicKey, String> {
    PublicKey::from_str(public_key).map_err(|e| e.to_string())
}

/// NIP-04 encryption using the canonical `nostr` implementation.
pub fn encrypt_nip04(
    secret_key_hex: &str,
    public_key_hex: &str,
    content: &str,
) -> Result<String, String> {
    let secret_key = parse_secret_key(secret_key_hex)?;
    let public_key = parse_public_key(public_key_hex)?;
    nostr_nip04::encrypt(&secret_key, &public_key, content).map_err(|e| e.to_string())
}

/// NIP-04 decryption using the canonical `nostr` implementation.
pub fn decrypt_nip04(
    secret_key_hex: &str,
    public_key_hex: &str,
    encrypted_content: &str,
) -> Result<String, String> {
    let secret_key = parse_secret_key(secret_key_hex)?;
    let public_key = parse_public_key(public_key_hex)?;
    nostr_nip04::decrypt(&secret_key, &public_key, encrypted_content).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::nip01::generate_key_pair;

    #[test]
    fn test_nip04_roundtrip() {
        let (sk1, pk1) = generate_key_pair();
        let (sk2, pk2) = generate_key_pair();
        
        let message = "Hello, Nostr!";
        
        let encrypted = encrypt_nip04(&sk1, &pk2, message).unwrap();
        let decrypted = decrypt_nip04(&sk2, &pk1, &encrypted).unwrap();
        
        assert_eq!(message, decrypted);
    }
}
