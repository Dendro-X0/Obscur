use serde::{Serialize, Deserialize};
use crate::crypto::nip44;
use nostr::prelude::*;
use std::str::FromStr;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Rumor {
    pub id: String,
    pub pubkey: String,
    pub created_at: u64,
    pub kind: u32,
    pub tags: Vec<Vec<String>>,
    pub content: String,
}

/// NIP-17 Gift Wrap Layering.
/// Wraps a rumor into a Gift Wrap (Kind 1059) via a Seal (Kind 13).
pub fn wrap_rumor(
    sender_sk: &str,
    recipient_pk: &str,
    rumor: &Rumor,
    _expiration: Option<u64>,
) -> Result<String, String> {
    let sk = nostr::SecretKey::from_str(sender_sk).map_err(|e| e.to_string())?;
    let keys = nostr::Keys::new(sk);
    let recipient_pk_obj = nostr::PublicKey::from_str(recipient_pk).map_err(|e| e.to_string())?;
    
    // 1. Serialize Rumor
    let rumor_json = serde_json::to_string(rumor).map_err(|e| e.to_string())?;
    
    // 2. Create Seal (Kind 13)
    let sealed_content = nip44::encrypt_nip44(sender_sk, recipient_pk, &rumor_json)?;
    
    let seal_event = EventBuilder::new(Kind::from(13), sealed_content)
        .tag(Tag::public_key(recipient_pk_obj))
        .custom_created_at(Timestamp::from(rumor.created_at))
        .sign_with_keys(&keys).map_err(|e| e.to_string())?;
        
    let seal_json = seal_event.as_json();
    
    // 3. Create Gift Wrap (Kind 1059)
    let ephemeral_keys = nostr::Keys::generate();
    let eph_sk_hex = ::hex::encode(ephemeral_keys.secret_key().secret_bytes());
    
    let wrapped_content = nip44::encrypt_nip44(
        &eph_sk_hex, 
        recipient_pk, 
        &seal_json
    )?;
    
    let gift_wrap = EventBuilder::new(Kind::from(1059), wrapped_content)
        .tag(Tag::public_key(recipient_pk_obj))
        .custom_created_at(Timestamp::from(rumor.created_at))
        .sign_with_keys(&ephemeral_keys).map_err(|e| e.to_string())?;
    
    Ok(gift_wrap.as_json())
}

pub fn unwrap_gift_wrap(
    recipient_sk: &str,
    gift_wrap_content: &str,
    gift_wrap_sender_pk: &str,
) -> Result<Rumor, String> {
    // 1. Decrypt Seal (Kind 13) from Gift Wrap content
    let seal_json = nip44::decrypt_nip44(recipient_sk, gift_wrap_sender_pk, gift_wrap_content)?;
    
    // 2. Parse Seal
    let seal: serde_json::Value = serde_json::from_str(&seal_json).map_err(|e| e.to_string())?;
    let real_sender_pk = seal["pubkey"].as_str().ok_or("Missing pubkey in seal")?;
    let encrypted_rumor = seal["content"].as_str().ok_or("Missing content in seal")?;
    
    // 3. Decrypt Rumor from Seal content
    let rumor_json = nip44::decrypt_nip44(recipient_sk, real_sender_pk, encrypted_rumor)?;
    
    // 4. Parse Rumor
    let rumor: Rumor = serde_json::from_str(&rumor_json).map_err(|e| e.to_string())?;
    Ok(rumor)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::nip01;

    #[test]
    fn test_nip17_flow() {
        let (sk_a_hex, pk_a_hex) = nip01::generate_key_pair();
        let (sk_b_hex, pk_b_hex) = nip01::generate_key_pair();
        
        let rumor = Rumor {
            id: "rumor_1".to_string(),
            pubkey: pk_a_hex.clone(),
            created_at: 1000,
            kind: 14,
            tags: vec![],
            content: "Hello B, this is A".to_string(),
        };
        
        let signed_gift_wrap_json = wrap_rumor(&sk_a_hex, &pk_b_hex, &rumor, None).expect("Wrap failed");
        
        // Parse the signed gift wrap to get its content (Kind 1059)
        let gift_wrap: serde_json::Value = serde_json::from_str(&signed_gift_wrap_json).unwrap();
        let gw_content = gift_wrap["content"].as_str().unwrap();
        let gw_sender = gift_wrap["pubkey"].as_str().unwrap();
        
        let unwrapped_rumor = unwrap_gift_wrap(&sk_b_hex, gw_content, gw_sender).expect("Unwrap failed");
        
        assert_eq!(unwrapped_rumor.content, "Hello B, this is A");
        assert_eq!(unwrapped_rumor.pubkey, pk_a_hex);
    }
}
