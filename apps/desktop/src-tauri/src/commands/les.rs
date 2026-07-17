use base64::Engine;
use serde::Serialize;
use tauri::{AppHandle, State, WebviewWindow};

use crate::data_root::resolve_effective_data_root;
use crate::profiles::{resolve_profile_for_window, DesktopProfileState};
use crate::storage_at_rest_state::StorageAtRestState;

async fn resolve_profile_id(
    app: &AppHandle,
    profiles: &State<'_, DesktopProfileState>,
    window: &WebviewWindow,
    profile_id: Option<String>,
) -> Result<String, String> {
    match profile_id {
        Some(value) if !value.trim().is_empty() => Ok(value.trim().to_string()),
        _ => resolve_profile_for_window(app, profiles, window).await,
    }
}

fn require_pdk(
    storage_keys: &State<'_, StorageAtRestState>,
    profile_id: &str,
) -> Result<[u8; 32], String> {
    storage_keys
        .get_key(profile_id)
        .ok_or_else(|| "Unlock this profile to use LES (no profile data key in session).".to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LesCommitReceiptDto {
    pub les_object_id: String,
    pub profile_id: String,
    pub relative_path: String,
    pub catalog_revision: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LesObjectMetaDto {
    pub les_object_id: String,
    pub profile_id: String,
    pub kind: String,
    pub display_name: String,
    pub content_type: String,
    pub byte_length: u64,
    pub created_at_unix_ms: i64,
    pub source: String,
    pub source_attachment_url: Option<String>,
    pub relative_path: String,
}

fn map_meta(meta: libobscur::les::LesObjectMeta) -> LesObjectMetaDto {
    LesObjectMetaDto {
        les_object_id: meta.les_object_id,
        profile_id: meta.profile_id,
        kind: meta.kind.as_str().to_string(),
        display_name: meta.display_name,
        content_type: meta.content_type,
        byte_length: meta.byte_length,
        created_at_unix_ms: meta.created_at_unix_ms,
        source: meta.source.as_str().to_string(),
        source_attachment_url: meta.source_attachment_url,
        relative_path: meta.relative_path,
    }
}

#[tauri::command]
pub async fn desktop_les_commit(
    app: AppHandle,
    window: WebviewWindow,
    profiles: State<'_, DesktopProfileState>,
    storage_keys: State<'_, StorageAtRestState>,
    profile_id: Option<String>,
    bytes_b64: String,
    kind: String,
    display_name: String,
    content_type: String,
    source: String,
    source_attachment_url: Option<String>,
) -> Result<LesCommitReceiptDto, String> {
    let resolved_profile_id = resolve_profile_id(&app, &profiles, &window, profile_id).await?;
    let pdk = require_pdk(&storage_keys, &resolved_profile_id)?;
    let data_root = resolve_effective_data_root(&app)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(bytes_b64.trim())
        .map_err(|e| format!("Invalid LES bytes encoding: {e}"))?;
    let kind = libobscur::les::LesKind::parse(&kind)
        .ok_or_else(|| format!("Unsupported LES kind: {kind}"))?;
    let source = libobscur::les::LesSource::parse(&source)
        .ok_or_else(|| format!("Unsupported LES source: {source}"))?;

    let receipt = libobscur::les::commit_object(
        &data_root,
        &pdk,
        libobscur::les::CommitInput {
            profile_id: &resolved_profile_id,
            bytes: &bytes,
            kind,
            display_name: &display_name,
            content_type: &content_type,
            source,
            source_attachment_url: source_attachment_url.as_deref(),
            active_profile_id: Some(&resolved_profile_id),
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(LesCommitReceiptDto {
        les_object_id: receipt.les_object_id,
        profile_id: receipt.profile_id,
        relative_path: receipt.relative_path,
        catalog_revision: receipt.catalog_revision,
    })
}

#[tauri::command]
pub async fn desktop_les_list(
    app: AppHandle,
    window: WebviewWindow,
    profiles: State<'_, DesktopProfileState>,
    profile_id: Option<String>,
) -> Result<Vec<LesObjectMetaDto>, String> {
    let resolved_profile_id = resolve_profile_id(&app, &profiles, &window, profile_id).await?;
    let data_root = resolve_effective_data_root(&app)?;
    let rows = libobscur::les::list_objects(&data_root, &resolved_profile_id)?;
    Ok(rows.into_iter().map(map_meta).collect())
}

#[tauri::command]
pub async fn desktop_les_get(
    app: AppHandle,
    window: WebviewWindow,
    profiles: State<'_, DesktopProfileState>,
    profile_id: Option<String>,
    les_object_id: String,
) -> Result<Option<LesObjectMetaDto>, String> {
    let resolved_profile_id = resolve_profile_id(&app, &profiles, &window, profile_id).await?;
    let data_root = resolve_effective_data_root(&app)?;
    let row = libobscur::les::get_object(&data_root, &resolved_profile_id, &les_object_id)?;
    Ok(row.map(map_meta))
}

#[tauri::command]
pub async fn desktop_les_read_decrypted(
    app: AppHandle,
    window: WebviewWindow,
    profiles: State<'_, DesktopProfileState>,
    storage_keys: State<'_, StorageAtRestState>,
    profile_id: Option<String>,
    les_object_id: String,
) -> Result<String, String> {
    let resolved_profile_id = resolve_profile_id(&app, &profiles, &window, profile_id).await?;
    let pdk = require_pdk(&storage_keys, &resolved_profile_id)?;
    let data_root = resolve_effective_data_root(&app)?;
    let meta = libobscur::les::get_object(&data_root, &resolved_profile_id, &les_object_id)?
        .ok_or_else(|| "LES object not found for active profile".to_string())?;
    if meta.profile_id != resolved_profile_id {
        return Err("LES read refused: object belongs to another profile".to_string());
    }
    let absolute = data_root.join(&meta.relative_path);
    let plaintext = libobscur::storage_at_rest::read_encrypted_file(&absolute, &pdk)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(plaintext))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LesDeleteReceiptDto {
    pub deleted: bool,
    pub les_object_id: String,
    pub profile_id: String,
}

#[tauri::command]
pub async fn desktop_les_delete(
    app: AppHandle,
    window: WebviewWindow,
    profiles: State<'_, DesktopProfileState>,
    profile_id: Option<String>,
    les_object_id: String,
) -> Result<LesDeleteReceiptDto, String> {
    let resolved_profile_id = resolve_profile_id(&app, &profiles, &window, profile_id).await?;
    let data_root = resolve_effective_data_root(&app)?;
    let deleted = libobscur::les::delete_object(&data_root, &resolved_profile_id, &les_object_id)
        .map_err(|e| e.to_string())?;
    Ok(LesDeleteReceiptDto {
        deleted,
        les_object_id: les_object_id.trim().to_string(),
        profile_id: resolved_profile_id,
    })
}
