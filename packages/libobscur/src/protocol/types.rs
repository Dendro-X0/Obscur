use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SecurityReasonCode {
    InvalidInput,
    InvalidSignature,
    InvalidSession,
    SessionExpired,
    ReplayRejected,
    OutOfOrder,
    UnsupportedRuntime,
    UnsupportedToken,
    Offline,
    RelayDegraded,
    StorageUnavailable,
    IntegrityMismatch,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolErrorPayload {
    pub reason: SecurityReasonCode,
    pub message: String,
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolCommandResult<T> {
    pub ok: bool,
    pub value: Option<T>,
    pub error: Option<ProtocolErrorPayload>,
}

impl<T> ProtocolCommandResult<T> {
    pub fn success(value: T) -> Self {
        Self {
            ok: true,
            value: Some(value),
            error: None,
        }
    }

    pub fn unsupported(message: impl Into<String>) -> Self {
        Self::failed(SecurityReasonCode::UnsupportedRuntime, message, false)
    }

    pub fn failed(reason: SecurityReasonCode, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            ok: false,
            value: None,
            error: Some(ProtocolErrorPayload {
                reason,
                message: message.into(),
                retryable,
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityRootState {
    pub root_public_key_hex: String,
    pub created_at_unix_ms: u64,
    pub last_rotated_at_unix_ms: Option<u64>,
    pub revision: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceKeyRecord {
    pub device_id: String,
    pub public_key_hex: String,
    pub label: Option<String>,
    pub authorized_at_unix_ms: u64,
    pub revoked_at_unix_ms: Option<u64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionKeyState {
    pub session_id: String,
    pub device_id: String,
    pub created_at_unix_ms: u64,
    pub expires_at_unix_ms: Option<u64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAuthorizationRecord {
    pub id: String,
    pub root_public_key_hex: String,
    pub device_public_key_hex: String,
    pub issued_at_unix_ms: u64,
    pub expires_at_unix_ms: Option<u64>,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceRevocationResult {
    pub ok: bool,
    pub device_id: String,
    pub revoked_at_unix_ms: Option<u64>,
    pub reason: Option<SecurityReasonCode>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct X3DHPreKeyBundle {
    pub identity_key_hex: String,
    pub signed_prekey_hex: String,
    pub one_time_prekey_hex: Option<String>,
    pub signature_hex: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct X3DHSessionBootstrap {
    pub session_id: String,
    pub root_key_hex: String,
    pub sending_chain_key_hex: String,
    pub receiving_chain_key_hex: String,
    pub established_at_unix_ms: u64,
    pub used_one_time_prekey: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct X3DHHandshakeResult {
    pub ok: bool,
    pub session_id: Option<String>,
    pub established_at_unix_ms: Option<u64>,
    pub peer_public_key_hex: Option<String>,
    pub used_prekey: bool,
    pub reason: Option<SecurityReasonCode>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RatchetChainState {
    pub root_key_hex: String,
    pub sending_chain_key_hex: String,
    pub receiving_chain_key_hex: String,
    pub send_counter: u32,
    pub recv_counter: u32,
    pub previous_message_counter: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RatchetSessionState {
    pub session_id: String,
    pub peer_public_key_hex: String,
    pub root_key_id: String,
    pub sending_chain_length: u32,
    pub receiving_chain_length: u32,
    pub previous_message_counter: Option<u32>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReplayWindowState {
    pub highest_counter: u32,
    pub skipped_counters: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvelopeVerifyContext {
    pub session_id: String,
    pub message_id: String,
    pub counter: u32,
    pub envelope_version: String,
    pub ciphertext: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageVerifyResult {
    pub ok: bool,
    pub session_id: Option<String>,
    pub message_id: Option<String>,
    pub verified_at_unix_ms: Option<u64>,
    pub reason: Option<SecurityReasonCode>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuorumPublishReport {
    pub success_count: usize,
    pub total_relays: usize,
    pub met_quorum: bool,
    pub failures: Vec<RelayPublishFailure>,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayPublishAttempt {
    pub relay_url: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayPublishFailure {
    pub relay_url: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageHealthState {
    pub healthy: bool,
    pub reason_code: Option<SecurityReasonCode>,
    pub last_checked_at_unix_ms: u64,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageRecoveryReport {
    pub repaired: bool,
    pub recovered_entries: usize,
    pub duration_ms: u64,
    pub reason_code: Option<SecurityReasonCode>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckpointRepairResult {
    Ok,
    Repaired,
    Failed,
}

pub fn unix_ms_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
