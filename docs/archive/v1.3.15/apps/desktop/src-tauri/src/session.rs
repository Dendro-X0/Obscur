use nostr::prelude::*;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;

/// In-memory session state for the active user.
/// This replaces the OS keychain dependency for active operations.
pub struct SessionState {
    pub keys: Arc<Mutex<HashMap<String, Keys>>>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            keys: Arc::new(Mutex::new(HashMap::new())),
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
        Ok(pubkey)
    }

    /// Clear the active session
    pub async fn clear(&self, profile_id: Option<&str>) {
        let mut session_keys = self.keys.lock().await;
        if let Some(profile_id) = profile_id {
            session_keys.remove(profile_id);
        } else {
            session_keys.clear();
        }
    }

    /// Get a clone of the keys if available
    pub async fn get_keys(&self, profile_id: &str) -> Option<Keys> {
        let session_keys = self.keys.lock().await;
        session_keys.get(profile_id).cloned()
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
