use nostr::secp256k1::{self, SecretKey, PublicKey};
use aes::Aes256;
use aes::cipher::{KeyIvInit, BlockEncryptMut, BlockDecryptMut};
use cbc::{Encryptor, Decryptor};
use block_padding::Pkcs7;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use rand::{thread_rng, RngCore};
use hex;

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

/// Derives a shared secret for NIP-04 using ECDH.
fn compute_shared_secret(secret_key: &SecretKey, public_key: &PublicKey) -> [u8; 32] {
    secp256k1::ecdh::SharedSecret::new(public_key, secret_key).secret_bytes()
}

/// NIP-04 Encryption.
/// Returns "payload?iv=..." base64 encoded string.
pub fn encrypt_nip04(secret_key_hex: &str, public_key_hex: &str, content: &str) -> Result<String, String> {
    let sk_bytes = hex::decode(secret_key_hex).map_err(|e| e.to_string())?;
    let sk = SecretKey::from_slice(&sk_bytes).map_err(|e| e.to_string())?;
    
    let pk_bytes = hex::decode(public_key_hex).map_err(|e| e.to_string())?;
    let pk = if pk_bytes.len() == 32 {
        let mut full_pk = vec![2u8];
        full_pk.extend_from_slice(&pk_bytes);
        PublicKey::from_slice(&full_pk).map_err(|e| e.to_string())?
    } else {
        PublicKey::from_slice(&pk_bytes).map_err(|e| e.to_string())?
    };

    let shared_secret = compute_shared_secret(&sk, &pk);
    
    let mut iv = [0u8; 16];
    thread_rng().fill_bytes(&mut iv);
    
    let plaintext = content.as_bytes();
    let cipher = Aes256CbcEnc::new(&shared_secret.into(), &iv.into());
    
    // Manual buffer management for padding
    let mut buffer = vec![0u8; plaintext.len() + 16]; 
    buffer[..plaintext.len()].copy_from_slice(plaintext);
    
    let ciphertext_slice = cipher.encrypt_padded_mut::<Pkcs7>(&mut buffer, plaintext.len())
        .map_err(|e| e.to_string())?;
    
    let encrypted_base64 = STANDARD.encode(ciphertext_slice);
    let iv_base64 = STANDARD.encode(&iv);
    
    Ok(format!("{}?iv={}", encrypted_base64, iv_base64))
}

/// NIP-04 Decryption.
pub fn decrypt_nip04(secret_key_hex: &str, public_key_hex: &str, encrypted_content: &str) -> Result<String, String> {
    let sk_bytes = hex::decode(secret_key_hex).map_err(|e| e.to_string())?;
    let sk = SecretKey::from_slice(&sk_bytes).map_err(|e| e.to_string())?;
    
    let pk_bytes = hex::decode(public_key_hex).map_err(|e| e.to_string())?;
    let pk = if pk_bytes.len() == 32 {
        let mut full_pk = vec![2u8];
        full_pk.extend_from_slice(&pk_bytes);
        PublicKey::from_slice(&full_pk).map_err(|e| e.to_string())?
    } else {
        PublicKey::from_slice(&pk_bytes).map_err(|e| e.to_string())?
    };

    let shared_secret = compute_shared_secret(&sk, &pk);
    
    let parts: Vec<&str> = encrypted_content.split("?iv=").collect();
    if parts.len() != 2 {
        return Err("Invalid NIP-04 format".to_string());
    }
    
    let mut ciphertext = STANDARD.decode(parts[0]).map_err(|e| e.to_string())?;
    let iv = STANDARD.decode(parts[1]).map_err(|e| e.to_string())?;
    
    if iv.len() != 16 {
        return Err("Invalid IV length".to_string());
    }
    
    let cipher = Aes256CbcDec::new(&shared_secret.into(), (&iv[..16]).into());
    let decrypted_slice = cipher.decrypt_padded_mut::<Pkcs7>(&mut ciphertext)
        .map_err(|e| e.to_string())?;
    
    String::from_utf8(decrypted_slice.to_vec()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::nip01::generate_key_pair;

    #[test]
    fn test_nip04_roundtrip() {
        let (sk1, pk1) = generate_key_pair();
        let (sk2, pk2) = generate_key_pair();
        
        let message = "Hello, Nostr!";
        
        let encrypted = encrypt_nip04(&sk1, &pk2, message).unwrap();
        let decrypted = decrypt_nip04(&sk2, &pk1, &encrypted).unwrap();
        
        assert_eq!(message, decrypted);
    }
}
