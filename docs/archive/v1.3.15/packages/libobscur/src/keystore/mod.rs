use crate::ffi::ObscurError;

pub trait SecureKeyStore: Send + Sync {
    fn store_key(&self, key_id: &str, secret: &[u8]) -> Result<(), ObscurError>;
    fn load_key(&self, key_id: &str) -> Result<Vec<u8>, ObscurError>;
    fn delete_key(&self, key_id: &str) -> Result<(), ObscurError>;
    fn has_key(&self, key_id: &str) -> Result<bool, ObscurError>;
}

pub mod android;
pub mod ios;
pub mod desktop;

pub fn get_platform_keystore() -> Box<dyn SecureKeyStore> {
    #[cfg(target_os = "android")]
    {
        Box::new(android::AndroidKeyStore::new())
    }
    #[cfg(target_os = "ios")]
    {
        Box::new(ios::IosKeyStore::new())
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        Box::new(desktop::DesktopKeyStore::new())
    }
}
