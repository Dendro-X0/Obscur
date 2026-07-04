use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const LEDGER_PREFIX: &str = "obscur.group.membership_ledger.v1.";
const DIRECTORY_PREFIX: &str = "obscur.community.coordination_membership_directory.v1";
const IDENTITY_RECORD_PREFIX: &str = "obscur.identity.record::";
const LEGACY_IDENTITY_PREFIX: &str = "identity::";
const PASSWORDLESS_IDENTITY_SENTINEL: &str = "__obscur_native_only__";
const MAX_SCAN_FILE_BYTES: u64 = 20_000_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarvestedLedgerSnapshot {
    pub profile_slot: String,
    pub public_key_hex: String,
    pub entries: serde_json::Value,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarvestedDirectorySnapshot {
    pub profile_slot: String,
    pub records: serde_json::Value,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarvestedIdentitySnapshot {
    pub profile_slot: String,
    pub profile_id: String,
    pub public_key_hex: String,
    pub record: serde_json::Value,
    pub is_passwordless: bool,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileWebStorageHarvestResult {
    pub ledgers: Vec<HarvestedLedgerSnapshot>,
    pub directories: Vec<HarvestedDirectorySnapshot>,
    pub identities: Vec<HarvestedIdentitySnapshot>,
    pub scanned_file_count: u32,
}

fn sanitize_json_control_chars(value: &str) -> String {
    value
        .chars()
        .filter(|ch| {
            !matches!(
                ch,
                '\u{0000}'..='\u{0008}' | '\u{000b}' | '\u{000c}' | '\u{000e}'..='\u{001f}'
            )
        })
        .collect()
}

fn extract_balanced_json_slice(text: &str, open_ch: char, close_ch: char) -> Option<&str> {
    let start = text.find(open_ch)?;
    let mut depth = 0usize;
    for (index, ch) in text[start..].char_indices() {
        if ch == open_ch {
            depth += 1;
        } else if ch == close_ch {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                return Some(&text[start..=start + index]);
            }
        }
    }
    None
}

fn parse_ledger_key_suffix(raw_key: &str) -> Option<(String, String)> {
    let suffix = raw_key.strip_prefix(LEDGER_PREFIX)?;
    let (pubkey, profile_slot) = if let Some((pubkey, profile_slot)) = suffix.split_once("::") {
        (pubkey.trim().to_lowercase(), profile_slot.trim().to_string())
    } else {
        (suffix.trim().to_lowercase(), "default".to_string())
    };
    if pubkey.len() != 64 || !pubkey.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }
    Some((pubkey, profile_slot))
}

fn parse_identity_storage_key(raw_key: &str) -> Option<String> {
    let trimmed = raw_key.trim();
    if let Some(profile_id) = trimmed.strip_prefix(IDENTITY_RECORD_PREFIX) {
        let normalized = profile_id.trim();
        if !normalized.is_empty() {
            return Some(normalized.to_string());
        }
    }
    if let Some(profile_id) = trimmed.strip_prefix(LEGACY_IDENTITY_PREFIX) {
        let normalized = profile_id.trim();
        if !normalized.is_empty() {
            return Some(normalized.to_string());
        }
    }
    None
}

fn read_json_string_value(text: &str, quote_index: usize) -> Option<(String, usize)> {
    if text.as_bytes().get(quote_index) != Some(&b'"') {
        return None;
    }
    let mut escaped = false;
    let mut value = String::new();
    let mut index = quote_index + 1;
    while index < text.len() {
        let ch = text.as_bytes()[index];
        if escaped {
            value.push(char::from(ch));
            escaped = false;
            index += 1;
            continue;
        }
        if ch == b'\\' {
            escaped = true;
            index += 1;
            continue;
        }
        if ch == b'"' {
            return Some((value, index + 1));
        }
        value.push(char::from(ch));
        index += 1;
    }
    None
}

fn try_extract_identity_record_json(raw_chunk: &str) -> Option<String> {
    let sanitized = sanitize_json_control_chars(raw_chunk);
    let object_start = sanitized.find('{')?;
    let rest = &sanitized[object_start..];
    let public_key_marker = "\"publicKeyHex\":\"";
    let public_key_start = rest.find(public_key_marker)? + public_key_marker.len();
    let public_key_hex = rest.get(public_key_start..public_key_start + 64)?;
    if !public_key_hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }
    let encrypted_marker = "\"encryptedPrivateKey\":\"";
    let encrypted_quote = rest.find(encrypted_marker)? + encrypted_marker.len() - 1;
    let (encrypted_private_key, _) = read_json_string_value(rest, encrypted_quote)?;
    if encrypted_private_key.trim().is_empty() {
        return None;
    }
    let username = rest
        .find("\"username\":\"")
        .and_then(|marker_start| {
            let quote = marker_start + "\"username\":\"".len() - 1;
            read_json_string_value(rest, quote).map(|(value, _)| value)
        })
        .filter(|value| !value.trim().is_empty());
    let payload = if let Some(username) = username {
        serde_json::json!({
            "publicKeyHex": public_key_hex,
            "encryptedPrivateKey": encrypted_private_key,
            "username": username,
        })
    } else {
        serde_json::json!({
            "publicKeyHex": public_key_hex,
            "encryptedPrivateKey": encrypted_private_key,
        })
    };
    serde_json::to_string(&payload).ok()
}

fn extract_identity_records_from_storage_prefix(data: &[u8], prefix: &str) -> Vec<String> {
    let mut results = Vec::new();
    let needle = prefix.as_bytes();
    let mut search_from = 0usize;
    while let Some(relative_index) = data[search_from..].windows(needle.len()).position(|window| window == needle) {
        let index = search_from + relative_index;
        let end = (index + 16_000).min(data.len());
        let chunk = String::from_utf8_lossy(&data[index..end]);
        if let Some(serialized) = try_extract_identity_record_json(&chunk) {
            results.push(serialized);
        }
        search_from = index + needle.len();
    }
    results
}

fn push_harvested_identity_from_object(
    result: &mut ProfileWebStorageHarvestResult,
    profile_slot: &str,
    profile_id: &str,
    serialized: &str,
    source_path: &str,
) {
    let Ok(record) = serde_json::from_str::<serde_json::Value>(serialized) else {
        return;
    };
    let Some(public_key_hex) = record
        .get("publicKeyHex")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_lowercase())
    else {
        return;
    };
    if public_key_hex.len() != 64 || !public_key_hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return;
    }
    let encrypted_private_key = record
        .get("encryptedPrivateKey")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let is_passwordless = encrypted_private_key == PASSWORDLESS_IDENTITY_SENTINEL
        || encrypted_private_key.contains("_native_only__");
    result.identities.push(HarvestedIdentitySnapshot {
        profile_slot: profile_slot.to_string(),
        profile_id: profile_id.to_string(),
        public_key_hex,
        record,
        is_passwordless,
        source_path: source_path.to_string(),
    });
}

fn scan_identity_records_in_file(
    data: &[u8],
    profile_slot: &str,
    source_path: &str,
    result: &mut ProfileWebStorageHarvestResult,
) {
    for prefix in [IDENTITY_RECORD_PREFIX, LEGACY_IDENTITY_PREFIX] {
        let needle = prefix.as_bytes();
        let mut search_from = 0usize;
        while let Some(relative_index) = data[search_from..].windows(needle.len()).position(|window| window == needle) {
            let index = search_from + relative_index;
            let key_end = data[index..]
                .iter()
                .position(|byte| *byte == b'{')
                .map(|offset| index + offset)
                .unwrap_or(index);
            let raw_key = String::from_utf8_lossy(&data[index..key_end]);
            let Some(profile_id) = parse_identity_storage_key(raw_key.trim()) else {
                search_from = index + needle.len();
                continue;
            };
            for serialized in extract_identity_records_from_storage_prefix(&data[index..], prefix) {
                push_harvested_identity_from_object(result, profile_slot, &profile_id, &serialized, source_path);
            }
            search_from = index + needle.len();
        }
    }
}

fn extract_json_arrays_from_prefix(data: &[u8], prefix: &str) -> Vec<String> {
    let mut results = Vec::new();
    let needle = prefix.as_bytes();
    let mut search_from = 0usize;
    while let Some(relative_index) = data[search_from..].windows(needle.len()).position(|window| window == needle) {
        let index = search_from + relative_index;
        let end = (index + 12_000).min(data.len());
        let chunk = String::from_utf8_lossy(&data[index..end]);
        let sanitized = sanitize_json_control_chars(&chunk);
        if let Some(slice) = extract_balanced_json_slice(&sanitized, '[', ']') {
            if serde_json::from_str::<serde_json::Value>(slice).is_ok() {
                results.push(slice.to_string());
            }
        }
        search_from = index + needle.len();
    }
    results
}

fn should_scan_file(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    file_name.ends_with(".ldb")
        || file_name.ends_with(".log")
        || file_name.ends_with(".sst")
}

fn infer_profile_slot(profile_root: &Path) -> String {
    profile_root
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn scan_profile_tree(
    profile_root: &Path,
    result: &mut ProfileWebStorageHarvestResult,
) -> Result<(), String> {
    if !profile_root.is_dir() {
        return Ok(());
    }
    let profile_slot = infer_profile_slot(profile_root);
    for entry in fs::read_dir(profile_root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            scan_profile_tree(&path, result)?;
            continue;
        }
        if !should_scan_file(&path) {
            continue;
        }
        let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
        if metadata.len() > MAX_SCAN_FILE_BYTES {
            continue;
        }
        let data = fs::read(&path).map_err(|error| error.to_string())?;
        result.scanned_file_count += 1;

        let mut ledger_offsets = Vec::new();
        let ledger_needle = LEDGER_PREFIX.as_bytes();
        let mut search_from = 0usize;
        while let Some(relative_index) = data[search_from..]
            .windows(ledger_needle.len())
            .position(|window| window == ledger_needle)
        {
            let index = search_from + relative_index;
            ledger_offsets.push(index);
            search_from = index + ledger_needle.len();
        }

        for offset in ledger_offsets {
            let key_end = data[offset..]
                .iter()
                .position(|byte| *byte == b'[')
                .map(|index| offset + index)
                .unwrap_or(offset);
            let raw_key = String::from_utf8_lossy(&data[offset..key_end]);
            let Some((public_key_hex, source_profile_slot)) = parse_ledger_key_suffix(raw_key.trim()) else {
                continue;
            };
            let arrays = extract_json_arrays_from_prefix(&data[offset..], LEDGER_PREFIX);
            for serialized in arrays {
                let Ok(entries) = serde_json::from_str::<serde_json::Value>(&serialized) else {
                    continue;
                };
                result.ledgers.push(HarvestedLedgerSnapshot {
                    profile_slot: source_profile_slot.clone(),
                    public_key_hex: public_key_hex.clone(),
                    entries,
                    source_path: path.to_string_lossy().to_string(),
                });
            }
        }

        for serialized in extract_json_arrays_from_prefix(&data, DIRECTORY_PREFIX) {
            let Ok(records) = serde_json::from_str::<serde_json::Value>(&serialized) else {
                continue;
            };
            result.directories.push(HarvestedDirectorySnapshot {
                profile_slot: profile_slot.clone(),
                records,
                source_path: path.to_string_lossy().to_string(),
            });
        }

        scan_identity_records_in_file(
            &data,
            &profile_slot,
            &path.to_string_lossy(),
            result,
        );
    }
    Ok(())
}

pub fn harvest_profile_web_storage_from_roots(
    roots: &[PathBuf],
) -> Result<ProfileWebStorageHarvestResult, String> {
    let mut result = ProfileWebStorageHarvestResult {
        ledgers: Vec::new(),
        directories: Vec::new(),
        identities: Vec::new(),
        scanned_file_count: 0,
    };
    for root in roots {
        let profiles_dir = root.join("profiles");
        if !profiles_dir.is_dir() {
            continue;
        }
        for entry in fs::read_dir(&profiles_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            if entry.path().is_dir() {
                scan_profile_tree(&entry.path(), &mut result)?;
            }
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn extracts_ledger_array_from_leveldb_like_binary() {
        let dir = std::env::temp_dir().join(format!(
            "obscur-harvest-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let profile_dir = dir.join("profiles").join("profile-2");
        let leveldb_dir = profile_dir
            .join("EBWebView")
            .join("Default")
            .join("Local Storage")
            .join("leveldb");
        fs::create_dir_all(&leveldb_dir).unwrap();
        let payload = format!(
            "{LEDGER_PREFIX}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa::profile-2\x01\x17\
            [{{\"groupId\":\"group-a\",\"relayUrl\":\"ws://localhost:7000\",\"status\":\"joined\",\"displayName\":\"NewTest 2\"}}]"
        );
        let file_path = leveldb_dir.join("000013.log");
        let mut file = fs::File::create(&file_path).unwrap();
        file.write_all(payload.as_bytes()).unwrap();

        let harvest = harvest_profile_web_storage_from_roots(&[dir.clone()]).unwrap();
        assert_eq!(harvest.scanned_file_count, 1);
        assert_eq!(harvest.ledgers.len(), 1);
        assert_eq!(
            harvest.ledgers[0].public_key_hex,
            "a".repeat(64)
        );
        assert_eq!(
            harvest.ledgers[0].entries[0]["displayName"].as_str(),
            Some("NewTest 2")
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn prefers_password_protected_identity_over_passwordless_snapshot() {
        let dir = std::env::temp_dir().join(format!(
            "obscur-identity-harvest-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let leveldb_dir = dir
            .join("profiles")
            .join("default")
            .join("EBWebView")
            .join("Default")
            .join("Local Storage")
            .join("leveldb");
        fs::create_dir_all(&leveldb_dir).unwrap();
        let encrypted = concat!(
            r#"{"publicKeyHex":"e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56","#,
            r#""encryptedPrivateKey":"{\"v\":1,\"alg\":\"PBKDF2-SHA256/AES-256-GCM\"}","#,
            r#""username":"Tester1"}"#
        );
        let passwordless = concat!(
            r#"{"publicKeyHex":"e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56","#,
            r#""encryptedPrivateKey":"__obscur_native_only__","username":"Tester1"}"#
        );
        let older = format!("{IDENTITY_RECORD_PREFIX}default\x01\x01{encrypted}");
        let newer = format!("{IDENTITY_RECORD_PREFIX}default\x01\x01{passwordless}");
        fs::write(leveldb_dir.join("000005.ldb"), older.as_bytes()).unwrap();
        fs::write(leveldb_dir.join("000017.ldb"), newer.as_bytes()).unwrap();

        let harvest = harvest_profile_web_storage_from_roots(&[dir.clone()]).unwrap();
        let password_protected: Vec<_> = harvest
            .identities
            .iter()
            .filter(|snapshot| !snapshot.is_passwordless)
            .collect();
        assert_eq!(password_protected.len(), 1);
        assert_eq!(
            password_protected[0].record["username"].as_str(),
            Some("Tester1")
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
