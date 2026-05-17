use crate::relay::RelayPool;
use libobscur::protocol::types::{
    DeviceAuthorizationRecord, DeviceRevocationResult, EnvelopeVerifyContext, IdentityRootState,
    MessageVerifyResult, ProtocolCommandResult, QuorumPublishReport, RatchetSessionState,
    RelayPublishAttempt, SecurityReasonCode, SessionKeyState, StorageHealthState,
    StorageRecoveryReport, X3DHHandshakeResult,
};
use libobscur::protocol::ProtocolRuntime;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{State, WebviewWindow};

pub struct ProtocolState {
    runtime: Mutex<Option<ProtocolRuntime>>,
    init_error: Mutex<Option<String>>,
}

impl ProtocolState {
    pub fn new(db_path: PathBuf) -> Self {
        match ProtocolRuntime::new(db_path.to_string_lossy().to_string()) {
            Ok(runtime) => Self {
                runtime: Mutex::new(Some(runtime)),
                init_error: Mutex::new(None),
            },
            Err(err) => Self {
                runtime: Mutex::new(None),
                init_error: Mutex::new(Some(err)),
            },
        }
    }

    fn unavailable<T>(&self) -> ProtocolCommandResult<T> {
        let message = self
            .init_error
            .lock()
            .ok()
            .and_then(|guard| guard.clone())
            .unwrap_or_else(|| "Protocol runtime not initialized.".to_string());
        ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, message, true)
    }

    fn with_runtime<T>(
        &self,
        action: impl FnOnce(&ProtocolRuntime) -> ProtocolCommandResult<T>,
    ) -> ProtocolCommandResult<T> {
        match self.runtime.lock() {
            Ok(guard) => match guard.as_ref() {
                Some(runtime) => action(runtime),
                None => self.unavailable(),
            },
            Err(_) => ProtocolCommandResult::failed(
                SecurityReasonCode::Failed,
                "Protocol runtime lock poisoned.",
                true,
            ),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SessionStateArgs {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AuthorizeDeviceArgs {
    pub device_public_key_hex: String,
}

#[derive(Debug, Deserialize)]
pub struct RevokeDeviceArgs {
    pub device_id: String,
}

#[derive(Debug, Deserialize)]
pub struct X3dhHandshakeArgs {
    pub peer_public_key_hex: String,
    pub x3dh_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEnvelopeArgs {
    pub session_id: String,
    pub message_id: String,
    pub envelope: String,
    pub counter: Option<u32>,
    pub envelope_version: Option<String>,
    pub x3dh_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PublishWithQuorumArgs {
    pub payload: String,
    pub relay_urls: Vec<String>,
}

const DEFAULT_PUBLISH_ACK_TIMEOUT_MS: u64 = 12_000;

fn parse_event_payload(payload: &str) -> Result<Value, String> {
    let parsed: Value = serde_json::from_str(payload)
        .map_err(|_| "Malformed event payload: expected JSON payload".to_string())?;
    let Some(items) = parsed.as_array() else {
        return Err("Malformed event payload: expected EVENT frame array".to_string());
    };
    if items.len() < 2 || items.first().and_then(Value::as_str) != Some("EVENT") {
        return Err("Malformed event payload: expected [\"EVENT\", <event>]".to_string());
    }
    let Some(event) = items.get(1) else {
        return Err("Malformed event payload: missing EVENT body".to_string());
    };
    if !event.is_object() {
        return Err("Malformed event payload: EVENT body must be an object".to_string());
    }
    Ok(event.clone())
}

fn normalize_relay_urls(relay_urls: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    relay_urls
        .iter()
        .map(|raw| raw.trim())
        .filter(|url| !url.is_empty())
        .filter_map(|url| {
            let candidate = url.to_string();
            if seen.insert(candidate.clone()) {
                Some(candidate)
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
pub async fn protocol_get_identity_root_state(
    state: State<'_, ProtocolState>,
) -> Result<ProtocolCommandResult<IdentityRootState>, String> {
    Ok(state.with_runtime(|runtime| runtime.get_identity_root_state()))
}

#[tauri::command]
pub async fn protocol_get_session_state(
    state: State<'_, ProtocolState>,
    args: SessionStateArgs,
) -> Result<ProtocolCommandResult<SessionKeyState>, String> {
    Ok(state.with_runtime(|runtime| runtime.get_session_state(&args.session_id)))
}

#[tauri::command]
pub async fn protocol_authorize_device(
    state: State<'_, ProtocolState>,
    args: AuthorizeDeviceArgs,
) -> Result<ProtocolCommandResult<DeviceAuthorizationRecord>, String> {
    Ok(state.with_runtime(|runtime| runtime.authorize_device(&args.device_public_key_hex)))
}

#[tauri::command]
pub async fn protocol_revoke_device(
    state: State<'_, ProtocolState>,
    args: RevokeDeviceArgs,
) -> Result<ProtocolCommandResult<DeviceRevocationResult>, String> {
    Ok(state.with_runtime(|runtime| runtime.revoke_device(&args.device_id)))
}

#[tauri::command]
pub async fn protocol_x3dh_handshake(
    state: State<'_, ProtocolState>,
    args: X3dhHandshakeArgs,
) -> Result<ProtocolCommandResult<X3DHHandshakeResult>, String> {
    if !args.x3dh_enabled.unwrap_or(false) {
        return Ok(ProtocolCommandResult::unsupported(
            "X3DH path disabled by rollout flag.",
        ));
    }
    Ok(state.with_runtime(|runtime| runtime.x3dh_handshake(&args.peer_public_key_hex)))
}

#[tauri::command]
pub async fn protocol_get_ratchet_session(
    state: State<'_, ProtocolState>,
    args: SessionStateArgs,
) -> Result<ProtocolCommandResult<RatchetSessionState>, String> {
    Ok(state.with_runtime(|runtime| runtime.get_ratchet_session(&args.session_id)))
}

#[tauri::command]
pub async fn protocol_verify_message_envelope(
    state: State<'_, ProtocolState>,
    args: VerifyEnvelopeArgs,
) -> Result<ProtocolCommandResult<MessageVerifyResult>, String> {
    let context = EnvelopeVerifyContext {
        session_id: args.session_id,
        message_id: args.message_id,
        counter: args.counter.unwrap_or(1),
        envelope_version: args
            .envelope_version
            .unwrap_or_else(|| "v090_x3dr".to_string()),
        ciphertext: args.envelope,
    };
    let enabled = args.x3dh_enabled.unwrap_or(false);
    Ok(state.with_runtime(|runtime| runtime.verify_message_envelope(context, enabled)))
}

#[tauri::command]
pub async fn protocol_publish_with_quorum(
    window: WebviewWindow,
    state: State<'_, ProtocolState>,
    relay_pool: State<'_, RelayPool>,
    args: PublishWithQuorumArgs,
) -> Result<ProtocolCommandResult<QuorumPublishReport>, String> {
    if args.payload.trim().is_empty() {
        return Ok(ProtocolCommandResult::failed(
            SecurityReasonCode::InvalidInput,
            "payload is required",
            false,
        ));
    }
    let event = match parse_event_payload(&args.payload) {
        Ok(event) => event,
        Err(message) => {
            return Ok(ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidInput,
                message,
                false,
            ));
        }
    };

    let relay_urls = normalize_relay_urls(&args.relay_urls);
    if relay_urls.is_empty() {
        return Ok(ProtocolCommandResult::failed(
            SecurityReasonCode::InvalidInput,
            "relayUrls is required",
            false,
        ));
    }

    let started = Instant::now();
    let mut attempts = Vec::<RelayPublishAttempt>::with_capacity(relay_urls.len());
    let window_label = window.label().to_string();

    for relay_url in &relay_urls {
        match relay_pool
            .publish_event_with_ack(
                &window_label,
                relay_url,
                event.clone(),
                Duration::from_millis(DEFAULT_PUBLISH_ACK_TIMEOUT_MS),
            )
            .await
        {
            Ok(_) => attempts.push(RelayPublishAttempt {
                relay_url: relay_url.clone(),
                success: true,
                error: None,
            }),
            Err(error) => attempts.push(RelayPublishAttempt {
                relay_url: relay_url.clone(),
                success: false,
                error: Some(error),
            }),
        }
    }

    let elapsed_ms = started.elapsed().as_millis() as u64;
    Ok(state.with_runtime(|runtime| {
        runtime.publish_with_quorum_attempts(&args.payload, &relay_urls, &attempts, elapsed_ms)
    }))
}

#[tauri::command]
pub async fn protocol_check_storage_health(
    state: State<'_, ProtocolState>,
) -> Result<ProtocolCommandResult<StorageHealthState>, String> {
    Ok(state.with_runtime(|runtime| runtime.check_storage_health()))
}

#[tauri::command]
pub async fn protocol_run_storage_recovery(
    state: State<'_, ProtocolState>,
) -> Result<ProtocolCommandResult<StorageRecoveryReport>, String> {
    Ok(state.with_runtime(|runtime| runtime.run_storage_recovery()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_event_payload_accepts_event_frame() {
        let payload = r#"["EVENT", {"id":"evt-1","kind":4}]"#;
        let parsed = parse_event_payload(payload).expect("event payload");
        assert_eq!(parsed.get("id").and_then(Value::as_str), Some("evt-1"));
    }

    #[test]
    fn parse_event_payload_rejects_invalid_payload() {
        let err = parse_event_payload(r#"{"id":"evt-1"}"#).expect_err("invalid");
        assert!(err.contains("Malformed event payload"));
    }

    #[test]
    fn normalize_relay_urls_dedupes_and_trims() {
        let relays = vec![
            " wss://relay-1.example ".to_string(),
            "wss://relay-1.example".to_string(),
            "".to_string(),
            "wss://relay-2.example".to_string(),
        ];
        let normalized = normalize_relay_urls(&relays);
        assert_eq!(
            normalized,
            vec![
                "wss://relay-1.example".to_string(),
                "wss://relay-2.example".to_string()
            ]
        );
    }
}
