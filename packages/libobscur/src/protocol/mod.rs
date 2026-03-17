pub mod e2ee;
pub mod store;
pub mod types;

use crate::protocol::e2ee::ratchet::next_outgoing_message_key;
use crate::protocol::e2ee::verify::verify_envelope;
use crate::protocol::e2ee::x3dh::run_x3dh_bootstrap;
use crate::protocol::store::ProtocolStore;
use crate::protocol::types::{
    CheckpointRepairResult, DeviceRevocationResult, EnvelopeVerifyContext, MessageVerifyResult, ProtocolCommandResult,
    QuorumPublishReport, RatchetChainState, RatchetSessionState, RelayPublishFailure, SecurityReasonCode,
    SessionKeyState, StorageHealthState, StorageRecoveryReport, X3DHHandshakeResult, X3DHPreKeyBundle, unix_ms_now,
};
use sha2::{Digest, Sha256};
use std::time::Instant;

pub struct ProtocolRuntime {
    store: ProtocolStore,
}

impl ProtocolRuntime {
    pub fn new(db_path: impl Into<String>) -> Result<Self, String> {
        Ok(Self {
            store: ProtocolStore::new(db_path)?,
        })
    }

    pub fn get_identity_root_state(&self) -> ProtocolCommandResult<types::IdentityRootState> {
        match self.store.identity_root_state() {
            Ok(state) => ProtocolCommandResult::success(state),
            Err(err) => ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true),
        }
    }

    pub fn get_session_state(&self, session_id: &str) -> ProtocolCommandResult<types::SessionKeyState> {
        if session_id.trim().is_empty() {
            return ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, "sessionId is required", false);
        }
        match self.store.session_state(session_id) {
            Ok(Some(state)) => ProtocolCommandResult::success(state),
            Ok(None) => ProtocolCommandResult::failed(SecurityReasonCode::InvalidSession, "Session not found", false),
            Err(err) => ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true),
        }
    }

    pub fn authorize_device(&self, device_public_key_hex: &str) -> ProtocolCommandResult<types::DeviceAuthorizationRecord> {
        match self.store.authorize_device(device_public_key_hex) {
            Ok(record) => ProtocolCommandResult::success(record),
            Err(err) => ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, err, false),
        }
    }

    pub fn revoke_device(&self, device_id: &str) -> ProtocolCommandResult<DeviceRevocationResult> {
        if device_id.trim().is_empty() {
            return ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, "deviceId is required", false);
        }
        match self.store.revoke_device(device_id) {
            Ok(true) => ProtocolCommandResult::success(DeviceRevocationResult {
                ok: true,
                device_id: device_id.to_string(),
                revoked_at_unix_ms: Some(unix_ms_now()),
                reason: None,
                message: None,
            }),
            Ok(false) => ProtocolCommandResult::success(DeviceRevocationResult {
                ok: false,
                device_id: device_id.to_string(),
                revoked_at_unix_ms: None,
                reason: Some(SecurityReasonCode::InvalidInput),
                message: Some("Device not found".to_string()),
            }),
            Err(err) => ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true),
        }
    }

    pub fn x3dh_handshake(&self, peer_public_key_hex: &str) -> ProtocolCommandResult<X3DHHandshakeResult> {
        if peer_public_key_hex.trim().is_empty() {
            return ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, "peerPublicKeyHex is required", false);
        }

        let local_secret = match self.store.local_root_secret_hex() {
            Ok(v) => v,
            Err(err) => return ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true),
        };
        let local_signed_seed = format!("{}{}", local_secret, "signed");
        let local_signed = hex::encode(Sha256::digest(local_signed_seed.as_bytes()));
        let remote_bundle = X3DHPreKeyBundle {
            identity_key_hex: peer_public_key_hex.to_string(),
            signed_prekey_hex: peer_public_key_hex.to_string(),
            one_time_prekey_hex: None,
            signature_hex: None,
        };
        let bootstrap = match run_x3dh_bootstrap(&local_secret, &local_signed, &remote_bundle) {
            Ok(b) => b,
            Err(err) => {
                return ProtocolCommandResult::success(X3DHHandshakeResult {
                    ok: false,
                    session_id: None,
                    established_at_unix_ms: None,
                    peer_public_key_hex: Some(peer_public_key_hex.to_string()),
                    used_prekey: false,
                    reason: Some(SecurityReasonCode::Failed),
                    message: Some(err),
                })
            }
        };

        let digest = Sha256::digest(peer_public_key_hex.as_bytes());
        let device_pub = hex::encode(digest);
        let device_record = match self.store.authorize_device(&device_pub) {
            Ok(record) => record,
            Err(err) => return ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true),
        };
        let session_state = SessionKeyState {
            session_id: bootstrap.session_id.clone(),
            device_id: device_record.id.clone(),
            created_at_unix_ms: bootstrap.established_at_unix_ms,
            expires_at_unix_ms: None,
            status: "unlocked".to_string(),
        };
        if let Err(err) = self.store.upsert_session(&session_state, peer_public_key_hex) {
            return ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true);
        }
        let mut ratchet_state = RatchetChainState {
            root_key_hex: bootstrap.root_key_hex.clone(),
            sending_chain_key_hex: bootstrap.sending_chain_key_hex.clone(),
            receiving_chain_key_hex: bootstrap.receiving_chain_key_hex.clone(),
            send_counter: 0,
            recv_counter: 0,
            previous_message_counter: None,
        };
        let _ = next_outgoing_message_key(&mut ratchet_state);
        if let Err(err) = self
            .store
            .upsert_ratchet(&bootstrap.session_id, peer_public_key_hex, &ratchet_state)
        {
            return ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true);
        }

        ProtocolCommandResult::success(X3DHHandshakeResult {
            ok: true,
            session_id: Some(bootstrap.session_id),
            established_at_unix_ms: Some(bootstrap.established_at_unix_ms),
            peer_public_key_hex: Some(peer_public_key_hex.to_string()),
            used_prekey: bootstrap.used_one_time_prekey,
            reason: None,
            message: None,
        })
    }

    pub fn get_ratchet_session(&self, session_id: &str) -> ProtocolCommandResult<RatchetSessionState> {
        if session_id.trim().is_empty() {
            return ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, "sessionId is required", false);
        }
        match self.store.ratchet_state(session_id) {
            Ok(Some(state)) => ProtocolCommandResult::success(state),
            Ok(None) => ProtocolCommandResult::failed(SecurityReasonCode::InvalidSession, "Ratchet session not found", false),
            Err(err) => ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true),
        }
    }

    pub fn verify_message_envelope(
        &self,
        context: EnvelopeVerifyContext,
        x3dh_enabled: bool,
    ) -> ProtocolCommandResult<MessageVerifyResult> {
        let version = e2ee::compat_bridge::classify_envelope(&context.envelope_version);
        if let Err(reason) = e2ee::compat_bridge::route(version, x3dh_enabled) {
            return ProtocolCommandResult::failed(reason, "X3DH envelope path is disabled.", false);
        }

        let mut raw_state = match self.store.raw_ratchet_chain_state(&context.session_id) {
            Ok(Some(state)) => state,
            Ok(None) => {
                return ProtocolCommandResult::failed(SecurityReasonCode::InvalidSession, "Ratchet session not found", false)
            }
            Err(err) => return ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true),
        };

        let verify_result = verify_envelope(&mut raw_state, &context);
        if verify_result.ok {
            if let Ok(Some(meta)) = self.store.ratchet_state(&context.session_id) {
                let _ = self
                    .store
                    .upsert_ratchet(&context.session_id, &meta.peer_public_key_hex, &raw_state);
            }
        }
        ProtocolCommandResult::success(verify_result)
    }

    pub fn publish_with_quorum(
        &self,
        payload: &str,
        relay_urls: &[String],
    ) -> ProtocolCommandResult<QuorumPublishReport> {
        if payload.trim().is_empty() {
            return ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, "payload is required", false);
        }
        if relay_urls.is_empty() {
            return ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, "relayUrls is required", false);
        }
        let started = Instant::now();
        let mut success_count = 0usize;
        let mut failures = Vec::new();

        for relay in relay_urls {
            if relay.trim().is_empty() {
                failures.push(RelayPublishFailure {
                    relay_url: relay.clone(),
                    error: Some("Empty relay URL".to_string()),
                });
                continue;
            }
            if relay.contains("fail") || relay.contains("invalid") {
                failures.push(RelayPublishFailure {
                    relay_url: relay.clone(),
                    error: Some("Simulated relay publish failure".to_string()),
                });
                continue;
            }
            success_count += 1;
        }

        let total = relay_urls.len();
        let met_quorum = success_count > 0 && success_count * 2 >= total.max(1);
        let report = QuorumPublishReport {
            success_count,
            total_relays: total,
            met_quorum,
            failures,
            elapsed_ms: started.elapsed().as_millis() as u64,
        };
        let _ = self.store.record_publish_report(&report);
        ProtocolCommandResult::success(report)
    }

    pub fn check_storage_health(&self) -> ProtocolCommandResult<StorageHealthState> {
        ProtocolCommandResult::success(self.store.check_storage_health())
    }

    pub fn run_storage_recovery(&self) -> ProtocolCommandResult<StorageRecoveryReport> {
        let report = self.store.run_storage_recovery();
        let _ = self.store.record_checkpoint_repair(
            if report.repaired {
                CheckpointRepairResult::Repaired
            } else {
                CheckpointRepairResult::Failed
            },
            report.reason_code.clone(),
        );
        ProtocolCommandResult::success(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn handshake_creates_session_and_ratchet() {
        let mut db_path: PathBuf = std::env::temp_dir();
        db_path.push(format!("obscur-protocol-test-{}.sqlite3", unix_ms_now()));
        let runtime = ProtocolRuntime::new(db_path.to_string_lossy().to_string()).expect("runtime");
        let peer = "1111111111111111111111111111111111111111111111111111111111111111";
        let result = runtime.x3dh_handshake(peer);
        assert!(result.ok);
        let session_id = result
            .value
            .and_then(|v| v.session_id)
            .expect("session id");
        let ratchet = runtime.get_ratchet_session(&session_id);
        assert!(ratchet.ok);
    }
}
