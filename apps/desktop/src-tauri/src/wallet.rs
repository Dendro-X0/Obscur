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
        match ensure_session(&session).await {
            Ok(keys) => Ok(Some(keys.public_key().to_string())),
            Err(_) => Ok(None),
        }
    }

    /// Ensure session is hydrated from keychain if not present
    async fn ensure_session(session: &SessionState) -> Result<Keys, String> {
        if let Some(keys) = session.get_keys().await {
            return Ok(keys);
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
                        session.get_keys().await.ok_or_else(|| "Failed to hydrate session".to_string())
                    }
                    Err(e) => Err(format!("Failed to hydrate session from keychain: {}", e)),
                }
            }
            Err(keyring::Error::NoEntry) => Err("No active native session and no key in keychain".to_string()),
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
        let keys = ensure_session(&session).await?;
        
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
        let keys = ensure_session(&session).await?;
        let pubkey = PublicKey::parse(&public_key).map_err(|e| e.to_string())?;
        
        nostr::nips::nip04::encrypt(keys.secret_key(), &pubkey, &content)
            .map_err(|e| e.to_string())
    }

    /// Decrypt content using NIP-04 (Legacy)
    #[tauri::command]
    pub async fn decrypt_nip04(session: State<'_, SessionState>, public_key: String, ciphertext: String) -> Result<String, String> {
        let keys = ensure_session(&session).await?;
        let pubkey = PublicKey::parse(&public_key).map_err(|e| e.to_string())?;
        
        nostr::nips::nip04::decrypt(keys.secret_key(), &pubkey, &ciphertext)
            .map_err(|e| e.to_string())
    }

    /// Get the current session secret key as a hex string.
    #[tauri::command]
    pub async fn get_session_nsec(session: State<'_, SessionState>) -> Result<String, String> {
        let keys = ensure_session(&session).await?;
        Ok(keys.secret_key().to_secret_hex())
    }
}

// Mobile implementations (store-based)
#[cfg(any(target_os = "android", target_os = "ios"))]
mod mobile {
    use crate::session::SessionState;
    use nostr::prelude::*;
    use serde::{Deserialize, Serialize};
    use tauri::{AppHandle, State, Manager};
    use tauri_plugin_store::StoreExt;
    use zeroize::Zeroizing;
    use std::borrow::Cow;
    use std::path::PathBuf;

    const STORE_PATH: &str = "secrets.bin";
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

    /// Ensure session is hydrated from store if not present
    async fn ensure_session(app: &AppHandle, session: &SessionState) -> Result<Keys, String> {
        if let Some(keys) = session.get_keys().await {
            return Ok(keys);
        }

        // Fallback to store
        let store = app.store(PathBuf::from(STORE_PATH)).map_err(|e| e.to_string())?;
        
        if let Some(val) = store.get(KEY_NAME) {
            if let Some(nsec) = val.as_str() {
                let nsec_zero = Zeroizing::new(nsec.to_string());
                session.set_keys(&*nsec_zero).await?;
                eprintln!("[SESSION] Mobile session re-hydrated from store");
                return session.get_keys().await.ok_or_else(|| "Failed to hydrate session".to_string());
            }
        }
        
        Err("No active native session and no key in storage".to_string())
    }

    #[tauri::command]
    pub async fn get_native_npub(app: AppHandle, session: State<'_, SessionState>) -> Result<Option<String>, String> {
        match ensure_session(&app, &session).await {
            Ok(keys) => Ok(Some(keys.public_key().to_string())),
            Err(_) => Ok(None),
        }
    }

    #[tauri::command]
    pub async fn import_native_nsec(app: AppHandle, session: State<'_, SessionState>, nsec: String) -> Result<String, String> {
        let nsec_zero = Zeroizing::new(nsec);
        let keys = Keys::parse(&*nsec_zero).map_err(|e| e.to_string())?;
        
        // Update session
        session.set_keys(&*nsec_zero).await?;

        // Update store
        let store = app.store(PathBuf::from(STORE_PATH)).map_err(|e| e.to_string())?;
        store.set(KEY_NAME, serde_json::Value::String((*nsec_zero).clone()));
        store.save().map_err(|e| e.to_string())?;
        
        Ok(keys.public_key().to_string())
    }

    #[tauri::command]
    pub async fn generate_native_nsec(app: AppHandle, session: State<'_, SessionState>) -> Result<String, String> {
        let keys = Keys::generate();
        let nsec = keys.secret_key()
            .to_bech32()
            .map_err(|e| e.to_string())?;
        let nsec_zero = Zeroizing::new(nsec);

        // Update session
        session.set_keys(&*nsec_zero).await?;

        // Update store
        let store = app.store(PathBuf::from(STORE_PATH)).map_err(|e| e.to_string())?;
        store.set(KEY_NAME, serde_json::Value::String((*nsec_zero).clone()));
        store.save().map_err(|e| e.to_string())?;
        
        Ok(keys.public_key().to_string())
    }

    #[tauri::command]
    pub async fn sign_event_native(app: AppHandle, session: State<'_, SessionState>, req: NativeSignRequest) -> Result<NativeSignResponse, String> {
        let keys = ensure_session(&app, &session).await?;
        
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

    #[tauri::command]
    pub async fn logout_native(app: AppHandle, session: State<'_, SessionState>) -> Result<(), String> {
        // Clear session
        session.clear().await;

        // Clear store
        let store = app.store(PathBuf::from(STORE_PATH)).map_err(|e| e.to_string())?;
        store.delete(KEY_NAME);
        store.save().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub async fn encrypt_nip04(app: AppHandle, session: State<'_, SessionState>, public_key: String, content: String) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        let pubkey = PublicKey::parse(&public_key).map_err(|e| e.to_string())?;
        
        nostr::nips::nip04::encrypt(keys.secret_key(), &pubkey, &content)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn decrypt_nip04(app: AppHandle, session: State<'_, SessionState>, public_key: String, ciphertext: String) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        let pubkey = PublicKey::parse(&public_key).map_err(|e| e.to_string())?;
        
        nostr::nips::nip04::decrypt(keys.secret_key(), &pubkey, &ciphertext)
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn get_session_nsec(app: AppHandle, session: State<'_, SessionState>) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        Ok(keys.secret_key().to_secret_hex())
    }
}

// Re-export the appropriate implementation
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use desktop::*;

#[cfg(any(target_os = "android", target_os = "ios"))]
pub use mobile::*;
