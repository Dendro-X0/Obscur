use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub const PROFILE_DATA_KEY_CONTEXT: &str = "obscur.pdk.v1";
pub const PROFILE_DATA_KEY_CONTEXT_V2: &str = "obscur.pdk.v2";
pub const PROFILE_DATA_KEY_ITERATIONS: u32 = 200_000;
pub const PROFILE_DATA_KEY_ARGON2_M_COST: u32 = 65_536;
pub const PROFILE_DATA_KEY_ARGON2_T_COST: u32 = 3;
pub const PROFILE_DATA_KEY_ARGON2_P_COST: u32 = 4;
pub const SQLITE_AT_REST_SUFFIX: &str = ".obscur-enc";
pub const STORAGE_FILE_MAGIC: &[u8; 8] = b"OBSCURST";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageAtRestEnvelope {
    pub nonce: [u8; 12],
    pub ciphertext: Vec<u8>,
}

pub fn derive_profile_data_key(passphrase: &str, profile_id: &str) -> [u8; 32] {
    derive_profile_data_key_v1(passphrase, profile_id)
}

pub fn derive_profile_data_key_v1(passphrase: &str, profile_id: &str) -> [u8; 32] {
    let context = format!("{PROFILE_DATA_KEY_CONTEXT}|{}", profile_id.trim());
    let hash = Sha256::digest(context.as_bytes());
    let salt = &hash[..16];
    let mut key = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), salt, PROFILE_DATA_KEY_ITERATIONS, &mut key);
    key
}

pub fn derive_profile_data_key_v2(passphrase: &str, profile_id: &str) -> Result<[u8; 32], String> {
    let context = format!("{PROFILE_DATA_KEY_CONTEXT_V2}|{}", profile_id.trim());
    let hash = Sha256::digest(context.as_bytes());
    let salt = &hash[..16];
    let params = Params::new(
        PROFILE_DATA_KEY_ARGON2_M_COST,
        PROFILE_DATA_KEY_ARGON2_T_COST,
        PROFILE_DATA_KEY_ARGON2_P_COST,
        Some(32),
    )
    .map_err(|e| e.to_string())?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key)
}

pub fn encrypt_storage_blob(key: &[u8; 32], plaintext: &[u8]) -> Result<StorageAtRestEnvelope, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut nonce = [0u8; 12];
    getrandom::getrandom(&mut nonce).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|e| e.to_string())?;
    Ok(StorageAtRestEnvelope { nonce, ciphertext })
}

pub fn decrypt_storage_blob(key: &[u8; 32], envelope: &StorageAtRestEnvelope) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    cipher
        .decrypt(Nonce::from_slice(&envelope.nonce), envelope.ciphertext.as_ref())
        .map_err(|e| e.to_string())
}

pub fn encrypted_sidecar_path(source: &Path) -> PathBuf {
    let file_name = source
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "storage.bin".to_string());
    source.with_file_name(format!("{file_name}{SQLITE_AT_REST_SUFFIX}"))
}

pub fn write_encrypted_file(path: &Path, key: &[u8; 32], plaintext: &[u8]) -> Result<(), String> {
    let envelope = encrypt_storage_blob(key, plaintext)?;
    let mut payload = Vec::with_capacity(STORAGE_FILE_MAGIC.len() + 1 + 12 + envelope.ciphertext.len());
    payload.extend_from_slice(STORAGE_FILE_MAGIC);
    payload.push(1);
    payload.extend_from_slice(&envelope.nonce);
    payload.extend_from_slice(&envelope.ciphertext);
    fs::write(path, payload).map_err(|e| e.to_string())
}

pub fn read_encrypted_file(path: &Path, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let payload = fs::read(path).map_err(|e| e.to_string())?;
    if payload.len() < STORAGE_FILE_MAGIC.len() + 1 + 12 {
        return Err("Encrypted storage payload is too short.".to_string());
    }
    if &payload[..STORAGE_FILE_MAGIC.len()] != STORAGE_FILE_MAGIC {
        return Err("Encrypted storage payload has invalid magic.".to_string());
    }
    if payload[STORAGE_FILE_MAGIC.len()] != 1 {
        return Err("Unsupported encrypted storage version.".to_string());
    }
    let nonce_start = STORAGE_FILE_MAGIC.len() + 1;
    let nonce_end = nonce_start + 12;
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&payload[nonce_start..nonce_end]);
    let envelope = StorageAtRestEnvelope {
        nonce,
        ciphertext: payload[nonce_end..].to_vec(),
    };
    decrypt_storage_blob(key, &envelope)
}

pub fn encrypt_file_in_place(source: &Path, key: &[u8; 32]) -> Result<PathBuf, String> {
    let plaintext = fs::read(source).map_err(|e| e.to_string())?;
    let target = encrypted_sidecar_path(source);
    write_encrypted_file(&target, key, &plaintext)?;
    fs::remove_file(source).map_err(|e| e.to_string())?;
    Ok(target)
}

pub fn decrypt_file_to_plaintext(source_enc: &Path, target_plain: &Path, key: &[u8; 32]) -> Result<(), String> {
    let plaintext = read_encrypted_file(source_enc, key)?;
    fs::write(target_plain, plaintext).map_err(|e| e.to_string())?;
    fs::remove_file(source_enc).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    #[test]
    fn pdk_vector_matches_typescript_fixture() {
        let key = derive_profile_data_key("Obscur-Phase3-Test-Vector!", "default");
        let encoded = base64::engine::general_purpose::STANDARD.encode(key);
        assert_eq!(encoded, "lnGC7LuCyiiM3KdFYsC5vXnZfGI9bCDbcfcy4MqXWdY=");
    }

    #[test]
    fn pdk_v2_vector_matches_typescript_fixture() {
        let key = derive_profile_data_key_v2("Obscur-Phase3-Test-Vector!", "default").expect("derive v2");
        let encoded = base64::engine::general_purpose::STANDARD.encode(key);
        assert_eq!(encoded, "8hRUYJFEHcuVK957qfA6WhyUrS9mFCS5QMnjRtiN3Bc=");
    }

    #[test]
    fn storage_blob_roundtrip() {
        let key = derive_profile_data_key("Obscur-Phase3-Test-Vector!", "default");
        let envelope = encrypt_storage_blob(&key, b"sqlite-not-plaintext").expect("encrypt");
        let restored = decrypt_storage_blob(&key, &envelope).expect("decrypt");
        assert_eq!(restored, b"sqlite-not-plaintext");
    }
}
