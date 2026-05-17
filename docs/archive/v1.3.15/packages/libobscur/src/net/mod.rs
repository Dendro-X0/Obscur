pub mod relay;
pub mod pool;

use crate::ffi::ObscurError;
use crate::crypto::{nip01, nip04, nip17};
use futures_util::{SinkExt, StreamExt};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::time::Duration;
use tokio::time::{timeout, Instant};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{info, warn};

const DEFAULT_BACKGROUND_SYNC_TIMEOUT_MS: u64 = 8_000;
const MAX_EVENTS_PER_RELAY: u32 = 80;
const CHECKPOINT_DB_PATH_ENV: &str = "OBSCUR_SYNC_CHECKPOINT_DB";
const CHECKPOINT_DB_DEFAULT: &str = "obscur_sync_checkpoint.sqlite3";

#[derive(Debug, Clone)]
pub struct RelaySyncOutcome {
    pub relay_url: String,
    pub ok: bool,
    pub events_scanned: u32,
    pub decrypted_messages: u32,
    pub last_seen_unix: Option<u64>,
    pub reason: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone)]
pub struct BackgroundSyncOutcome {
    pub ok: bool,
    pub scanned_relays: u32,
    pub total_events: u32,
    pub decrypted_messages: u32,
    pub checkpoint_unix: Option<u64>,
    pub reason: Option<String>,
    pub outcomes: Vec<RelaySyncOutcome>,
}

/// Performs a background sync of messages.
pub async fn background_sync(secret_key_hex: String) -> Result<u32, ObscurError> {
    let defaults = vec![
        "wss://relay.damus.io".to_string(),
        "wss://nos.lol".to_string(),
        "wss://relay.snort.social".to_string(),
        "wss://relay.primal.net".to_string(),
    ];
    let report = background_sync_scoped(secret_key_hex, defaults, None).await?;
    Ok(report.decrypted_messages)
}

pub async fn background_sync_scoped(
    secret_key_hex: String,
    relay_urls: Vec<String>,
    timeout_ms: Option<u64>,
) -> Result<BackgroundSyncOutcome, ObscurError> {
    let public_key_hex = nip01::get_public_key(&secret_key_hex).map_err(ObscurError::from)?;
    let normalized_relays = normalize_relay_urls(&relay_urls);
    if normalized_relays.is_empty() {
        return Err(ObscurError::from(
            "relay_offline_or_unconfigured: no valid relay URLs supplied".to_string(),
        ));
    }

    let timeout_ms = timeout_ms.unwrap_or(DEFAULT_BACKGROUND_SYNC_TIMEOUT_MS).max(1_000);
    let checkpoint_before = load_checkpoint_unix(&public_key_hex)?;
    let mut checkpoint_after = checkpoint_before;

    info!(
        "Starting background sync for pubkey={} relays={} checkpoint={:?}",
        &public_key_hex.chars().take(12).collect::<String>(),
        normalized_relays.len(),
        checkpoint_before
    );

    let mut outcomes = Vec::with_capacity(normalized_relays.len());
    let mut total_events = 0u32;
    let mut decrypted_messages = 0u32;
    let mut scanned_relays = 0u32;
    let mut had_success = false;

    for relay_url in normalized_relays {
        let started = Instant::now();
        let single = sync_single_relay(
            &secret_key_hex,
            &public_key_hex,
            &relay_url,
            checkpoint_before,
            timeout_ms,
        )
        .await;
        match single {
            Ok(success) => {
                had_success = true;
                scanned_relays += 1;
                total_events = total_events.saturating_add(success.events_scanned);
                decrypted_messages = decrypted_messages.saturating_add(success.decrypted_messages);
                if let Some(last_seen) = success.last_seen_unix {
                    checkpoint_after = Some(checkpoint_after.unwrap_or(last_seen).max(last_seen));
                }
                outcomes.push(RelaySyncOutcome {
                    relay_url,
                    ok: true,
                    events_scanned: success.events_scanned,
                    decrypted_messages: success.decrypted_messages,
                    last_seen_unix: success.last_seen_unix,
                    reason: None,
                    duration_ms: started.elapsed().as_millis() as u64,
                });
            }
            Err(error) => {
                warn!("Background sync relay {} failed: {}", relay_url, error);
                outcomes.push(RelaySyncOutcome {
                    relay_url,
                    ok: false,
                    events_scanned: 0,
                    decrypted_messages: 0,
                    last_seen_unix: None,
                    reason: Some(error),
                    duration_ms: started.elapsed().as_millis() as u64,
                });
            }
        }
    }

    if let Some(checkpoint) = checkpoint_after {
        let _ = save_checkpoint_unix(&public_key_hex, checkpoint);
    }

    if !had_success {
        return Ok(BackgroundSyncOutcome {
            ok: false,
            scanned_relays: 0,
            total_events: 0,
            decrypted_messages: 0,
            checkpoint_unix: checkpoint_after,
            reason: Some("relay_offline_or_timeout".to_string()),
            outcomes,
        });
    }

    Ok(BackgroundSyncOutcome {
        ok: true,
        scanned_relays,
        total_events,
        decrypted_messages,
        checkpoint_unix: checkpoint_after,
        reason: None,
        outcomes,
    })
}

pub use relay::{RelayClient, RelayConfig, ConnectionState};
pub use pool::RelayPool;

#[derive(Debug, Clone)]
struct SingleRelaySyncResult {
    events_scanned: u32,
    decrypted_messages: u32,
    last_seen_unix: Option<u64>,
}

fn normalize_relay_urls(relay_urls: &[String]) -> Vec<String> {
    let mut seen = HashSet::<String>::new();
    relay_urls
        .iter()
        .map(|relay| relay.trim().to_string())
        .filter(|relay| !relay.is_empty())
        .filter_map(|relay| {
            let parsed = url::Url::parse(&relay).ok()?;
            if parsed.scheme() != "wss" && parsed.scheme() != "ws" {
                return None;
            }
            if seen.insert(relay.clone()) {
                Some(relay)
            } else {
                None
            }
        })
        .collect()
}

async fn sync_single_relay(
    secret_key_hex: &str,
    public_key_hex: &str,
    relay_url: &str,
    checkpoint_unix: Option<u64>,
    timeout_ms: u64,
) -> Result<SingleRelaySyncResult, String> {
    let timeout_window = Duration::from_millis(timeout_ms);
    let (mut socket, _) = timeout(timeout_window, connect_async(relay_url))
        .await
        .map_err(|_| "timeout/no_connect".to_string())?
        .map_err(|error| format!("relay_disconnect/{}", error))?;

    let subscription_id = format!("bgsync-{}", checkpoint_unix.unwrap_or_default());
    let mut filter = json!({
        "kinds": [4, 1059],
        "#p": [public_key_hex],
        "limit": MAX_EVENTS_PER_RELAY
    });
    if let Some(since) = checkpoint_unix {
        filter["since"] = Value::from(since as i64);
    }
    let req_frame = json!(["REQ", subscription_id, filter]).to_string();
    socket
        .send(Message::Text(req_frame.into()))
        .await
        .map_err(|error| format!("relay_disconnect/{}", error))?;

    let mut events_scanned = 0u32;
    let mut decrypted_messages = 0u32;
    let mut last_seen_unix = checkpoint_unix;
    let started = Instant::now();

    loop {
        if started.elapsed() > timeout_window {
            let _ = socket
                .send(Message::Text(
                    json!(["CLOSE", subscription_id]).to_string().into(),
                ))
                .await;
            return Err("timeout/no_eose".to_string());
        }
        let maybe_message = timeout(Duration::from_millis(400), socket.next()).await;
        let next_message = match maybe_message {
            Ok(value) => value,
            Err(_) => continue,
        };
        let Some(message) = next_message else {
            return Err("relay_disconnect/stream_closed".to_string());
        };
        let message = message.map_err(|error| format!("relay_disconnect/{}", error))?;
        let Message::Text(payload) = message else {
            continue;
        };
        let payload = payload.to_string();
        let parsed: Value = match serde_json::from_str(&payload) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let Some(frame) = parsed.as_array() else {
            continue;
        };
        let Some(kind) = frame.first().and_then(Value::as_str) else {
            continue;
        };
        match kind {
            "EOSE" => break,
            "EVENT" => {
                let event_payload = frame.get(2).or_else(|| frame.get(1));
                let Some(event) = event_payload.and_then(Value::as_object) else {
                    continue;
                };
                events_scanned = events_scanned.saturating_add(1);
                if let Some(created_at) = event.get("created_at").and_then(Value::as_u64) {
                    last_seen_unix = Some(last_seen_unix.unwrap_or(created_at).max(created_at));
                }
                if is_event_decryptable(secret_key_hex, event) {
                    decrypted_messages = decrypted_messages.saturating_add(1);
                }
            }
            _ => {}
        }
    }

    let _ = socket
        .send(Message::Text(
            json!(["CLOSE", subscription_id]).to_string().into(),
        ))
        .await;

    Ok(SingleRelaySyncResult {
        events_scanned,
        decrypted_messages,
        last_seen_unix,
    })
}

fn is_event_decryptable(
    secret_key_hex: &str,
    event: &serde_json::Map<String, Value>,
) -> bool {
    let Some(kind) = event.get("kind").and_then(Value::as_i64) else {
        return false;
    };
    let Some(content) = event.get("content").and_then(Value::as_str) else {
        return false;
    };
    let Some(sender_pubkey) = event.get("pubkey").and_then(Value::as_str) else {
        return false;
    };

    if kind == 4 {
        return nip04::decrypt_nip04(secret_key_hex, sender_pubkey, content).is_ok();
    }
    if kind == 1059 {
        return nip17::unwrap_gift_wrap(secret_key_hex, content, sender_pubkey).is_ok();
    }
    false
}

fn checkpoint_db_path() -> String {
    std::env::var(CHECKPOINT_DB_PATH_ENV).unwrap_or_else(|_| CHECKPOINT_DB_DEFAULT.to_string())
}

fn checkpoint_conn() -> Result<Connection, String> {
    let conn = Connection::open(checkpoint_db_path()).map_err(|e| e.to_string())?;
    conn.execute_batch(
        r#"
CREATE TABLE IF NOT EXISTS background_sync_checkpoints (
  public_key_hex TEXT PRIMARY KEY,
  last_seen_unix INTEGER NOT NULL,
  updated_at_unix_ms INTEGER NOT NULL
);
"#,
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn load_checkpoint_unix(public_key_hex: &str) -> Result<Option<u64>, ObscurError> {
    let conn = checkpoint_conn().map_err(ObscurError::from)?;
    let mut stmt = conn
        .prepare("SELECT last_seen_unix FROM background_sync_checkpoints WHERE public_key_hex = ?1")
        .map_err(|e| ObscurError::from(e.to_string()))?;
    let mut rows = stmt
        .query(params![public_key_hex])
        .map_err(|e| ObscurError::from(e.to_string()))?;
    let Some(row) = rows.next().map_err(|e| ObscurError::from(e.to_string()))? else {
        return Ok(None);
    };
    let value: i64 = row.get(0).map_err(|e| ObscurError::from(e.to_string()))?;
    Ok(Some(value as u64))
}

fn save_checkpoint_unix(public_key_hex: &str, checkpoint_unix: u64) -> Result<(), ObscurError> {
    let conn = checkpoint_conn().map_err(ObscurError::from)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    conn.execute(
        r#"
INSERT INTO background_sync_checkpoints (public_key_hex, last_seen_unix, updated_at_unix_ms)
VALUES (?1, ?2, ?3)
ON CONFLICT(public_key_hex) DO UPDATE SET
  last_seen_unix = excluded.last_seen_unix,
  updated_at_unix_ms = excluded.updated_at_unix_ms
"#,
        params![public_key_hex, checkpoint_unix as i64, now],
    )
    .map_err(|e| ObscurError::from(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_relay_urls_filters_invalid_and_duplicates() {
        let input = vec![
            " wss://relay.one ".to_string(),
            "wss://relay.one".to_string(),
            "ws://localhost:7001".to_string(),
            "https://relay.invalid".to_string(),
            "".to_string(),
        ];
        let normalized = normalize_relay_urls(&input);
        assert_eq!(
            normalized,
            vec![
                "wss://relay.one".to_string(),
                "ws://localhost:7001".to_string()
            ]
        );
    }
}
