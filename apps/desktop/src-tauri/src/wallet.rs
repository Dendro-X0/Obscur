// Desktop-only wallet implementation with native keychain
#[cfg(not(target_os = "android"))]
mod desktop {
    use crate::session::SessionState;
    use keyring::Entry;
    use nostr::prelude::*;
    use serde::{Deserialize, Serialize};
    use tauri::State;
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

    /// Get the native public key if it exists in the session or keychain.
    /// This also hydrations the in-memory session from the keychain if found.
    #[tauri::command]
    pub async fn get_native_npub(session: State<'_, SessionState>) -> Result<Option<String>, String> {
        // Try session first
        if let Some(keys) = session.get_keys().await {
            return Ok(Some(keys.public_key().to_string()));
        }

        // Fallback to keychain
        let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
        
        match entry.get_password() {
            Ok(nsec) => {
                let nsec_zero = Zeroizing::new(nsec);
                // Hydrate session from keychain
                match session.set_keys(&*nsec_zero).await {
                    Ok(pubkey) => {
                        eprintln!("[SESSION] Native session re-hydrated from OS keychain");
                        Ok(Some(pubkey.to_string()))
                    }
                    Err(e) => Err(format!("Failed to hydrate session from keychain: {}", e)),
                }
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Store an nsec in the native keychain and session.
    #[tauri::command]
    pub async fn import_native_nsec(session: State<'_, SessionState>, nsec: String) -> Result<String, String> {
        let nsec_zero = Zeroizing::new(nsec);
        let keys = Keys::parse(&*nsec_zero).map_err(|e| e.to_string())?;
        
        // Update session
        session.set_keys(&*nsec_zero).await?;

        // Update keychain
        let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
        entry.set_password(&*nsec_zero).map_err(|e| e.to_string())?;
        
        Ok(keys.public_key().to_string())
    }

    /// Generate a new nsec and store it in the native keychain and session.
    #[tauri::command]
    pub async fn generate_native_nsec(session: State<'_, SessionState>) -> Result<String, String> {
        let keys = Keys::generate();
        let nsec = keys.secret_key()
            .to_bech32()
            .map_err(|e| e.to_string())?;
        let nsec_zero = Zeroizing::new(nsec);

        // Update session
        session.set_keys(&*nsec_zero).await?;

        // Update keychain
        let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
        entry.set_password(&*nsec_zero).map_err(|e| e.to_string())?;
        
        Ok(keys.public_key().to_string())
    }

    /// Sign a Nostr event using the in-memory session.
    #[tauri::command]
    pub async fn sign_event_native(session: State<'_, SessionState>, req: NativeSignRequest) -> Result<NativeSignResponse, String> {
        let keys = session.get_keys().await.ok_or_else(|| "No active native session".to_string())?;
        
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

    /// Delete the stored nsec from the keychain and clear session.
    #[tauri::command]
    pub async fn logout_native(session: State<'_, SessionState>) -> Result<(), String> {
        // Clear session
        session.clear().await;

        // Clear keychain
        let entry = Entry::new(APP_SERVICE, KEY_NAME).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Encrypt content using NIP-04 (Legacy)
    #[tauri::command]
    pub async fn encrypt_nip04(session: State<'_, SessionState>, public_key: String, content: String) -> Result<String, String> {
        let keys = session.get_keys().await.ok_or_else(|| "No active native session".to_string())?;
        let pubkey = PublicKey::parse(&public_key).map_err(|e| e.to_string())?;
        
        nostr::nips::nip04::encrypt(keys.secret_key(), &pubkey, &content)
            .map_err(|e| e.to_string())
    }

    /// Decrypt content using NIP-04 (Legacy)
    #[tauri::command]
    pub async fn decrypt_nip04(session: State<'_, SessionState>, public_key: String, ciphertext: String) -> Result<String, String> {
        let keys = session.get_keys().await.ok_or_else(|| "No active native session".to_string())?;
        let pubkey = PublicKey::parse(&public_key).map_err(|e| e.to_string())?;
        
        nostr::nips::nip04::decrypt(keys.secret_key(), &pubkey, &ciphertext)
            .map_err(|e| e.to_string())
    }

    /// Get the current session secret key as a hex string.
    #[tauri::command]
    pub async fn get_session_nsec(session: State<'_, SessionState>) -> Result<String, String> {
        let keys = session.get_keys().await.ok_or_else(|| "No active native session".to_string())?;
        Ok(keys.secret_key().to_secret_hex())
    }
}

// Android stub implementations (no keychain support)
#[cfg(target_os = "android")]
mod android {
    use serde::{Deserialize, Serialize};

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

    const UNSUPPORTED_MSG: &str = "Native keychain not supported on Android. Please use WASM crypto.";

    #[tauri::command]
    pub async fn get_native_npub(_session: tauri::State<'_, crate::session::SessionState>) -> Result<Option<String>, String> {
        Ok(None)
    }

    #[tauri::command]
    pub async fn import_native_nsec(_session: tauri::State<'_, crate::session::SessionState>, _nsec: String) -> Result<String, String> {
        Err(UNSUPPORTED_MSG.to_string())
    }

    #[tauri::command]
    pub async fn generate_native_nsec(_session: tauri::State<'_, crate::session::SessionState>) -> Result<String, String> {
        Err(UNSUPPORTED_MSG.to_string())
    }

    #[tauri::command]
    pub async fn sign_event_native(_session: tauri::State<'_, crate::session::SessionState>, _req: NativeSignRequest) -> Result<NativeSignResponse, String> {
        Err(UNSUPPORTED_MSG.to_string())
    }

    #[tauri::command]
    pub async fn logout_native(_session: tauri::State<'_, crate::session::SessionState>) -> Result<(), String> {
        Ok(())
    }

    #[tauri::command]
    pub async fn encrypt_nip04(_session: tauri::State<'_, crate::session::SessionState>, _public_key: String, _content: String) -> Result<String, String> {
        Err(UNSUPPORTED_MSG.to_string())
    }

    #[tauri::command]
    pub async fn decrypt_nip04(_session: tauri::State<'_, crate::session::SessionState>, _public_key: String, _ciphertext: String) -> Result<String, String> {
        Err(UNSUPPORTED_MSG.to_string())
    }

    #[tauri::command]
    pub async fn get_session_nsec(_session: tauri::State<'_, crate::session::SessionState>) -> Result<String, String> {
        Err(UNSUPPORTED_MSG.to_string())
    }
}

// Re-export the appropriate implementation
#[cfg(not(target_os = "android"))]
pub use desktop::*;

#[cfg(target_os = "android")]
pub use android::*;
