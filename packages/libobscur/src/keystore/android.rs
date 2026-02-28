use crate::ffi::ObscurError;
use super::SecureKeyStore;

pub struct AndroidKeyStore;

impl AndroidKeyStore {
    pub fn new() -> Self {
        Self
    }
}

impl SecureKeyStore for AndroidKeyStore {
    fn store_key(&self, _key_id: &str, _secret: &[u8]) -> Result<(), ObscurError> {
        // In a real implementation, this would use JNI to call Android Keystore
        Ok(())
    }

    fn load_key(&self, _key_id: &str) -> Result<Vec<u8>, ObscurError> {
        // Return dummy key for now
        Ok(vec![0u8; 32])
    }

    fn delete_key(&self, _key_id: &str) -> Result<(), ObscurError> {
        Ok(())
    }

    fn has_key(&self, _key_id: &str) -> Result<bool, ObscurError> {
        Ok(true)
    }
}
