use crate::crypto::{nip01, nip04, nip44, nip17};
use std::fmt;

#[derive(uniffi::Error, Debug)]
pub enum ObscurError {
    CryptoError { message: String },
}

impl fmt::Display for ObscurError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ObscurError::CryptoError { message } => write!(f, "Crypto Error: {}", message),
        }
    }
}

impl From<String> for ObscurError {
    fn from(message: String) -> Self {
        Self::CryptoError { message }
    }
}

#[derive(uniffi::Record)]
pub struct KeyPair {
    pub secret_key: String,
    pub public_key: String,
}

#[derive(uniffi::Record)]
pub struct FFIRumor {
    pub id: String,
    pub pubkey: String,
    pub created_at: u64,
    pub kind: u32,
    pub tags: Vec<Vec<String>>,
    pub content: String,
}

impl From<nip17::Rumor> for FFIRumor {
    fn from(r: nip17::Rumor) -> Self {
        Self {
            id: r.id,
            pubkey: r.pubkey,
            created_at: r.created_at,
            kind: r.kind,
            tags: r.tags,
            content: r.content,
        }
    }
}

impl From<FFIRumor> for nip17::Rumor {
    fn from(r: FFIRumor) -> Self {
        Self {
            id: r.id,
            pubkey: r.pubkey,
            created_at: r.created_at,
            kind: r.kind,
            tags: r.tags,
            content: r.content,
        }
    }
}

#[derive(uniffi::Record)]
pub struct PushPreview {
    pub sender_pubkey: String,
    pub content: String,
}

#[derive(uniffi::Record)]
pub struct BackgroundSyncRelayReport {
    pub relay_url: String,
    pub ok: bool,
    pub events_scanned: u32,
    pub decrypted_messages: u32,
    pub last_seen_unix: Option<u64>,
    pub reason: Option<String>,
    pub duration_ms: u64,
}

#[derive(uniffi::Record)]
pub struct BackgroundSyncReport {
    pub ok: bool,
    pub key_id: String,
    pub scanned_relays: u32,
    pub total_events: u32,
    pub decrypted_messages: u32,
    pub checkpoint_unix: Option<u64>,
    pub reason: Option<String>,
    pub owner: String,
    pub outcomes: Vec<BackgroundSyncRelayReport>,
}

#[uniffi::export]
pub fn generate_key_pair() -> KeyPair {
    let (sk, pk) = nip01::generate_key_pair();
    KeyPair {
        secret_key: sk,
        public_key: pk,
    }
}

#[uniffi::export]
pub fn get_public_key(secret_key_hex: String) -> Result<String, ObscurError> {
    nip01::get_public_key(&secret_key_hex).map_err(ObscurError::from)
}

#[uniffi::export]
pub fn encrypt_nip04(secret_key_hex: String, public_key_hex: String, content: String) -> Result<String, ObscurError> {
    nip04::encrypt_nip04(&secret_key_hex, &public_key_hex, &content).map_err(ObscurError::from)
}

#[uniffi::export]
pub fn decrypt_nip04(secret_key_hex: String, public_key_hex: String, encrypted_content: String) -> Result<String, ObscurError> {
    nip04::decrypt_nip04(&secret_key_hex, &public_key_hex, &encrypted_content).map_err(ObscurError::from)
}

#[uniffi::export]
pub fn encrypt_nip44(secret_key_hex: String, public_key_hex: String, content: String) -> Result<String, ObscurError> {
    nip44::encrypt_nip44(&secret_key_hex, &public_key_hex, &content).map_err(ObscurError::from)
}

#[uniffi::export]
pub fn decrypt_nip44(secret_key_hex: String, public_key_hex: String, payload: String) -> Result<String, ObscurError> {
    nip44::decrypt_nip44(&secret_key_hex, &public_key_hex, &payload).map_err(ObscurError::from)
}

#[uniffi::export]
pub fn wrap_rumor(
    sender_sk: String,
    recipient_pk: String,
    rumor: FFIRumor,
    expiration: Option<u64>,
) -> Result<String, ObscurError> {
    nip17::wrap_rumor(&sender_sk, &recipient_pk, &rumor.into(), expiration).map_err(ObscurError::from)
}

#[uniffi::export]
pub fn unwrap_gift_wrap(
    recipient_sk: String,
    gift_wrap_content: String,
    gift_wrap_sender_pk: String,
) -> Result<FFIRumor, ObscurError> {
    let rumor = nip17::unwrap_gift_wrap(&recipient_sk, &gift_wrap_content, &gift_wrap_sender_pk).map_err(ObscurError::from)?;
    Ok(rumor.into())
}

#[uniffi::export]
pub fn decrypt_push_payload(secret_key_hex: String, gift_wrap_json: String) -> Result<PushPreview, ObscurError> {
    let event: serde_json::Value = serde_json::from_str(&gift_wrap_json).map_err(|e| e.to_string())?;
    let content = event["content"].as_str().ok_or_else(|| "Missing content".to_string())?;
    let ephemeral_pubkey = event["pubkey"].as_str().ok_or_else(|| "Missing pubkey".to_string())?;
    
    let rumor = nip17::unwrap_gift_wrap(&secret_key_hex, content, ephemeral_pubkey).map_err(ObscurError::from)?;
    
    // Truncate content for push preview
    let preview_content = if rumor.content.len() > 100 {
        format!("{}...", &rumor.content[..97])
    } else {
        rumor.content.clone()
    };
    
    Ok(PushPreview {
        sender_pubkey: rumor.pubkey,
        content: preview_content,
    })
}

fn load_secure_secret_key_hex(key_id: &str) -> Result<String, ObscurError> {
    let key_exists = crate::keystore::get_platform_keystore().has_key(key_id)?;
    if !key_exists {
        return Err(ObscurError::from(format!(
            "locked_no_secure_key: secure key unavailable for key_id={key_id}"
        )));
    }
    let secret_bytes = crate::keystore::get_platform_keystore().load_key(key_id)?;
    String::from_utf8(secret_bytes).map_err(|_| {
        ObscurError::from("integrity_mismatch: secure key payload is not valid UTF-8".to_string())
    })
}

#[uniffi::export]
pub fn decrypt_push_payload_for_key(
    key_id: String,
    gift_wrap_json: String,
) -> Result<PushPreview, ObscurError> {
    let secret_key_hex = load_secure_secret_key_hex(&key_id)?;
    decrypt_push_payload(secret_key_hex, gift_wrap_json)
}

#[uniffi::export]
pub async fn background_sync(secret_key_hex: String) -> Result<u32, ObscurError> {
    crate::net::background_sync(secret_key_hex).await
}

#[uniffi::export]
pub async fn background_sync_for_key(
    key_id: String,
    relay_urls: Vec<String>,
) -> Result<BackgroundSyncReport, ObscurError> {
    let secret_key_hex = load_secure_secret_key_hex(&key_id)?;
    let outcome = crate::net::background_sync_scoped(secret_key_hex, relay_urls, None).await?;
    Ok(BackgroundSyncReport {
        ok: outcome.ok,
        key_id,
        scanned_relays: outcome.scanned_relays,
        total_events: outcome.total_events,
        decrypted_messages: outcome.decrypted_messages,
        checkpoint_unix: outcome.checkpoint_unix,
        reason: outcome.reason,
        owner: "rust_secure_store".to_string(),
        outcomes: outcome
            .outcomes
            .into_iter()
            .map(|item| BackgroundSyncRelayReport {
                relay_url: item.relay_url,
                ok: item.ok,
                events_scanned: item.events_scanned,
                decrypted_messages: item.decrypted_messages,
                last_seen_unix: item.last_seen_unix,
                reason: item.reason,
                duration_ms: item.duration_ms,
            })
            .collect(),
    })
}

#[uniffi::export]
pub fn store_key(key_id: String, secret: Vec<u8>) -> Result<(), ObscurError> {
    crate::keystore::get_platform_keystore().store_key(&key_id, &secret)
}

#[uniffi::export]
pub fn load_key(key_id: String) -> Result<Vec<u8>, ObscurError> {
    crate::keystore::get_platform_keystore().load_key(&key_id)
}

#[uniffi::export]
pub fn delete_key(key_id: String) -> Result<(), ObscurError> {
    crate::keystore::get_platform_keystore().delete_key(&key_id)
}

#[uniffi::export]
pub fn has_key(key_id: String) -> Result<bool, ObscurError> {
    crate::keystore::get_platform_keystore().has_key(&key_id)
}

#[uniffi::export]
pub fn mine_pow(unsigned_event_json: String, difficulty: u8) -> Result<String, ObscurError> {
    let unsigned_event: nostr::prelude::UnsignedEvent = serde_json::from_str(&unsigned_event_json).map_err(|e| e.to_string())?;
    let mined_event = crate::crypto::pow::mine_pow(unsigned_event, difficulty).map_err(ObscurError::from)?;
    serde_json::to_string(&mined_event).map_err(|e| ObscurError::from(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decrypt_push_payload_for_key_fails_closed_when_key_missing() {
        let result = decrypt_push_payload_for_key(
            "missing-key-id".to_string(),
            r#"{"content":"abc","pubkey":"def"}"#.to_string(),
        );
        assert!(result.is_err());
        let message = result.err().map(|error| error.to_string()).unwrap_or_default();
        assert!(message.contains("locked_no_secure_key"));
    }
}
