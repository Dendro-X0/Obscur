use crate::ffi::ObscurError;
use super::SecureKeyStore;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

pub struct AndroidKeyStore;

fn key_store() -> &'static Mutex<HashMap<String, Vec<u8>>> {
    static STORE: OnceLock<Mutex<HashMap<String, Vec<u8>>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

impl AndroidKeyStore {
    pub fn new() -> Self {
        Self
    }
}

impl SecureKeyStore for AndroidKeyStore {
    fn store_key(&self, key_id: &str, secret: &[u8]) -> Result<(), ObscurError> {
        let mut store = key_store()
            .lock()
            .map_err(|_| ObscurError::from("storage_unavailable: key store lock poisoned".to_string()))?;
        store.insert(key_id.to_string(), secret.to_vec());
        Ok(())
    }

    fn load_key(&self, key_id: &str) -> Result<Vec<u8>, ObscurError> {
        let store = key_store()
            .lock()
            .map_err(|_| ObscurError::from("storage_unavailable: key store lock poisoned".to_string()))?;
        store.get(key_id).cloned().ok_or_else(|| {
            ObscurError::from(format!(
                "locked_no_secure_key: secure key unavailable for key_id={key_id}"
            ))
        })
    }

    fn delete_key(&self, key_id: &str) -> Result<(), ObscurError> {
        let mut store = key_store()
            .lock()
            .map_err(|_| ObscurError::from("storage_unavailable: key store lock poisoned".to_string()))?;
        let _ = store.remove(key_id);
        Ok(())
    }

    fn has_key(&self, key_id: &str) -> Result<bool, ObscurError> {
        let store = key_store()
            .lock()
            .map_err(|_| ObscurError::from("storage_unavailable: key store lock poisoned".to_string()))?;
        Ok(store.contains_key(key_id))
    }
}
