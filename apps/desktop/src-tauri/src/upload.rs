use std::path::Path;
use tauri::command;
use serde::{Serialize, Deserialize};

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

#[command]
pub async fn nip96_upload(
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

    // Create multipart form
    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name.clone())
        .mime_str(content_type.as_deref().unwrap_or("application/octet-stream"))
        .map_err(|e| NativeError { code: "MIME_ERROR".to_string(), message: e.to_string() })?;

    let form = reqwest::multipart::Form::new()
        .part("file", part)
        // Add caption as per NIP-96 spec (optional but good practice)
        .text("caption", file_name);

    // Build client
    let client = reqwest::Client::new();
    let mut request = client.post(&api_url)
        .multipart(form);

    if let Some(auth) = authorization {
        request = request.header("Authorization", auth);
    }

    // Execute
    let response = request.send().await?;
    let status = response.status();
    let text = response.text().await?;

    if !status.is_success() {
        return Ok(UploadResponse {
            status: "error".to_string(),
            message: Some(format!("HTTP {}: {}", status, text)),
            url: None,
            original_response: text,
        });
    }

    // Success - let frontend parse the complex NIP-96 JSON
    Ok(UploadResponse {
        status: "success".to_string(),
        message: None,
        url: None, // Frontend extracts URL from original_response
        original_response: text,
    })
}
