use std::sync::Arc;
use tokio::sync::Mutex;
use nostr::prelude::*;
use serde::{Serialize, Deserialize};

/// In-memory session state for the active user.
/// This replaces the OS keychain dependency for active operations.
pub struct SessionState {
    pub keys: Arc<Mutex<Option<Keys>>>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            keys: Arc::new(Mutex::new(None)),
        }
    }

    /// Set the active session keys from an nsec or hex string
    pub async fn set_keys(&self, key_str: &str) -> Result<PublicKey, String> {
        let keys = if key_str.starts_with("nsec") {
            Keys::parse(key_str).map_err(|e| format!("Invalid nsec: {}", e))?
        } else {
            // Try hex
            let secret_key = SecretKey::from_hex(key_str).map_err(|e| format!("Invalid hex key: {}", e))?;
            Keys::new(secret_key)
        };
        
        let pubkey = keys.public_key();
        let mut session_keys = self.keys.lock().await;
        *session_keys = Some(keys);
        Ok(pubkey)
    }

    /// Clear the active session
    pub async fn clear(&self) {
        let mut session_keys = self.keys.lock().await;
        *session_keys = None;
    }

    /// Get a clone of the keys if available
    pub async fn get_keys(&self) -> Option<Keys> {
        let session_keys = self.keys.lock().await;
        session_keys.clone()
    }

    /*
    /// Check if session is active
    pub async fn is_active(&self) -> bool {
        let session_keys = self.keys.lock().await;
        session_keys.is_some()
    }
    */
}

/// Generic response for session commands
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub success: bool,
    pub npub: Option<String>,
    pub message: Option<String>,
}
