// Desktop-only wallet implementation with native keychain
#[cfg(not(target_os = "android"))]
mod desktop {
    use crate::profiles::{DesktopProfileState, resolve_profile_for_window};
    use crate::session::SessionState;
    use keyring::Entry;
    use nostr::prelude::*;
    use serde::{Deserialize, Serialize};
    use std::borrow::Cow;
    use tauri::{AppHandle, State, WebviewWindow};
    use zeroize::Zeroizing;

    const APP_SERVICE: &str = "app.obscur.desktop";
    const KEY_NAME: &str = "nsec";

    fn key_name_for_profile(profile_id: &str) -> String {
        format!("{KEY_NAME}::{profile_id}")
    }

    async fn resolve_profile_id(
        app: &AppHandle,
        profiles: &State<'_, DesktopProfileState>,
        window: &WebviewWindow,
    ) -> Result<String, String> {
        resolve_profile_for_window(app, profiles, window).await
    }

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
    pub async fn get_native_npub(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
    ) -> Result<Option<String>, String> {
        match ensure_session(&app, &window, &profiles, &session).await {
            Ok(keys) => Ok(Some(keys.public_key().to_string())),
            Err(_) => Ok(None),
        }
    }

    /// Ensure session is hydrated from keychain if not present
    async fn ensure_session(
        app: &AppHandle,
        window: &WebviewWindow,
        profiles: &State<'_, DesktopProfileState>,
        session: &SessionState,
    ) -> Result<Keys, String> {
        let profile_id = resolve_profile_id(app, profiles, window).await?;
        if let Some(keys) = session.get_keys(&profile_id).await {
            return Ok(keys);
        }

        // Fallback to keychain
        let entry = Entry::new(APP_SERVICE, &key_name_for_profile(&profile_id)).map_err(|e| e.to_string())?;

        match entry.get_password() {
            Ok(nsec) => {
                let nsec_zero = Zeroizing::new(nsec);
                // Hydrate session from keychain
                match session.set_keys(&profile_id, &*nsec_zero).await {
                    Ok(_pubkey) => {
                        eprintln!("[SESSION] Native session re-hydrated from OS keychain for profile {}", profile_id);
                        session
                            .get_keys(&profile_id)
                            .await
                            .ok_or_else(|| "Failed to hydrate session".to_string())
                    }
                    Err(e) => Err(format!("Failed to hydrate session from keychain: {}", e)),
                }
            }
            Err(keyring::Error::NoEntry) => {
                Err("No active native session and no key in keychain".to_string())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    /// Store an nsec in the native keychain and session.
    #[tauri::command]
    pub async fn import_native_nsec(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        nsec: String,
    ) -> Result<String, String> {
        let nsec_zero = Zeroizing::new(nsec);
        let keys = Keys::parse(&*nsec_zero).map_err(|e| e.to_string())?;
        let profile_id = resolve_profile_id(&app, &profiles, &window).await?;

        // Update session
        session.set_keys(&profile_id, &*nsec_zero).await?;

        // Update keychain
        let entry = Entry::new(APP_SERVICE, &key_name_for_profile(&profile_id)).map_err(|e| e.to_string())?;
        entry.set_password(&*nsec_zero).map_err(|e| e.to_string())?;

        Ok(keys.public_key().to_string())
    }

    /// Generate a new nsec and store it in the native keychain and session.
    #[tauri::command]
    pub async fn generate_native_nsec(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
    ) -> Result<String, String> {
        let keys = Keys::generate();
        let nsec = keys.secret_key().to_bech32().map_err(|e| e.to_string())?;
        let nsec_zero = Zeroizing::new(nsec);
        let profile_id = resolve_profile_id(&app, &profiles, &window).await?;

        // Update session
        session.set_keys(&profile_id, &*nsec_zero).await?;

        // Update keychain
        let entry = Entry::new(APP_SERVICE, &key_name_for_profile(&profile_id)).map_err(|e| e.to_string())?;
        entry.set_password(&*nsec_zero).map_err(|e| e.to_string())?;

        Ok(keys.public_key().to_string())
    }

    /// Sign a Nostr event using the in-memory session.
    #[tauri::command]
    pub async fn sign_event_native(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        req: NativeSignRequest,
    ) -> Result<NativeSignResponse, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;

        let unsigned_event = EventBuilder::new(Kind::from(req.kind as u16), req.content.clone())
            .tags(
                req.tags
                    .iter()
                    .map(|t| {
                        Tag::parse(t).unwrap_or(Tag::custom(
                            TagKind::Custom(Cow::Owned(t[0].clone())),
                            t[1..].to_vec(),
                        ))
                    })
                    .collect::<Vec<_>>(),
            )
            .custom_created_at(Timestamp::from(req.created_at))
            .build(keys.public_key());

        let signed_event = unsigned_event
            .sign(&keys)
            .await
            .map_err(|e| e.to_string())?;

        Ok(NativeSignResponse {
            id: signed_event.id.to_string(),
            pubkey: signed_event.pubkey.to_string(),
            created_at: signed_event.created_at.as_u64(),
            kind: signed_event.kind.as_u16() as u64,
            tags: signed_event
                .tags
                .iter()
                .map(|t| t.clone().to_vec())
                .collect(),
            content: signed_event.content.clone(),
            sig: signed_event.sig.to_string(),
        })
    }

    /// Delete the stored nsec from the keychain and clear session.
    #[tauri::command]
    pub async fn logout_native(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
    ) -> Result<(), String> {
        let profile_id = resolve_profile_id(&app, &profiles, &window).await?;
        // Clear session
        session.clear(Some(&profile_id)).await;

        // Clear keychain
        let entry = Entry::new(APP_SERVICE, &key_name_for_profile(&profile_id)).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Encrypt content using NIP-04 (Legacy)
    #[tauri::command]
    pub async fn encrypt_nip04(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        public_key: String,
        content: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip04::encrypt_nip04(&sk_hex, &public_key, &content)
    }

    /// Decrypt content using NIP-04 (Legacy)
    #[tauri::command]
    pub async fn decrypt_nip04(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        public_key: String,
        ciphertext: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip04::decrypt_nip04(&sk_hex, &public_key, &ciphertext)
    }

    /// Encrypt content using NIP-44 (Modern)
    #[tauri::command]
    pub async fn encrypt_nip44(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        public_key: String,
        content: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip44::encrypt_nip44(&sk_hex, &public_key, &content)
    }

    /// Decrypt content using NIP-44 (Modern)
    #[tauri::command]
    pub async fn decrypt_nip44(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        public_key: String,
        payload: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip44::decrypt_nip44(&sk_hex, &public_key, &payload)
    }

    /// Encrypt content using NIP-17 Gift Wrap
    #[tauri::command]
    pub async fn encrypt_gift_wrap(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        recipient_pk: String,
        rumor: libobscur::crypto::nip17::Rumor,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip17::wrap_rumor(&sk_hex, &recipient_pk, &rumor, None)
    }

    /// Decrypt content using NIP-17 Gift Wrap
    #[tauri::command]
    pub async fn decrypt_gift_wrap(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
        gift_wrap_content: String,
        gift_wrap_sender_pk: String,
    ) -> Result<libobscur::crypto::nip17::Rumor, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip17::unwrap_gift_wrap(
            &sk_hex,
            &gift_wrap_content,
            &gift_wrap_sender_pk,
        )
    }

    /// Get the current session secret key as a hex string.
    #[tauri::command]
    pub async fn get_session_nsec(
        app: AppHandle,
        window: WebviewWindow,
        session: State<'_, SessionState>,
        profiles: State<'_, DesktopProfileState>,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &window, &profiles, &session).await?;
        Ok(keys.secret_key().to_secret_hex())
    }
}

// Mobile implementations (secure-key scoped)
#[cfg(any(target_os = "android", target_os = "ios"))]
mod mobile {
    use crate::session::SessionState;
    use libobscur::ffi::{delete_key, has_key, load_key, store_key};
    use nostr::prelude::*;
    use serde::{Deserialize, Serialize};
    use std::borrow::Cow;
    use tauri::{AppHandle, State};
    use zeroize::Zeroizing;

    const MOBILE_PROFILE_ID: &str = "default";
    const KEY_NAME: &str = "nsec";

    fn scoped_key_id() -> String {
        format!("mobile::{MOBILE_PROFILE_ID}::{KEY_NAME}")
    }

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

    /// Ensure session is hydrated from secure key storage if not present.
    async fn ensure_session(_app: &AppHandle, session: &SessionState) -> Result<Keys, String> {
        if let Some(keys) = session.get_keys(MOBILE_PROFILE_ID).await {
            return Ok(keys);
        }

        let key_id = scoped_key_id();
        let key_exists = has_key(key_id.clone()).map_err(|error| error.to_string())?;
        if !key_exists {
            return Err("locked_no_secure_key".to_string());
        }
        let key_bytes = load_key(key_id).map_err(|error| error.to_string())?;
        let key_hex = String::from_utf8(key_bytes)
            .map_err(|_| "integrity_mismatch: secure key payload is invalid".to_string())?;
        session
            .set_keys(MOBILE_PROFILE_ID, &key_hex)
            .await
            .map_err(|error| format!("failed_to_restore_secure_session: {error}"))?;
        eprintln!("[SESSION] Mobile session re-hydrated from secure key store");
        session
            .get_keys(MOBILE_PROFILE_ID)
            .await
            .ok_or_else(|| "failed_to_restore_secure_session".to_string())
    }

    #[tauri::command]
    pub async fn get_native_npub(
        app: AppHandle,
        session: State<'_, SessionState>,
    ) -> Result<Option<String>, String> {
        match ensure_session(&app, &session).await {
            Ok(keys) => Ok(Some(keys.public_key().to_string())),
            Err(_) => Ok(None),
        }
    }

    #[tauri::command]
    pub async fn import_native_nsec(
        app: AppHandle,
        session: State<'_, SessionState>,
        nsec: String,
    ) -> Result<String, String> {
        let nsec_zero = Zeroizing::new(nsec);
        let keys = Keys::parse(&*nsec_zero).map_err(|e| e.to_string())?;
        let key_hex = keys.secret_key().to_secret_hex();

        session
            .set_keys(MOBILE_PROFILE_ID, &key_hex)
            .await
            .map_err(|error| format!("failed_to_set_secure_session: {error}"))?;

        store_key(scoped_key_id(), key_hex.into_bytes())
            .map_err(|error| format!("rust_secure_store: {}", error.to_string()))?;

        Ok(keys.public_key().to_string())
    }

    #[tauri::command]
    pub async fn generate_native_nsec(
        app: AppHandle,
        session: State<'_, SessionState>,
    ) -> Result<String, String> {
        let keys = Keys::generate();
        let key_hex = keys.secret_key().to_secret_hex();
        let key_hex_zero = Zeroizing::new(key_hex);

        session
            .set_keys(MOBILE_PROFILE_ID, &*key_hex_zero)
            .await
            .map_err(|error| format!("failed_to_set_secure_session: {error}"))?;

        store_key(scoped_key_id(), key_hex_zero.as_bytes().to_vec())
            .map_err(|error| format!("rust_secure_store: {}", error.to_string()))?;

        Ok(keys.public_key().to_string())
    }

    #[tauri::command]
    pub async fn sign_event_native(
        app: AppHandle,
        session: State<'_, SessionState>,
        req: NativeSignRequest,
    ) -> Result<NativeSignResponse, String> {
        let keys = ensure_session(&app, &session).await?;

        let unsigned_event = EventBuilder::new(Kind::from(req.kind as u16), req.content.clone())
            .tags(
                req.tags
                    .iter()
                    .map(|t| {
                        Tag::parse(t).unwrap_or(Tag::custom(
                            TagKind::Custom(Cow::Owned(t[0].clone())),
                            t[1..].to_vec(),
                        ))
                    })
                    .collect::<Vec<_>>(),
            )
            .custom_created_at(Timestamp::from(req.created_at))
            .build(keys.public_key());

        let signed_event = unsigned_event
            .sign(&keys)
            .await
            .map_err(|e| e.to_string())?;

        Ok(NativeSignResponse {
            id: signed_event.id.to_string(),
            pubkey: signed_event.pubkey.to_string(),
            created_at: signed_event.created_at.as_u64(),
            kind: signed_event.kind.as_u16() as u64,
            tags: signed_event
                .tags
                .iter()
                .map(|t| t.clone().to_vec())
                .collect(),
            content: signed_event.content.clone(),
            sig: signed_event.sig.to_string(),
        })
    }

    #[tauri::command]
    pub async fn logout_native(
        app: AppHandle,
        session: State<'_, SessionState>,
    ) -> Result<(), String> {
        let _ = app;
        session.clear(Some(MOBILE_PROFILE_ID)).await;
        delete_key(scoped_key_id()).map_err(|error| error.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub async fn encrypt_nip04(
        app: AppHandle,
        session: State<'_, SessionState>,
        public_key: String,
        content: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip04::encrypt_nip04(&sk_hex, &public_key, &content)
    }

    #[tauri::command]
    pub async fn decrypt_nip04(
        app: AppHandle,
        session: State<'_, SessionState>,
        public_key: String,
        ciphertext: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip04::decrypt_nip04(&sk_hex, &public_key, &ciphertext)
    }

    /// Encrypt content using NIP-44 (Modern)
    #[tauri::command]
    pub async fn encrypt_nip44(
        app: AppHandle,
        session: State<'_, SessionState>,
        public_key: String,
        content: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip44::encrypt_nip44(&sk_hex, &public_key, &content)
    }

    /// Decrypt content using NIP-44 (Modern)
    #[tauri::command]
    pub async fn decrypt_nip44(
        app: AppHandle,
        session: State<'_, SessionState>,
        public_key: String,
        payload: String,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip44::decrypt_nip44(&sk_hex, &public_key, &payload)
    }

    #[tauri::command]
    pub async fn encrypt_gift_wrap(
        app: AppHandle,
        session: State<'_, SessionState>,
        recipient_pk: String,
        rumor: libobscur::crypto::nip17::Rumor,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip17::wrap_rumor(&sk_hex, &recipient_pk, &rumor, None)
    }

    #[tauri::command]
    pub async fn decrypt_gift_wrap(
        app: AppHandle,
        session: State<'_, SessionState>,
        gift_wrap_content: String,
        gift_wrap_sender_pk: String,
    ) -> Result<libobscur::crypto::nip17::Rumor, String> {
        let keys = ensure_session(&app, &session).await?;
        let sk_hex = keys.secret_key().to_secret_hex();

        libobscur::crypto::nip17::unwrap_gift_wrap(
            &sk_hex,
            &gift_wrap_content,
            &gift_wrap_sender_pk,
        )
    }

    #[tauri::command]
    pub async fn get_session_nsec(
        app: AppHandle,
        session: State<'_, SessionState>,
    ) -> Result<String, String> {
        let keys = ensure_session(&app, &session).await?;
        Ok(keys.secret_key().to_secret_hex())
    }
}

// Re-export the appropriate implementation
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use desktop::*;

#[cfg(any(target_os = "android", target_os = "ios"))]
pub use mobile::*;
