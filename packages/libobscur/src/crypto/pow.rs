use nostr::prelude::*;
use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Calculates the number of leading zero bits in a hash (EventId).
pub fn get_leading_zeros(id: EventId) -> u8 {
    let bytes = id.to_bytes();
    let mut count = 0;
    for &byte in bytes.iter() {
        if byte == 0 {
            count += 8;
        } else {
            count += byte.leading_zeros() as u8;
            break;
        }
    }
    count
}

/// Mines a Proof of Work (NIP-13) nonce for a Nostr event.
/// This will modify the event's tags to include a "nonce" tag with the difficulty.
pub fn mine_pow(unsigned_event: UnsignedEvent, difficulty: u8) -> Result<UnsignedEvent, String> {
    if difficulty == 0 {
        return Ok(unsigned_event);
    }

    let mut event = unsigned_event;
    let target_difficulty = difficulty;
    
    let mut tags: Vec<Tag> = event.tags.to_vec();
    
    // Ensure "nonce" tag exists
    let mut nonce_idx = None;
    for (i, tag) in tags.iter().enumerate() {
        if tag.kind() == TagKind::from("nonce") {
            nonce_idx = Some(i);
            break;
        }
    }

    if let Some(idx) = nonce_idx {
        // Update existing nonce tag to include the target difficulty if not present
        let mut tag_vec = tags[idx].clone().to_vec();
        if tag_vec.len() < 2 {
            tag_vec.push("0".to_string());
            tag_vec.push(target_difficulty.to_string());
        } else if tag_vec.len() == 2 {
            tag_vec.push(target_difficulty.to_string());
        } else {
            tag_vec[2] = target_difficulty.to_string();
        }
        tags[idx] = Tag::parse(tag_vec).map_err(|e| e.to_string())?;
    } else {
        // Add nonce tag: ["nonce", "0", "difficulty"]
        tags.push(Tag::parse(vec!["nonce", "0", &target_difficulty.to_string()]).map_err(|e| e.to_string())?);
        nonce_idx = Some(tags.len() - 1);
    }

    let nonce_idx = nonce_idx.unwrap();
    let found = Arc::new(AtomicBool::new(false));
    let result_nonce = Arc::new(std::sync::Mutex::new(0u64));
    
    // We'll use a chunked approach for parallel mining
    let num_cpus = ::num_cpus::get();
    let chunk_size = 100_000;

    (0..num_cpus).into_par_iter().for_each(|i| {
        let mut local_tags = tags.clone();
        let mut nonce = i as u64 * chunk_size;
        
        while !found.load(Ordering::Relaxed) {
            // Update nonce in tags
            let mut tag_vec = local_tags[nonce_idx].clone().to_vec();
            tag_vec[1] = nonce.to_string();
            local_tags[nonce_idx] = Tag::parse(tag_vec).unwrap();
            
            let id = EventId::new(&event.pubkey, &event.created_at, &event.kind, &local_tags, &event.content);
            
            if get_leading_zeros(id) >= target_difficulty {
                found.store(true, Ordering::Relaxed);
                let mut res = result_nonce.lock().unwrap();
                *res = nonce;
                break;
            }
            
            nonce += num_cpus as u64;
            
            if nonce % (chunk_size * num_cpus as u64) == 0 && found.load(Ordering::Relaxed) {
                break;
            }
        }
    });

    let final_nonce = *result_nonce.lock().unwrap();
    let mut final_tag_vec = tags[nonce_idx].clone().to_vec();
    final_tag_vec[1] = final_nonce.to_string();
    tags[nonce_idx] = Tag::parse(final_tag_vec).map_err(|e| e.to_string())?;
    
    event.tags = Tags::new(tags);
    // Re-calculate the final ID
    event.id = Some(EventId::new(&event.pubkey, &event.created_at, &event.kind, &event.tags.clone().to_vec(), &event.content));
    
    Ok(event)
}

#[cfg(test)]
mod tests {
    use super::*;
    use nostr::prelude::*;

    #[test]
    fn test_pow_mining() {
        let keys = Keys::generate();
        let builder = EventBuilder::text_note("Hello, PoW!");
        // build() replaces to_unsigned_event in newer nostr versions
        let unsigned = builder.build(keys.public_key());
        
        let difficulty = 8; // Low difficulty for fast test
        let mined = mine_pow(unsigned, difficulty).unwrap();
        
        assert!(get_leading_zeros(mined.id.expect("Mined event should have an ID")) >= difficulty);
        
        // Check if nonce tag is present and correct
        let mut has_nonce = false;
        for tag in mined.tags.iter() {
            let vec = tag.clone().to_vec();
            if !vec.is_empty() && vec[0] == "nonce" {
                has_nonce = true;
                assert!(vec.len() >= 3);
                assert_eq!(vec[2], difficulty.to_string());
            }
        }
        assert!(has_nonce);
    }
}
