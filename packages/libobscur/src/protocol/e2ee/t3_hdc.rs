//! Cut 0.8 — T3 Double Ratchet seal for thin H-dc envelopes.
//!
//! Opaque envelope (base64): `T3\x01` || counter_be32 || nonce12 || ciphertext.
//! Home transport must never see plaintext. Soft L3 / NIP-17 ≠ T3.
//!
//! @see specs/backend/cut0-account-spine-design-2026-11-09.md §8

use crate::protocol::e2ee::ratchet::{next_incoming_message_key, next_outgoing_message_key};
use crate::protocol::types::RatchetChainState;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;

const ENVELOPE_MAGIC: &[u8] = b"T3\x01";

fn decode_hex_32(value: &str) -> Result<[u8; 32], String> {
    let bytes = hex::decode(value).map_err(|e| e.to_string())?;
    if bytes.len() != 32 {
        return Err("Expected 32-byte key".to_string());
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

/// Seal plaintext under the next outgoing ratchet message key.
/// Returns base64 opaque envelope suitable for `privateDcSendEnvelope`.
pub fn seal_t3_hdc_envelope(
    state: &mut RatchetChainState,
    plaintext: &[u8],
) -> Result<String, String> {
    let counter = state.send_counter;
    let key_hex = next_outgoing_message_key(state)?;
    let key = decode_hex_32(&key_hex)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("t3 seal failed: {e}"))?;

    let mut wire = Vec::with_capacity(3 + 4 + 12 + ciphertext.len());
    wire.extend_from_slice(ENVELOPE_MAGIC);
    wire.extend_from_slice(&counter.to_be_bytes());
    wire.extend_from_slice(&nonce_bytes);
    wire.extend_from_slice(&ciphertext);
    Ok(B64.encode(wire))
}

/// Open a T3 H-dc envelope with the next expected incoming ratchet key (sequential).
pub fn open_t3_hdc_envelope(
    state: &mut RatchetChainState,
    envelope_b64: &str,
) -> Result<Vec<u8>, String> {
    let wire = B64
        .decode(envelope_b64.trim())
        .map_err(|e| format!("t3 envelope b64: {e}"))?;
    if wire.len() < 3 + 4 + 12 + 16 {
        return Err("t3 envelope too short".to_string());
    }
    if &wire[0..3] != ENVELOPE_MAGIC {
        return Err("t3 envelope magic mismatch".to_string());
    }
    let counter = u32::from_be_bytes([wire[3], wire[4], wire[5], wire[6]]);
    let nonce_bytes = &wire[7..19];
    let ciphertext = &wire[19..];

    let (expected, key_hex) = next_incoming_message_key(state)?;
    if expected != counter {
        return Err(format!(
            "t3 counter mismatch: expected {expected}, got {counter}"
        ));
    }
    let key = decode_hex_32(&key_hex)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("t3 open failed: {e}"))
}

/// Serialize ratchet chain for `dr_session.session_blob`.
pub fn encode_ratchet_blob(state: &RatchetChainState) -> Result<Vec<u8>, String> {
    serde_json::to_vec(state).map_err(|e| e.to_string())
}

pub fn decode_ratchet_blob(blob: &[u8]) -> Result<RatchetChainState, String> {
    serde_json::from_slice(blob).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mirrored_pair() -> (RatchetChainState, RatchetChainState) {
        let send = "aa".repeat(32);
        let recv = "bb".repeat(32);
        let root = "cc".repeat(32);
        let alice = RatchetChainState {
            root_key_hex: root.clone(),
            sending_chain_key_hex: send.clone(),
            receiving_chain_key_hex: recv.clone(),
            send_counter: 0,
            recv_counter: 0,
            previous_message_counter: None,
        };
        let bob = RatchetChainState {
            root_key_hex: root,
            sending_chain_key_hex: recv,
            receiving_chain_key_hex: send,
            send_counter: 0,
            recv_counter: 0,
            previous_message_counter: None,
        };
        (alice, bob)
    }

    #[test]
    fn alice_seal_bob_open_round_trip() {
        let (mut alice, mut bob) = mirrored_pair();
        let envelope = seal_t3_hdc_envelope(&mut alice, b"private-trust hi").unwrap();
        assert!(!envelope.contains("private-trust"));
        let plain = open_t3_hdc_envelope(&mut bob, &envelope).unwrap();
        assert_eq!(plain, b"private-trust hi");
        assert_eq!(alice.send_counter, 1);
        assert_eq!(bob.recv_counter, 1);
    }

    #[test]
    fn envelope_rejects_wrong_magic_plaintext() {
        let (mut bob, _) = mirrored_pair();
        // Pretend H-dc echoed a plaintext "body" as envelope
        let fake = B64.encode(b"not-a-t3-envelope");
        assert!(open_t3_hdc_envelope(&mut bob, &fake).is_err());
    }

    #[test]
    fn ratchet_blob_round_trip() {
        let (alice, _) = mirrored_pair();
        let blob = encode_ratchet_blob(&alice).unwrap();
        let restored = decode_ratchet_blob(&blob).unwrap();
        assert_eq!(restored.sending_chain_key_hex, alice.sending_chain_key_hex);
    }
}
