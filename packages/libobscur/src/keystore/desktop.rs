use crate::ffi::ObscurError;
use super::SecureKeyStore;

pub struct DesktopKeyStore;

impl DesktopKeyStore {
    pub fn new() -> Self {
        Self
    }
}

impl SecureKeyStore for DesktopKeyStore {
    fn store_key(&self, _key_id: &str, _secret: &[u8]) -> Result<(), ObscurError> {
        // Use keyring crate on desktop
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
