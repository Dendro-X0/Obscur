//! deriveSharedSecret — wire-compatible with CryptoServiceImpl.
//! Algorithm: SHA-256(utf8(private_key_hex + public_key_hex)) — not ECDH.
//! @see specs/backend/crypto-native-shared-secret-design-2026-10.md

use sha2::{Digest, Sha256};

/// Returns 64-char lowercase hex digest.
pub fn derive_shared_secret(private_key_hex: &str, public_key_hex: &str) -> String {
    let combined = format!("{}{}", private_key_hex, public_key_hex);
    ::hex::encode(Sha256::digest(combined.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_shared_secret_is_deterministic_64_hex() {
        let sk = "aa".repeat(32);
        let pk = "bb".repeat(32);
        let a = derive_shared_secret(&sk, &pk);
        let b = derive_shared_secret(&sk, &pk);
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        let other = derive_shared_secret(&sk, &"cc".repeat(32));
        assert_ne!(a, other);
    }
}
