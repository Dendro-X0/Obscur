use libobscur::protocol::types::{
    DeviceAuthorizationRecord, DeviceRevocationResult, EnvelopeVerifyContext, IdentityRootState,
    MessageVerifyResult, ProtocolCommandResult, QuorumPublishReport, RatchetSessionState,
    SecurityReasonCode, SessionKeyState, StorageHealthState, StorageRecoveryReport,
    X3DHHandshakeResult,
};
use libobscur::protocol::ProtocolRuntime;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

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
    state: State<'_, ProtocolState>,
    args: PublishWithQuorumArgs,
) -> Result<ProtocolCommandResult<QuorumPublishReport>, String> {
    Ok(state.with_runtime(|runtime| runtime.publish_with_quorum(&args.payload, &args.relay_urls)))
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
