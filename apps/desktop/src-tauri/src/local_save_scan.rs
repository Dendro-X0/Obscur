use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

pub const OBSCUR_LOCAL_SAVE_FORMAT: &str = "obscur.local_save.v1";
const SIDECAR_SUFFIX: &str = ".obscur-save.json";
const MAX_PEEK_BYTES: usize = 16_384;
const MAX_PAYLOAD_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSaveScanRequest {
    pub roots: Vec<String>,
    pub max_depth: Option<u32>,
    pub max_results: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSaveLibraryEntry {
    pub save_id: String,
    pub absolute_path: String,
    pub payload_absolute_path: String,
    pub file_name: String,
    pub public_key_hex: String,
    pub profile_label: Option<String>,
    pub exported_at_unix_ms: u64,
    pub payload_kind: String,
    pub payload_format: String,
    pub payload_bytes: u64,
    pub modified_at_unix_ms: u64,
    pub scan_root: String,
    pub discovery: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSaveScanResult {
    pub scanned_at_unix_ms: u64,
    pub roots: Vec<String>,
    pub entries: Vec<LocalSaveLibraryEntry>,
    pub truncated: bool,
    pub duration_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarPayload {
    format: String,
    save_id: Option<String>,
    public_key_hex: String,
    profile_label: Option<String>,
    exported_at_unix_ms: Option<u64>,
    payload_file_name: String,
    payload_kind: Option<String>,
    payload_format: Option<String>,
    payload_bytes: Option<u64>,
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn should_skip_dir(name: &str) -> bool {
    name.starts_with('.')
        || matches!(
            name.to_lowercase().as_str(),
            "node_modules" | "target" | ".git" | "cache" | "tmp" | "temp"
        )
}

fn is_sidecar_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.ends_with(SIDECAR_SUFFIX))
        .unwrap_or(false)
}

fn is_priority_obscur_folder(scan_root: &str) -> bool {
    let normalized = scan_root.replace('\\', "/").to_lowercase();
    normalized.ends_with("/workspace-exports")
        || normalized.ends_with("/profile-archives")
        || normalized.ends_with("workspace-exports")
        || normalized.ends_with("profile-archives")
}

fn max_depth_for_root(root: &str, default: u32) -> u32 {
    if is_priority_obscur_folder(root) {
        return 0;
    }
    let normalized = root.replace('\\', "/").to_lowercase();
    if normalized.contains("/downloads") || normalized.contains("/documents") {
        return 2.min(default);
    }
    2.min(default)
}

fn is_json_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("json"))
        .unwrap_or(false)
}

fn is_bundle_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_lowercase().ends_with(".obscur-bundle"))
        .unwrap_or(false)
}

fn is_candidate_payload(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    let lower = name.to_lowercase();
    lower.ends_with(".obscur-account-export.json")
        || lower.ends_with(".obscur-account-export")
        || lower.ends_with(".obscur-bundle")
        || (lower.ends_with(".json")
            && (lower.contains("obscur-account-export")
                || lower.contains("obscur-portable-account")
                || lower.contains("obscur-portable")
                || lower.contains("obscur-export")
                || lower.contains("obscur_account")
                || lower.contains("portable-account")
                || lower.contains("obscur")))
}

fn should_probe_payload_file(path: &Path, scan_root: &str) -> bool {
    if is_priority_obscur_folder(scan_root) {
        return is_json_file(path) || is_bundle_file(path);
    }
    is_candidate_payload(path)
}

fn read_modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn read_file_size(path: &Path) -> u64 {
    fs::metadata(path).ok().map(|meta| meta.len()).unwrap_or(0)
}

fn parse_sidecar(path: &Path, scan_root: &str) -> Option<LocalSaveLibraryEntry> {
    let raw = fs::read_to_string(path).ok()?;
    let parsed: SidecarPayload = serde_json::from_str(&raw).ok()?;
    if parsed.format != OBSCUR_LOCAL_SAVE_FORMAT {
        return None;
    }
    let public_key_hex = parsed.public_key_hex.trim().to_lowercase();
    if public_key_hex.len() != 64 {
        return None;
    }
    let parent = path.parent()?;
    let payload_path = parent.join(parsed.payload_file_name.trim());
    if !payload_path.is_file() {
        return None;
    }
    let payload_bytes = parsed.payload_bytes.unwrap_or_else(|| read_file_size(&payload_path));
    if payload_bytes > MAX_PAYLOAD_BYTES {
        return None;
    }
    let save_id = parsed
        .save_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    Some(LocalSaveLibraryEntry {
        save_id,
        absolute_path: path.to_string_lossy().to_string(),
        payload_absolute_path: payload_path.to_string_lossy().to_string(),
        file_name: parsed.payload_file_name,
        public_key_hex,
        profile_label: parsed.profile_label,
        exported_at_unix_ms: parsed.exported_at_unix_ms.unwrap_or_else(|| read_modified_ms(path)),
        payload_kind: parsed
            .payload_kind
            .unwrap_or_else(|| "unified_account_export".to_string()),
        payload_format: parsed
            .payload_format
            .unwrap_or_else(|| "obscur.unified_account_export.v1".to_string()),
        payload_bytes,
        modified_at_unix_ms: read_modified_ms(path),
        scan_root: scan_root.to_string(),
        discovery: "sidecar".to_string(),
    })
}

fn extract_json_string_field(header: &str, field: &str) -> Option<String> {
    let needle = format!("\"{field}\":");
    let start = header.find(needle.as_str())? + needle.len();
    let slice = header.get(start..)?.trim_start();
    if !slice.starts_with('"') {
        return None;
    }
    let inner = slice.get(1..)?;
    let end = inner.find('"')?;
    Some(inner.get(..end)?.to_string())
}

fn extract_json_number_field(header: &str, field: &str) -> Option<u64> {
    let needle = format!("\"{field}\":");
    let start = header.find(needle.as_str())? + needle.len();
    let slice = header.get(start..)?.trim_start();
    let end = slice
        .find(|character: char| !character.is_ascii_digit())
        .unwrap_or(slice.len());
    slice.get(..end)?.parse::<u64>().ok()
}

fn parse_payload_header(path: &Path, scan_root: &str) -> Option<LocalSaveLibraryEntry> {
    let bytes = fs::read(path).ok()?;
    if bytes.len() > MAX_PAYLOAD_BYTES as usize {
        return None;
    }
    let peek_len = bytes.len().min(MAX_PEEK_BYTES);
    let header = String::from_utf8_lossy(&bytes[..peek_len]);
    if !header.contains("obscur.unified_account_export.v1")
        && !header.contains("obscur.portable_account_bundle.v1")
        && !header.contains("obscur.encrypted_workspace_bundle")
    {
        return None;
    }
    let public_key_hex = extract_json_string_field(&header, "publicKeyHex")?
        .trim()
        .to_lowercase();
    if public_key_hex.len() != 64 {
        return None;
    }
    let exported_at_unix_ms = extract_json_number_field(&header, "exportedAtUnixMs")
        .unwrap_or_else(|| read_modified_ms(path));
    let profile_label = extract_json_string_field(&header, "profileLabel");
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("save.json")
        .to_string();
    let (payload_kind, payload_format) = if header.contains("obscur.unified_account_export.v1") {
        (
            "unified_account_export".to_string(),
            "obscur.unified_account_export.v1".to_string(),
        )
    } else if header.contains("obscur.portable_account_bundle.v1") {
        (
            "portable_account_bundle".to_string(),
            "obscur.portable_account_bundle.v1".to_string(),
        )
    } else {
        (
            "workspace_bundle".to_string(),
            "obscur.encrypted_workspace_bundle.v1".to_string(),
        )
    };
    Some(LocalSaveLibraryEntry {
        save_id: path.to_string_lossy().to_string(),
        absolute_path: path.to_string_lossy().to_string(),
        payload_absolute_path: path.to_string_lossy().to_string(),
        file_name,
        public_key_hex,
        profile_label,
        exported_at_unix_ms,
        payload_kind,
        payload_format,
        payload_bytes: bytes.len() as u64,
        modified_at_unix_ms: read_modified_ms(path),
        scan_root: scan_root.to_string(),
        discovery: "payload_header".to_string(),
    })
}

fn scan_directory(
    dir: &Path,
    scan_root: &str,
    depth: u32,
    max_depth: u32,
    entries: &mut Vec<LocalSaveLibraryEntry>,
    seen_payloads: &mut HashSet<String>,
    max_results: usize,
) {
    if depth > max_depth || entries.len() >= max_results {
        return;
    }
    let read_dir = match fs::read_dir(dir) {
        Ok(value) => value,
        Err(_) => return,
    };
    for entry in read_dir.flatten() {
        if entries.len() >= max_results {
            return;
        }
        let path = entry.path();
        if path.is_dir() {
            let dir_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("");
            if should_skip_dir(dir_name) {
                continue;
            }
            scan_directory(
                &path,
                scan_root,
                depth + 1,
                max_depth,
                entries,
                seen_payloads,
                max_results,
            );
            continue;
        }
        if !path.is_file() {
            continue;
        }
        if is_sidecar_file(&path) {
            if let Some(parsed) = parse_sidecar(&path, scan_root) {
                if seen_payloads.insert(parsed.payload_absolute_path.clone()) {
                    entries.push(parsed);
                }
            }
            continue;
        }
        if should_probe_payload_file(&path, scan_root) {
            let payload_key = path.to_string_lossy().to_string();
            if seen_payloads.contains(&payload_key) {
                continue;
            }
            if let Some(parsed) = parse_payload_header(&path, scan_root) {
                seen_payloads.insert(payload_key);
                entries.push(parsed);
            }
        }
    }
}

pub fn scan_local_saves(request: LocalSaveScanRequest) -> Result<LocalSaveScanResult, String> {
    let started = Instant::now();
    let max_depth = request.max_depth.unwrap_or(5).clamp(1, 12);
    let max_results = request.max_results.unwrap_or(120).clamp(1, 500) as usize;
    let mut entries: Vec<LocalSaveLibraryEntry> = Vec::new();
    let mut seen_payloads = HashSet::new();
    let mut truncated = false;

    for root in &request.roots {
        if entries.len() >= max_results {
            truncated = true;
            break;
        }
        let root_path = PathBuf::from(root.trim());
        if !root_path.is_dir() {
            continue;
        }
        let scan_root = root_path.to_string_lossy().to_string();
        let root_max_depth = max_depth_for_root(&scan_root, max_depth);
        let before = entries.len();
        scan_directory(
            &root_path,
            scan_root.as_str(),
            0,
            root_max_depth,
            &mut entries,
            &mut seen_payloads,
            max_results,
        );
        if entries.len() == before {
            continue;
        }
        if entries.len() >= max_results {
            truncated = true;
            break;
        }
    }

    entries.sort_by(|left, right| {
        right
            .modified_at_unix_ms
            .cmp(&left.modified_at_unix_ms)
            .then_with(|| right.exported_at_unix_ms.cmp(&left.exported_at_unix_ms))
    });
    entries.truncate(max_results);

    Ok(LocalSaveScanResult {
        scanned_at_unix_ms: now_unix_ms(),
        roots: request.roots,
        entries,
        truncated,
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_scan_dir(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("obscur-scan-test-{name}-{stamp}"))
    }

    #[test]
    fn detects_portable_account_json_in_exports_folder() {
        let exports = temp_scan_dir("exports");
        fs::create_dir_all(&exports).expect("create exports");
        let public_key = "e07f67dc".repeat(8);
        let payload = format!(
            r#"{{
  "version": 1,
  "format": "obscur.portable_account_bundle.v1",
  "payloadVersion": 1,
  "exportedAtUnixMs": 1700000000000,
  "publicKeyHex": "{public_key}",
  "profileLabel": "Satoshi",
  "ciphertext": "abc"
}}"#
        );
        fs::write(
            exports.join("obscur-portable-account-e07f67dc-2026-05-30.json"),
            payload,
        )
        .expect("write json");

        let result = scan_local_saves(LocalSaveScanRequest {
            roots: vec![exports.to_string_lossy().to_string()],
            max_depth: Some(5),
            max_results: Some(10),
        })
        .expect("scan");

        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].public_key_hex, public_key);
        assert_eq!(result.entries[0].profile_label.as_deref(), Some("Satoshi"));
        assert_eq!(result.entries[0].payload_kind, "portable_account_bundle");
        let _ = fs::remove_dir_all(exports);
    }

    #[test]
    fn portable_account_filename_is_candidate_outside_exports_folder() {
        let path = PathBuf::from("obscur-portable-account-deadbeef-2026.json");
        assert!(is_candidate_payload(&path));
    }
}
