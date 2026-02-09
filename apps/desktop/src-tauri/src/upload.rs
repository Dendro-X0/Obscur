//! NIP-96 Upload Module - Pure Rust Implementation
//! 
//! This module handles file uploads to NIP-96 compatible servers using
//! direct reqwest multipart requests, bypassing all WebView/JavaScript
//! complexity.

use serde::{Serialize, Deserialize};
use tauri::{command, State};
use crate::net::NativeNetworkRuntime;
use crate::session::SessionState;
use nostr::prelude::*;
use nostr::hashes::{sha256, Hash};
// #[cfg(not(target_os = "android"))]
// use keyring::Entry;
// use zeroize::Zeroizing;
use std::borrow::Cow;
use base64::Engine;

const BUILD_VERSION: &str = "2026-02-08-OPTION-C-V2-RETRY";
// const APP_SERVICE: &str = "app.obscur.desktop";
// const KEY_NAME: &str = "nsec";

/// Response returned to the TypeScript frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResponse {
    pub status: String,         // "success" or "error"
    pub url: Option<String>,    // Uploaded file URL
    pub message: Option<String>,// Error message if any
    pub nip94_event: Option<serde_json::Value>, // Raw NIP-94 event
}

#[derive(Debug, Serialize)]
pub struct NativeError {
    pub code: String,
    pub message: String,
}

impl From<reqwest::Error> for NativeError {
    fn from(err: reqwest::Error) -> Self {
        NativeError {
            code: "NETWORK_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

impl From<std::io::Error> for NativeError {
    fn from(err: std::io::Error) -> Self {
        NativeError {
            code: "IO_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

/// Generate NIP-98 authorization header
#[cfg(not(target_os = "android"))]
async fn generate_nip98_auth(
    api_url: &str,
    file_bytes: &[u8],
    keys: &Keys,
) -> Option<String> {
    // // let entry = Entry::new(APP_SERVICE, KEY_NAME).ok()?;
    // // let nsec = entry.get_password().ok()?;
    // // let nsec_zero = Zeroizing::new(nsec);
    // // let keys = Keys::parse(nsec_zero.as_str()).ok()?;
    
    
    // Compute SHA-256 of file bytes
    let hash = sha256::Hash::hash(file_bytes);
    let payload_hash = hash.to_string();
    
    let now = Timestamp::now();
    let expiration = now.as_u64() + 120; // 2 minute expiration
    
    eprintln!("[NIP96-V2] Building auth event:");
    eprintln!("  URL: {}", api_url);
    eprintln!("  Payload hash: {}", &payload_hash[..16]);
    
    let unsigned_event = EventBuilder::new(Kind::from(27235), "")
        .tags(vec![
            Tag::custom(TagKind::Custom(Cow::Borrowed("u")), vec![api_url.to_string()]),
            Tag::custom(TagKind::Custom(Cow::Borrowed("method")), vec!["POST".to_string()]),
            Tag::custom(TagKind::Custom(Cow::Borrowed("payload")), vec![payload_hash]),
            Tag::custom(TagKind::Custom(Cow::Borrowed("expiration")), vec![expiration.to_string()]),
        ])
        .custom_created_at(now)
        .build(keys.public_key());
    
    let signed = unsigned_event.sign(keys).await.ok()?;
    let json = signed.as_json();
    let encoded = base64::engine::general_purpose::STANDARD.encode(json.as_bytes());
    
    Some(format!("Nostr {}", encoded))
}

#[cfg(target_os = "android")]
async fn generate_nip98_auth(_: &str, _: &[u8], _: &Keys) -> Option<String> {
    None // Android uses different auth mechanism (placeholder)
}

/// Extract URL from NIP-96 response
fn extract_url_from_response(json: &serde_json::Value) -> Option<String> {
    // Try nip94_event.tags first
    if let Some(event) = json.get("nip94_event") {
        if let Some(tags) = event.get("tags").and_then(|t| t.as_array()) {
            for tag in tags {
                if let Some(arr) = tag.as_array() {
                    if arr.len() >= 2 && arr[0].as_str() == Some("url") {
                        return arr[1].as_str().map(|s| s.to_string());
                    }
                }
            }
        }
    }
    
    // Try direct url field
    if let Some(url) = json.get("url").and_then(|u| u.as_str()) {
        return Some(url.to_string());
    }

    // Try data field (some servers like nostr.build wrap it)
    if let Some(data) = json.get("data") {
        // Handle data array
        if let Some(arr) = data.as_array() {
            if let Some(first) = arr.first() {
                if let Some(url) = first.get("url").and_then(|u| u.as_str()) {
                    return Some(url.to_string());
                }
            }
        }
        // Handle data object
        if let Some(obj) = data.as_object() {
            if let Some(url) = obj.get("url").and_then(|u| u.as_str()) {
                return Some(url.to_string());
            }
        }
    }

    None
}

/// Helper to send a single multipart request
async fn send_multipart_request(
    client: &reqwest::Client,
    api_url: &str,
    field_name: &str,
    file_bytes: Vec<u8>,
    file_name: String,
    content_type: String,
    auth_header: Option<String>,
) -> Result<(reqwest::StatusCode, String), NativeError> {
    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str(&content_type)
        .map_err(|e| NativeError {
            code: "MIME_ERROR".to_string(),
            message: e.to_string(),
        })?;
    
    let form = reqwest::multipart::Form::new().part(field_name.to_string(), file_part);
    
    let mut request = client.post(api_url).multipart(form);
    if let Some(auth) = auth_header {
        request = request.header("Authorization", auth);
    }
    
    let response = request.send().await?;
    let status = response.status();
    let text = response.text().await?;
    
    Ok((status, text))
}

/// Main upload command - receives bytes directly from frontend
#[command]
pub async fn nip96_upload_v2(
    net_runtime: State<'_, NativeNetworkRuntime>,
    session: State<'_, SessionState>,
    api_url: String,
    file_bytes: Vec<u8>,
    file_name: String,
    content_type: String,
) -> Result<UploadResponse, NativeError> {
    eprintln!("╔════════════════════════════════════════════════════════════╗");
    eprintln!("║ NIP-96 UPLOAD V2 (Pure Rust) - {} ║", BUILD_VERSION);
    eprintln!("╚════════════════════════════════════════════════════════════╝");
    eprintln!("[NIP96-V2] URL: {}", api_url);
    eprintln!("[NIP96-V2] File: {} ({} bytes)", file_name, file_bytes.len());
    
    if file_bytes.is_empty() {
        return Ok(UploadResponse {
            status: "error".to_string(),
            url: None,
            message: Some("Empty file bytes".to_string()),
            nip94_event: None,
        });
    }
    
    // Get keys from session
    let keys = session.get_keys().await.ok_or_else(|| NativeError {
        code: "NO_SESSION".to_string(),
        message: "Native session is not initialized. Please unlock the app.".to_string(),
    })?;

    // Generate NIP-98 authorization
    let auth_header = generate_nip98_auth(&api_url, &file_bytes, &keys).await;
    if auth_header.is_some() {
        eprintln!("[NIP96-V2] NIP-98 auth generated successfully");
    } else {
        return Err(NativeError {
            code: "AUTH_ERROR".to_string(),
            message: "Failed to generate NIP-98 authorization header.".to_string(),
        });
    }
    
    // Build HTTP client
    let client = net_runtime.build_reqwest_client()?;
    
    // Retry logic for field names: file -> files[] -> files
    let field_names = vec!["file", "files[]", "files"];
    let mut last_error = String::from("No attempts made");
    
    for field_name in field_names {
        eprintln!("[NIP96-V2] Attempting upload with field name: '{}'", field_name);
        
        // Clone bytes for each attempt (cheap for small files, safer than dealing with consumption)
        let attempt_bytes = file_bytes.clone(); 
        
        match send_multipart_request(
            &client, 
            &api_url, 
            field_name, 
            attempt_bytes, 
            file_name.clone(), 
            content_type.clone(), 
            auth_header.clone()
        ).await {
            Ok((status, body)) => {
                eprintln!("[NIP96-V2] Status: {}", status);
                
                if status.is_success() {
                    eprintln!("[NIP96-V2] Request successful with '{}'", field_name);
                    
                    // Parse response
                    let json_res: Result<serde_json::Value, _> = serde_json::from_str(&body);
                    match json_res {
                        Ok(json) => {
                            if json.get("status").and_then(|s| s.as_str()) == Some("error") {
                                let msg = json.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown API error");
                                last_error = format!("API Error: {}", msg);
                                eprintln!("[NIP96-V2] API returned error: {}", msg);
                                // If "no files provided" from API, we might continue loop, but usually API error is specific
                                if msg.to_lowercase().contains("no files") {
                                    continue;
                                }
                            } else {
                                let url = extract_url_from_response(&json);
                                let nip94 = json.get("nip94_event").cloned();
                                
                                if let Some(u) = &url {
                                    eprintln!("[NIP96-V2] ✓ Upload successful: {}", u);
                                    return Ok(UploadResponse {
                                        status: "success".to_string(),
                                        url: Some(u.clone()),
                                        message: None,
                                        nip94_event: nip94,
                                    });
                                } else {
                                    eprintln!("[NIP96-V2] ⚠ Upload completed but no URL in response");
                                    return Ok(UploadResponse {
                                        status: "success".to_string(), // Still success protocol-wise
                                        url: None,
                                        message: Some("No URL in response".to_string()),
                                        nip94_event: nip94,
                                    });
                                }
                            }
                        },
                        Err(e) => {
                            last_error = format!("JSON Parse Error: {}", e);
                            eprintln!("[NIP96-V2] Failed to parse JSON: {}", e);
                        }
                    }
                } else {
                    last_error = format!("HTTP {}: {}", status, body);
                    eprintln!("[NIP96-V2] HTTP Error: {}", last_error);
                    
                    // Specific check for 400 "No files" to trigger retry
                    if status.as_u16() == 400 && body.to_lowercase().contains("no files") {
                        eprintln!("[NIP96-V2] 'No files' error detected, retrying with next field name...");
                        continue;
                    }
                }
            },
            Err(e) => {
                last_error = format!("Network Error: {}", e.message);
                eprintln!("[NIP96-V2] Network Error: {}", last_error);
            }
        }
    }
    
    // All attempts failed
    Ok(UploadResponse {
        status: "error".to_string(),
        url: None,
        message: Some(format!("All attempts failed. Last error: {}", last_error)),
        nip94_event: None,
    })
}

// Keep legacy command for backwards compatibility during transition
#[command]
pub async fn nip96_upload(
    net_runtime: State<'_, NativeNetworkRuntime>,
    session: State<'_, SessionState>,
    api_url: String,
    file_path: String,
    content_type: Option<String>,
    _authorization: Option<String>, // Renamed to suppress warning
) -> Result<UploadResponse, NativeError> {
    eprintln!("[NIP96-LEGACY] Redirecting to V2...");
    
    // Read file from path (legacy behavior)
    let file_bytes = std::fs::read(&file_path)?;
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let content = content_type.unwrap_or_else(|| "application/octet-stream".to_string());
    
    nip96_upload_v2(net_runtime, session, api_url, file_bytes, file_name, content).await
}
