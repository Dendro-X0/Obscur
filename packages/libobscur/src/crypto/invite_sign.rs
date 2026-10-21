//! Invite contact-card sign/verify — SHA-256(canonical) + schnorr.
//! Canonical string is produced in TS (wire-compatible with CryptoServiceImpl).
//! @see specs/backend/crypto-native-invite-sign-design-2026-10.md

use sha2::{Digest, Sha256};

use crate::crypto::nip01;

fn hash_canonical_invite(canonical_data: &str) -> String {
    ::hex::encode(Sha256::digest(canonical_data.as_bytes()))
}

/// Sign invite payload using session secret key hex.
pub fn sign_invite_data(secret_key_hex: &str, canonical_data: &str) -> Result<String, String> {
    let hash_hex = hash_canonical_invite(canonical_data);
    nip01::sign_event(secret_key_hex, &hash_hex)
}

/// Verify invite signature against public key (no session).
pub fn verify_invite_signature(
    public_key_hex: &str,
    canonical_data: &str,
    signature_hex: &str,
) -> bool {
    let hash_hex = hash_canonical_invite(canonical_data);
    nip01::verify_signature(public_key_hex, &hash_hex, &signature_hex)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::nip01;

    #[test]
    fn invite_sign_roundtrip() {
        let (sk, pk) = nip01::generate_key_pair();
        let canonical = "expirationTime:99|inviteId:x|publicKey:abc|timestamp:1";
        let sig = sign_invite_data(&sk, canonical).expect("sign");
        assert_eq!(sig.len(), 128);
        assert!(verify_invite_signature(&pk, canonical, &sig));
        assert!(!verify_invite_signature(&pk, "tampered", &sig));
    }

    #[test]
    fn hash_is_deterministic_64_hex() {
        let a = hash_canonical_invite("a|b");
        let b = hash_canonical_invite("a|b");
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }
}
