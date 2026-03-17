use crate::protocol::types::{X3DHPreKeyBundle, X3DHSessionBootstrap, unix_ms_now};
use rand::RngCore;
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

fn decode_hex_32(input: &str) -> Result<[u8; 32], String> {
    let bytes = hex::decode(input).map_err(|e| e.to_string())?;
    if bytes.len() != 32 {
        return Err("Expected a 32-byte hex key".to_string());
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

fn derive_scalar_from_hex(seed_hex: &str) -> Result<StaticSecret, String> {
    let seed = decode_hex_32(seed_hex)?;
    Ok(StaticSecret::from(seed))
}

fn derive_public_hex(secret: &StaticSecret) -> String {
    let public = PublicKey::from(secret);
    hex::encode(public.as_bytes())
}

fn hash_bytes(parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part);
    }
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest[..32]);
    out
}

pub fn run_x3dh_bootstrap(
    local_identity_secret_hex: &str,
    local_signed_prekey_secret_hex: &str,
    remote_bundle: &X3DHPreKeyBundle,
) -> Result<X3DHSessionBootstrap, String> {
    let local_identity = derive_scalar_from_hex(local_identity_secret_hex)?;
    let local_signed_prekey = derive_scalar_from_hex(local_signed_prekey_secret_hex)?;

    let mut ephemeral_seed = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut ephemeral_seed);
    let ephemeral_secret = StaticSecret::from(ephemeral_seed);

    let remote_identity = PublicKey::from(decode_hex_32(&remote_bundle.identity_key_hex)?);
    let remote_signed_prekey = PublicKey::from(decode_hex_32(&remote_bundle.signed_prekey_hex)?);
    let remote_one_time_prekey = remote_bundle
        .one_time_prekey_hex
        .as_deref()
        .map(decode_hex_32)
        .transpose()?
        .map(PublicKey::from);

    let dh1 = local_identity.diffie_hellman(&remote_signed_prekey);
    let dh2 = ephemeral_secret.diffie_hellman(&remote_identity);
    let dh3 = ephemeral_secret.diffie_hellman(&remote_signed_prekey);
    let dh4 = remote_one_time_prekey
        .as_ref()
        .map(|pk| local_signed_prekey.diffie_hellman(pk));

    let mut material_parts: Vec<&[u8]> = vec![dh1.as_bytes(), dh2.as_bytes(), dh3.as_bytes()];
    if let Some(extra) = dh4.as_ref() {
        material_parts.push(extra.as_bytes());
    }
    let root_key = hash_bytes(&material_parts);
    let sending_chain = hash_bytes(&[&root_key, b"send"]);
    let receiving_chain = hash_bytes(&[&root_key, b"recv"]);
    let local_pub_hex = derive_public_hex(&local_identity);
    let session_hash = hash_bytes(&[
        &root_key,
        local_pub_hex.as_bytes(),
        remote_bundle.identity_key_hex.as_bytes(),
    ]);

    Ok(X3DHSessionBootstrap {
        session_id: format!("x3dr-{}", &hex::encode(session_hash)[..24]),
        root_key_hex: hex::encode(root_key),
        sending_chain_key_hex: hex::encode(sending_chain),
        receiving_chain_key_hex: hex::encode(receiving_chain),
        established_at_unix_ms: unix_ms_now(),
        used_one_time_prekey: remote_one_time_prekey.is_some(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_generates_session_material() {
        let local_identity = "0101010101010101010101010101010101010101010101010101010101010101";
        let local_signed = "0202020202020202020202020202020202020202020202020202020202020202";
        let remote = X3DHPreKeyBundle {
            identity_key_hex: "0303030303030303030303030303030303030303030303030303030303030303".to_string(),
            signed_prekey_hex: "0404040404040404040404040404040404040404040404040404040404040404".to_string(),
            one_time_prekey_hex: None,
            signature_hex: None,
        };
        let out = run_x3dh_bootstrap(local_identity, local_signed, &remote).expect("bootstrap");
        assert!(out.session_id.starts_with("x3dr-"));
        assert_eq!(out.root_key_hex.len(), 64);
        assert_eq!(out.sending_chain_key_hex.len(), 64);
        assert_eq!(out.receiving_chain_key_hex.len(), 64);
    }

    #[test]
    fn bootstrap_rejects_bad_key_length() {
        let remote = X3DHPreKeyBundle {
            identity_key_hex: "abcd".to_string(),
            signed_prekey_hex: "0404040404040404040404040404040404040404040404040404040404040404".to_string(),
            one_time_prekey_hex: None,
            signature_hex: None,
        };
        let result = run_x3dh_bootstrap(
            "0101010101010101010101010101010101010101010101010101010101010101",
            "0202020202020202020202020202020202020202020202020202020202020202",
            &remote,
        );
        assert!(result.is_err());
    }
}
