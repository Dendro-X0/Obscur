use nostr::prelude::*;
use std::str::FromStr;

/// NIP-01 event id for a rumor (or any unsigned event fields).
/// SHA-256 of `[0, pubkey, created_at, kind, tags, content]` — same as `EventId::new`.
/// @see specs/backend/crypto-native-rumor-event-id-design-2026-10.md
pub fn derive_rumor_event_id(
    pubkey: &str,
    created_at: u64,
    kind: u32,
    tags: &[Vec<String>],
    content: &str,
) -> Result<String, String> {
    let public_key = PublicKey::from_str(pubkey.trim()).map_err(|e| e.to_string())?;
    let timestamp = Timestamp::from(created_at);
    if kind > u16::MAX as u32 {
        return Err("kind out of range".to_string());
    }
    let event_kind = Kind::from(kind as u16);
    let parsed_tags: Result<Vec<Tag>, String> = tags
        .iter()
        .map(|tag| Tag::parse(tag.clone()).map_err(|e| e.to_string()))
        .collect();
    let parsed_tags = parsed_tags?;
    let id = EventId::new(&public_key, &timestamp, &event_kind, &parsed_tags, content);
    Ok(id.to_hex())
}

/// Generates a new random key pair.
/// Returns (secret_key_hex, public_key_hex).
pub fn generate_key_pair() -> (String, String) {
    let keys = Keys::generate();
    (
        ::hex::encode(keys.secret_key().secret_bytes()),
        keys.public_key().to_string()
    )
}

/// Derives a public key from a secret key hex string.
pub fn get_public_key(secret_key_hex: &str) -> Result<String, String> {
    let sk = SecretKey::from_str(secret_key_hex).map_err(|e| e.to_string())?;
    let keys = Keys::new(sk);
    Ok(keys.public_key().to_string())
}

/// Signs a message hash or content.
pub fn sign_event(secret_key_hex: &str, message_hash_hex: &str) -> Result<String, String> {
    let sk = nostr::secp256k1::SecretKey::from_str(secret_key_hex).map_err(|e| e.to_string())?;
    let message_hash_bytes = ::hex::decode(message_hash_hex).map_err(|e| e.to_string())?;
    let message = nostr::secp256k1::Message::from_digest_slice(&message_hash_bytes).map_err(|e| e.to_string())?;
    
    let secp = nostr::secp256k1::Secp256k1::new();
    let keypair = nostr::secp256k1::Keypair::from_secret_key(&secp, &sk);
    let sig = secp.sign_schnorr_no_aux_rand(&message, &keypair);
    
    Ok(::hex::encode(sig.serialize()))
}

/// Verify a signed Nostr event (id matches NIP-01 digest + schnorr over id).
/// Wire-compatible with `@dweb/nostr/verify-nostr-event-signature`.
/// @see specs/backend/crypto-native-random-verify-design-2026-10.md
pub fn verify_nostr_event(
    id: &str,
    pubkey: &str,
    created_at: u64,
    kind: u32,
    tags: &[Vec<String>],
    content: &str,
    sig: &str,
) -> bool {
    let expected = match derive_rumor_event_id(pubkey, created_at, kind, tags, content) {
        Ok(v) => v,
        Err(_) => return false,
    };
    if expected != id.trim().to_lowercase() {
        return false;
    }
    verify_signature(pubkey, id.trim(), sig.trim())
}

/// Verifies a Schnorr signature.
pub fn verify_signature(public_key_hex: &str, message_hash_hex: &str, signature_hex: &str) -> bool {
    let pk = match nostr::secp256k1::XOnlyPublicKey::from_str(public_key_hex) {
        Ok(k) => k,
        Err(_) => return false,
    };
    
    let message_hash_bytes = match ::hex::decode(message_hash_hex) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let message = match nostr::secp256k1::Message::from_digest_slice(&message_hash_bytes) {
        Ok(m) => m,
        Err(_) => return false,
    };
    
    let signature_bytes = match ::hex::decode(signature_hex) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let signature = match nostr::secp256k1::schnorr::Signature::from_slice(&signature_bytes) {
        Ok(s) => s,
        Err(_) => return false,
    };
    
    let secp = nostr::secp256k1::Secp256k1::new();
    secp.verify_schnorr(&signature, &message, &pk).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_rumor_event_id_is_deterministic_64_hex() {
        let pubkey = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
        let tags = vec![vec!["p".to_string(), pubkey.to_string()]];
        let first = derive_rumor_event_id(pubkey, 1_700_000_000, 14, &tags, "hello").unwrap();
        let second = derive_rumor_event_id(pubkey, 1_700_000_000, 14, &tags, "hello").unwrap();
        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(first, second);
        let other = derive_rumor_event_id(pubkey, 1_700_000_000, 14, &tags, "hello!").unwrap();
        assert_ne!(first, other);
    }

    #[test]
    fn derive_rumor_event_id_rejects_bad_pubkey() {
        let err = derive_rumor_event_id("not-a-key", 1, 1, &[], "").unwrap_err();
        assert!(!err.is_empty());
    }

    #[test]
    fn verify_nostr_event_roundtrip() {
        let (sk, pk) = generate_key_pair();
        let created_at = 1_700_000_000u64;
        let kind = 1u32;
        let tags: Vec<Vec<String>> = vec![];
        let content = "verify-me";
        let id = derive_rumor_event_id(&pk, created_at, kind, &tags, content).unwrap();
        let sig = sign_event(&sk, &id).unwrap();
        assert!(verify_nostr_event(&id, &pk, created_at, kind, &tags, content, &sig));
        assert!(!verify_nostr_event(&id, &pk, created_at, kind, &tags, "tampered", &sig));
    }
}
