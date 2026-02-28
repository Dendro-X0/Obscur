use crate::ffi::ObscurError;
use super::SecureKeyStore;

pub struct IosKeyStore;

impl IosKeyStore {
    pub fn new() -> Self {
        Self
    }
}

impl SecureKeyStore for IosKeyStore {
    fn store_key(&self, _key_id: &str, _secret: &[u8]) -> Result<(), ObscurError> {
        // In a real implementation, this would use security-framework to store in Keychain
        Ok(())
    }

    fn load_key(&self, _key_id: &str) -> Result<Vec<u8>, ObscurError> {
        Ok(vec![0u8; 32])
    }

    fn delete_key(&self, _key_id: &str) -> Result<(), ObscurError> {
        Ok(())
    }

    fn has_key(&self, _key_id: &str) -> Result<bool, ObscurError> {
        Ok(true)
    }
}
