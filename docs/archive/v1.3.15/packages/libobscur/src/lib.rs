//! libobscur
//! 
//! This crate contains the shared core logic for the Obscur project.
//! It is designed to be cross-platform, compiling to native binaries via Tauri
//! and eventually to other platforms using Uniffi/Kotlin/Swift.

pub mod crypto;
pub mod db;
pub mod net;
pub mod keystore;
pub mod ffi;
pub mod protocol;

uniffi::setup_scaffolding!("libobscur");

/// A placeholder function to verify the crate builds correctly.
pub fn init_core() -> &'static str {
    "libobscur core initialized"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_core() {
        assert_eq!(init_core(), "libobscur core initialized");
    }
}
