use std::collections::HashMap;
use std::sync::Mutex;
use zeroize::Zeroizing;

pub struct StorageAtRestState {
    keys: Mutex<HashMap<String, Zeroizing<[u8; 32]>>>,
}

impl StorageAtRestState {
    pub fn new() -> Self {
        Self {
            keys: Mutex::new(HashMap::new()),
        }
    }

    pub fn set_key(&self, profile_id: &str, key: [u8; 32]) {
        let mut keys = self.keys.lock().expect("storage key mutex");
        keys.insert(profile_id.to_string(), Zeroizing::new(key));
    }

    pub fn get_key(&self, profile_id: &str) -> Option<[u8; 32]> {
        let keys = self.keys.lock().expect("storage key mutex");
        keys.get(profile_id).map(|value| **value)
    }

    pub fn take_key(&self, profile_id: &str) -> Option<Zeroizing<[u8; 32]>> {
        let mut keys = self.keys.lock().expect("storage key mutex");
        keys.remove(profile_id)
    }
}
