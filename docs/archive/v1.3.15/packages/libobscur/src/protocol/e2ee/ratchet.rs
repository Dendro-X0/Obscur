use crate::protocol::types::{RatchetChainState, ReplayWindowState, SecurityReasonCode};
use sha2::{Digest, Sha256};

const MAX_OUT_OF_ORDER_WINDOW: u32 = 32;

fn derive(parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    for p in parts {
        h.update(p);
    }
    let digest = h.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest[..32]);
    out
}

fn decode_hex_32(value: &str) -> Result<[u8; 32], String> {
    let bytes = hex::decode(value).map_err(|e| e.to_string())?;
    if bytes.len() != 32 {
        return Err("Expected 32-byte key".to_string());
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

pub fn next_outgoing_message_key(state: &mut RatchetChainState) -> Result<String, String> {
    let chain = decode_hex_32(&state.sending_chain_key_hex)?;
    let counter_bytes = state.send_counter.to_be_bytes();
    let msg_key = derive(&[&chain, b"msg", &counter_bytes]);
    let next_chain = derive(&[&chain, b"chain", &counter_bytes]);
    state.send_counter = state.send_counter.saturating_add(1);
    state.sending_chain_key_hex = hex::encode(next_chain);
    Ok(hex::encode(msg_key))
}

pub fn accept_incoming_counter(
    state: &mut RatchetChainState,
    incoming_counter: u32,
) -> Result<ReplayWindowState, SecurityReasonCode> {
    if incoming_counter <= state.recv_counter {
        return Err(SecurityReasonCode::ReplayRejected);
    }
    let delta = incoming_counter - state.recv_counter;
    if delta > MAX_OUT_OF_ORDER_WINDOW {
        return Err(SecurityReasonCode::OutOfOrder);
    }

    let skipped = if delta > 1 {
        ((state.recv_counter + 1)..incoming_counter).collect()
    } else {
        Vec::new()
    };
    state.previous_message_counter = Some(state.recv_counter);
    state.recv_counter = incoming_counter;
    Ok(ReplayWindowState {
        highest_counter: incoming_counter,
        skipped_counters: skipped,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed_state() -> RatchetChainState {
        RatchetChainState {
            root_key_hex: "11".repeat(32),
            sending_chain_key_hex: "22".repeat(32),
            receiving_chain_key_hex: "33".repeat(32),
            send_counter: 0,
            recv_counter: 0,
            previous_message_counter: None,
        }
    }

    #[test]
    fn outgoing_key_advances_counter() {
        let mut state = seed_state();
        let first = next_outgoing_message_key(&mut state).expect("key");
        let second = next_outgoing_message_key(&mut state).expect("key");
        assert_ne!(first, second);
        assert_eq!(state.send_counter, 2);
    }

    #[test]
    fn rejects_replay_counter() {
        let mut state = seed_state();
        let _ = accept_incoming_counter(&mut state, 1).expect("first incoming");
        let replay = accept_incoming_counter(&mut state, 1);
        assert_eq!(replay, Err(SecurityReasonCode::ReplayRejected));
    }

    #[test]
    fn rejects_out_of_order_outside_window() {
        let mut state = seed_state();
        let out_of_window = accept_incoming_counter(&mut state, 100);
        assert_eq!(out_of_window, Err(SecurityReasonCode::OutOfOrder));
    }
}
