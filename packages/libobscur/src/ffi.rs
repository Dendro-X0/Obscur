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
#[uniffi::export]
pub async fn background_sync(secret_key_hex: String) -> Result<u32, ObscurError> {
    crate::net::background_sync(secret_key_hex).await
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
