use keyring::Entry;
use nostr::prelude::*;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;
use std::borrow::Cow;

const APP_SERVICE: &str = "app.obscur.desktop";
const KEY_NAME: &str = "nsec";

#[derive(Debug, Serialize, Deserialize)]
pub struct NativeSignRequest {
    pub kind: u64,
    pub content: String,
    pub tags: Vec<Vec<String>>,
    pub created_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NativeSignResponse {
    pub id: String,
    pub pubkey: String,
    pub created_at: u64,
    pub kind: u64,
    pub tags: Vec<Vec<String>>,
    pub content: String,
    pub sig: String,
}

/// Get the native public key if it exists in the keychain.
#[tauri::command]
pub async fn get_native_npub() -> Result<Option<String>, String> {
    let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
    
    match entry.get_password() {
        Ok(nsec) => {
            let keys = Keys::parse(&nsec).map_err(|e| e.to_string())?;
            Ok(Some(keys.public_key().to_string()))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Store an nsec in the native keychain.
#[tauri::command]
pub async fn import_native_nsec(nsec: String) -> Result<String, String> {
    let nsec_zero = Zeroizing::new(nsec);
    let keys = Keys::parse(&*nsec_zero).map_err(|e| e.to_string())?;
    let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
    
    entry.set_password(&*nsec_zero).map_err(|e| e.to_string())?;
    
    Ok(keys.public_key().to_string())
}

/// Generate a new nsec and store it in the native keychain.
#[tauri::command]
pub async fn generate_native_nsec() -> Result<String, String> {
    let keys = Keys::generate();
    let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
    
    let nsec = keys.secret_key()
        .to_bech32()
        .map_err(|e| e.to_string())?;
    let nsec_zero = Zeroizing::new(nsec);
    
    entry.set_password(&*nsec_zero).map_err(|e| e.to_string())?;
    
    Ok(keys.public_key().to_string())
}

/// Sign a Nostr event using the native keychain.
#[tauri::command]
pub async fn sign_event_native(req: NativeSignRequest) -> Result<NativeSignResponse, String> {
    let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
    let nsec = entry.get_password().map_err(|e| e.to_string())?;
    let nsec_zero = Zeroizing::new(nsec);
    
    let keys = Keys::parse(&*nsec_zero).map_err(|e| e.to_string())?;
    
    let unsigned_event = EventBuilder::new(
        Kind::from(req.kind as u16),
        req.content.clone(),
    )
    .tags(req.tags.iter().map(|t| Tag::parse(t).unwrap_or(Tag::custom(TagKind::Custom(Cow::Owned(t[0].clone())), t[1..].to_vec()))).collect::<Vec<_>>())
    .custom_created_at(Timestamp::from(req.created_at))
    .build(keys.public_key());

    let signed_event = unsigned_event.sign(&keys).await.map_err(|e| e.to_string())?;

    Ok(NativeSignResponse {
        id: signed_event.id.to_string(),
        pubkey: signed_event.pubkey.to_string(),
        created_at: signed_event.created_at.as_u64(),
        kind: signed_event.kind.as_u16() as u64,
        tags: signed_event.tags.iter().map(|t| t.clone().to_vec()).collect(),
        content: signed_event.content.clone(),
        sig: signed_event.sig.to_string(),
    })
}

/// Delete the stored nsec from the keychain.
#[tauri::command]
pub async fn logout_native() -> Result<(), String> {
    let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
