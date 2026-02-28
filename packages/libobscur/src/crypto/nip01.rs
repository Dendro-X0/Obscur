use nostr::prelude::*;
use std::str::FromStr;

/// Generates a new random key pair.
/// Returns (secret_key_hex, public_key_hex).
pub fn generate_key_pair() -> (String, String) {
    let keys = Keys::generate();
    (
        ::hex::encode(keys.secret_key().secret_bytes()),
        keys.public_key().to_string()
    )
}

/// Derives a public key from a secret key hex string.
pub fn get_public_key(secret_key_hex: &str) -> Result<String, String> {
    let sk = SecretKey::from_str(secret_key_hex).map_err(|e| e.to_string())?;
    let keys = Keys::new(sk);
    Ok(keys.public_key().to_string())
}

/// Signs a message hash or content.
pub fn sign_event(secret_key_hex: &str, message_hash_hex: &str) -> Result<String, String> {
    let sk = nostr::secp256k1::SecretKey::from_str(secret_key_hex).map_err(|e| e.to_string())?;
    let message_hash_bytes = ::hex::decode(message_hash_hex).map_err(|e| e.to_string())?;
    let message = nostr::secp256k1::Message::from_digest_slice(&message_hash_bytes).map_err(|e| e.to_string())?;
    
    let secp = nostr::secp256k1::Secp256k1::new();
    let keypair = nostr::secp256k1::Keypair::from_secret_key(&secp, &sk);
    let sig = secp.sign_schnorr_no_aux_rand(&message, &keypair);
    
    Ok(::hex::encode(sig.serialize()))
}

/// Verifies a Schnorr signature.
pub fn verify_signature(public_key_hex: &str, message_hash_hex: &str, signature_hex: &str) -> bool {
    let pk = match nostr::secp256k1::XOnlyPublicKey::from_str(public_key_hex) {
        Ok(k) => k,
        Err(_) => return false,
    };
    
    let message_hash_bytes = match ::hex::decode(message_hash_hex) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let message = match nostr::secp256k1::Message::from_digest_slice(&message_hash_bytes) {
        Ok(m) => m,
        Err(_) => return false,
    };
    
    let signature_bytes = match ::hex::decode(signature_hex) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let signature = match nostr::secp256k1::schnorr::Signature::from_slice(&signature_bytes) {
        Ok(s) => s,
        Err(_) => return false,
    };
    
    let secp = nostr::secp256k1::Secp256k1::new();
    secp.verify_schnorr(&signature, &message, &pk).is_ok()
}
