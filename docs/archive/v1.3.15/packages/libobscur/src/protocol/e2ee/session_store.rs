use crate::protocol::store::ProtocolStore;
use crate::protocol::types::{RatchetChainState, RatchetSessionState};

pub fn load_ratchet_state(store: &ProtocolStore, session_id: &str) -> Result<RatchetChainState, String> {
    store
        .raw_ratchet_chain_state(session_id)?
        .ok_or_else(|| "Ratchet session not found".to_string())
}

pub fn load_ratchet_view(store: &ProtocolStore, session_id: &str) -> Result<RatchetSessionState, String> {
    store
        .ratchet_state(session_id)?
        .ok_or_else(|| "Ratchet session not found".to_string())
}

pub fn save_ratchet_state(
    store: &ProtocolStore,
    session_id: &str,
    peer_public_key_hex: &str,
    state: &RatchetChainState,
) -> Result<(), String> {
    store.upsert_ratchet(session_id, peer_public_key_hex, state)
}

