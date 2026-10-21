//! Secure random bytes for NativeCryptoService.generateSecureRandom / generateInviteId.
//! @see specs/backend/crypto-native-random-verify-design-2026-10.md

const MAX_LEN: usize = 1024;

/// Returns lowercase hex of `length` cryptographically random bytes.
pub fn generate_secure_random_hex(length: usize) -> Result<String, String> {
    if length == 0 || length > MAX_LEN {
        return Err(format!("length must be 1..={MAX_LEN}"));
    }
    let mut buf = vec![0u8; length];
    getrandom::getrandom(&mut buf).map_err(|e| e.to_string())?;
    Ok(::hex::encode(buf))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_secure_random_hex_length_and_hex() {
        let a = generate_secure_random_hex(16).unwrap();
        let b = generate_secure_random_hex(16).unwrap();
        assert_eq!(a.len(), 32);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    #[test]
    fn rejects_zero_and_huge() {
        assert!(generate_secure_random_hex(0).is_err());
        assert!(generate_secure_random_hex(MAX_LEN + 1).is_err());
    }
}
