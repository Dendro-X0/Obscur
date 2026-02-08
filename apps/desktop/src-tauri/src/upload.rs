use std::path::Path;
use tauri::{command, State};
use serde::{Serialize, Deserialize};

use crate::net::NativeNetworkRuntime;

const DEFAULT_CONTENT_TYPE: &str = "application/octet-stream";

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResponse {
    pub status: String,
    pub message: Option<String>,
    pub url: Option<String>,
    pub original_response: String, // Raw JSON for transform
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

async fn send_multipart_request(
    client: &reqwest::Client,
    api_url: &str,
    field_name: &str,
    file_name: String,
    caption: String,
    content_type: String,
    authorization: Option<String>,
    file_bytes: Vec<u8>,
) -> Result<(reqwest::StatusCode, reqwest::header::HeaderMap, String), NativeError> {
    println!("[NativeUpload] Multipart field name: {}", field_name);

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str(&content_type)
        .map_err(|e| NativeError { code: "MIME_ERROR".to_string(), message: e.to_string() })?;

    let form = reqwest::multipart::Form::new()
        .part(field_name.to_string(), part)
        .text("caption", caption);

    let mut request = client.post(api_url).multipart(form);
    if let Some(auth) = authorization {
        println!("[NativeUpload] Adding Authorization header (len: {})", auth.len());
        request = request.header("Authorization", auth);
    }

    println!("[NativeUpload] Sending request to {}", api_url);
    println!("[NativeUpload] Content-Type: {}", content_type);

    let response = request.send().await?;
    let status = response.status();
    let headers = response.headers().clone();
    let text = response.text().await?;
    Ok((status, headers, text))
}

#[command]
pub async fn nip96_upload(
    net_runtime: State<'_, NativeNetworkRuntime>,
    api_url: String,
    file_path: String,
    content_type: Option<String>,
    authorization: Option<String>,
) -> Result<UploadResponse, NativeError> {
    
    let path = Path::new(&file_path);
    let file_name = path.file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "unnamed_file".to_string());
        
    // Read file bytes
    let file_bytes = std::fs::read(&path)?;

    println!("[NativeUpload] File path: {}", file_path);
    println!("[NativeUpload] File size: {} bytes", file_bytes.len());

    if file_bytes.is_empty() {
        return Ok(UploadResponse {
            status: "error".to_string(),
            message: Some("Empty file bytes. Refusing to upload.".to_string()),
            url: None,
            original_response: "".to_string(),
        });
    }

    let resolved_content_type = content_type.clone().unwrap_or_else(|| DEFAULT_CONTENT_TYPE.to_string());
    let caption = file_name.clone();

    // Build client via unified runtime.
    // Strict providers validate the NIP-98 `u` tag against the request URL they see.
    // If reqwest follows redirects, the effective URL can change and the Authorization
    // header may be dropped (cross-host), causing 401.
    if net_runtime.is_tor_enabled() {
        println!("[NativeUpload] Using proxy: {}", net_runtime.get_proxy_url());
    }
    let client = net_runtime.build_reqwest_client()?;

    let (mut status, mut headers, mut text) = send_multipart_request(
        &client,
        &api_url,
        "file",
        file_name.clone(),
        caption.clone(),
        resolved_content_type.clone(),
        authorization.clone(),
        file_bytes,
    ).await?;

    if status.as_u16() == 400 && text.to_lowercase().contains("no files") {
        println!("[NativeUpload] Provider reported missing files; retrying with alternate multipart field name");
        let retry_bytes = std::fs::read(&path)?;
        let (retry_status, retry_headers, retry_text) = send_multipart_request(
            &client,
            &api_url,
            "files",
            file_name.clone(),
            caption.clone(),
            resolved_content_type.clone(),
            authorization.clone(),
            retry_bytes,
        ).await?;
        status = retry_status;
        headers = retry_headers;
        text = retry_text;
    }

    if status.is_redirection() {
        let location = headers
            .get(reqwest::header::LOCATION)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        println!("[NativeUpload] Redirect {} -> {}", api_url, location);
        return Ok(UploadResponse {
            status: "error".to_string(),
            message: Some(format!(
                "HTTP {} redirect. Update provider URL to the final endpoint. location={} body={}",
                status,
                location,
                text
            )),
            url: None,
            original_response: text,
        });
    }

    if !status.is_success() {
        println!("[NativeUpload] Upload failed with status {}: {}", status, text);
        return Ok(UploadResponse {
            status: "error".to_string(),
            message: Some(format!("HTTP {}: {}", status, text)),
            url: None,
            original_response: text,
        });
    }

    println!("[NativeUpload] Upload successful");

    // Success - let frontend parse the complex NIP-96 JSON
    Ok(UploadResponse {
        status: "success".to_string(),
        message: None,
        url: None, // Frontend extracts URL from original_response
        original_response: text,
    })
}
