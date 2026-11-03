use nostr::prelude::*;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};
use tokio::sync::Mutex;

/// In-memory session state for the active user.
/// This replaces the OS keychain dependency for active operations.
pub struct SessionState {
    pub keys: Arc<Mutex<HashMap<String, Keys>>>,
    /// After explicit Lock/`clear_native_session`, refuse keychain auto-hydrate until
    /// intentional `set_keys` / force restore (FM1 L3 — status must not undo lock).
    hydrate_suppressed: Arc<Mutex<HashSet<String>>>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            keys: Arc::new(Mutex::new(HashMap::new())),
            hydrate_suppressed: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    /// Set the active session keys from an nsec or hex string
    pub async fn set_keys(&self, profile_id: &str, key_str: &str) -> Result<PublicKey, String> {
        let keys = if key_str.starts_with("nsec") {
            Keys::parse(key_str).map_err(|e| format!("Invalid nsec: {}", e))?
        } else {
            // Try hex
            let secret_key =
                SecretKey::from_hex(key_str).map_err(|e| format!("Invalid hex key: {}", e))?;
            Keys::new(secret_key)
        };

        let pubkey = keys.public_key();
        let mut session_keys = self.keys.lock().await;
        session_keys.insert(profile_id.to_string(), keys);
        drop(session_keys);
        let mut suppressed = self.hydrate_suppressed.lock().await;
        suppressed.remove(profile_id);
        Ok(pubkey)
    }

    /// Clear the active session
    pub async fn clear(&self, profile_id: Option<&str>) {
        let mut session_keys = self.keys.lock().await;
        let mut suppressed = self.hydrate_suppressed.lock().await;
        if let Some(profile_id) = profile_id {
            session_keys.remove(profile_id);
            suppressed.insert(profile_id.to_string());
        } else {
            for id in session_keys.keys() {
                suppressed.insert(id.clone());
            }
            session_keys.clear();
        }
    }

    /// Get a clone of the keys if available
    pub async fn get_keys(&self, profile_id: &str) -> Option<Keys> {
        let session_keys = self.keys.lock().await;
        session_keys.get(profile_id).cloned()
    }

    /// True after Lock until intentional set_keys / force restore.
    pub async fn is_hydrate_suppressed(&self, profile_id: &str) -> bool {
        let suppressed = self.hydrate_suppressed.lock().await;
        suppressed.contains(profile_id)
    }
}

#[cfg(test)]
mod tests {
    use super::SessionState;

    #[tokio::test]
    async fn clear_suppresses_hydrate_until_set_keys() {
        let session = SessionState::new();
        let nsec = "0000000000000000000000000000000000000000000000000000000000000001";
        session.set_keys("tester1", nsec).await.expect("set_keys");
        assert!(!session.is_hydrate_suppressed("tester1").await);
        session.clear(Some("tester1")).await;
        assert!(session.get_keys("tester1").await.is_none());
        assert!(session.is_hydrate_suppressed("tester1").await);
        session.set_keys("tester1", nsec).await.expect("set_keys again");
        assert!(!session.is_hydrate_suppressed("tester1").await);
        assert!(session.get_keys("tester1").await.is_some());
    }
}

/// Detailed session status for the frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStatus {
    pub is_active: bool,
    pub npub: Option<String>,
    pub is_native: bool,
}

/// Generic response for session commands
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub success: bool,
    pub npub: Option<String>,
    pub message: Option<String>,
}
