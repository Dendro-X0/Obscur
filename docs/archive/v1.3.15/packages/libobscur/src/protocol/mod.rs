pub mod e2ee;
pub mod store;
pub mod types;

use crate::protocol::e2ee::ratchet::next_outgoing_message_key;
use crate::protocol::e2ee::verify::verify_envelope;
use crate::protocol::e2ee::x3dh::run_x3dh_bootstrap;
use crate::protocol::store::ProtocolStore;
use crate::protocol::types::{
    unix_ms_now, CheckpointRepairResult, DeviceRevocationResult, EnvelopeVerifyContext,
    MessageVerifyResult, ProtocolCommandResult, QuorumPublishReport, RatchetChainState,
    RatchetSessionState, RelayPublishAttempt, RelayPublishFailure, SecurityReasonCode,
    SessionKeyState, StorageHealthState, StorageRecoveryReport, X3DHHandshakeResult,
    X3DHPreKeyBundle,
};
use sha2::{Digest, Sha256};

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
            Err(err) => {
                ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true)
            }
        }
    }

    pub fn get_session_state(
        &self,
        session_id: &str,
    ) -> ProtocolCommandResult<types::SessionKeyState> {
        if session_id.trim().is_empty() {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidInput,
                "sessionId is required",
                false,
            );
        }
        match self.store.session_state(session_id) {
            Ok(Some(state)) => ProtocolCommandResult::success(state),
            Ok(None) => ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidSession,
                "Session not found",
                false,
            ),
            Err(err) => {
                ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true)
            }
        }
    }

    pub fn authorize_device(
        &self,
        device_public_key_hex: &str,
    ) -> ProtocolCommandResult<types::DeviceAuthorizationRecord> {
        match self.store.authorize_device(device_public_key_hex) {
            Ok(record) => ProtocolCommandResult::success(record),
            Err(err) => ProtocolCommandResult::failed(SecurityReasonCode::InvalidInput, err, false),
        }
    }

    pub fn revoke_device(&self, device_id: &str) -> ProtocolCommandResult<DeviceRevocationResult> {
        if device_id.trim().is_empty() {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidInput,
                "deviceId is required",
                false,
            );
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
            Err(err) => {
                ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true)
            }
        }
    }

    pub fn x3dh_handshake(
        &self,
        peer_public_key_hex: &str,
    ) -> ProtocolCommandResult<X3DHHandshakeResult> {
        if peer_public_key_hex.trim().is_empty() {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidInput,
                "peerPublicKeyHex is required",
                false,
            );
        }

        let local_secret = match self.store.local_root_secret_hex() {
            Ok(v) => v,
            Err(err) => {
                return ProtocolCommandResult::failed(
                    SecurityReasonCode::StorageUnavailable,
                    err,
                    true,
                )
            }
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
            Err(err) => {
                return ProtocolCommandResult::failed(
                    SecurityReasonCode::StorageUnavailable,
                    err,
                    true,
                )
            }
        };
        let session_state = SessionKeyState {
            session_id: bootstrap.session_id.clone(),
            device_id: device_record.id.clone(),
            created_at_unix_ms: bootstrap.established_at_unix_ms,
            expires_at_unix_ms: None,
            status: "unlocked".to_string(),
        };
        if let Err(err) = self
            .store
            .upsert_session(&session_state, peer_public_key_hex)
        {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::StorageUnavailable,
                err,
                true,
            );
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
        if let Err(err) =
            self.store
                .upsert_ratchet(&bootstrap.session_id, peer_public_key_hex, &ratchet_state)
        {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::StorageUnavailable,
                err,
                true,
            );
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

    pub fn get_ratchet_session(
        &self,
        session_id: &str,
    ) -> ProtocolCommandResult<RatchetSessionState> {
        if session_id.trim().is_empty() {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidInput,
                "sessionId is required",
                false,
            );
        }
        match self.store.ratchet_state(session_id) {
            Ok(Some(state)) => ProtocolCommandResult::success(state),
            Ok(None) => ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidSession,
                "Ratchet session not found",
                false,
            ),
            Err(err) => {
                ProtocolCommandResult::failed(SecurityReasonCode::StorageUnavailable, err, true)
            }
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
                return ProtocolCommandResult::failed(
                    SecurityReasonCode::InvalidSession,
                    "Ratchet session not found",
                    false,
                )
            }
            Err(err) => {
                return ProtocolCommandResult::failed(
                    SecurityReasonCode::StorageUnavailable,
                    err,
                    true,
                )
            }
        };

        let verify_result = verify_envelope(&mut raw_state, &context);
        if verify_result.ok {
            if let Ok(Some(meta)) = self.store.ratchet_state(&context.session_id) {
                let _ = self.store.upsert_ratchet(
                    &context.session_id,
                    &meta.peer_public_key_hex,
                    &raw_state,
                );
            }
        }
        ProtocolCommandResult::success(verify_result)
    }

    pub fn publish_with_quorum(
        &self,
        payload: &str,
        relay_urls: &[String],
    ) -> ProtocolCommandResult<QuorumPublishReport> {
        let _ = payload;
        let _ = relay_urls;
        ProtocolCommandResult::unsupported(
            "Protocol runtime publish requires native relay evidence via publish_with_quorum_attempts.",
        )
    }

    pub fn publish_with_quorum_attempts(
        &self,
        payload: &str,
        relay_urls: &[String],
        attempts: &[RelayPublishAttempt],
        elapsed_ms: u64,
    ) -> ProtocolCommandResult<QuorumPublishReport> {
        if payload.trim().is_empty() {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidInput,
                "payload is required",
                false,
            );
        }
        if relay_urls.is_empty() {
            return ProtocolCommandResult::failed(
                SecurityReasonCode::InvalidInput,
                "relayUrls is required",
                false,
            );
        }

        let mut success_count = 0usize;
        let mut failures = Vec::new();

        for relay_url in relay_urls {
            if relay_url.trim().is_empty() {
                failures.push(RelayPublishFailure {
                    relay_url: relay_url.clone(),
                    error: Some("Empty relay URL".to_string()),
                });
                continue;
            }
            let candidate = attempts
                .iter()
                .find(|attempt| attempt.relay_url == *relay_url);
            match candidate {
                Some(attempt) if attempt.success => {
                    success_count += 1;
                }
                Some(attempt) => {
                    failures.push(RelayPublishFailure {
                        relay_url: relay_url.clone(),
                        error: attempt.error.clone().or_else(|| {
                            Some("Relay rejected event (NIP-20 OK=false).".to_string())
                        }),
                    });
                }
                None => {
                    failures.push(RelayPublishFailure {
                        relay_url: relay_url.clone(),
                        error: Some("No publish evidence for scoped relay.".to_string()),
                    });
                }
            }
        }

        if success_count == 0
            && attempts.iter().any(|attempt| {
                !attempt.success && attempt.error.as_deref() == Some("No writable relay connection")
            })
        {
            for relay_url in relay_urls {
                let already_recorded = failures.iter().any(|entry| entry.relay_url == *relay_url);
                if !already_recorded {
                    failures.push(RelayPublishFailure {
                        relay_url: relay_url.clone(),
                        error: Some("No writable relay connection".to_string()),
                    });
                }
            }
            success_count = 0;
        } else if success_count == 0
            && attempts
                .iter()
                .filter(|attempt| !attempt.success)
                .all(|attempt| attempt.error.as_deref() == Some("Timeout waiting for OK response"))
        {
            for relay_url in relay_urls {
                let already_recorded = failures.iter().any(|entry| entry.relay_url == *relay_url);
                if !already_recorded {
                    failures.push(RelayPublishFailure {
                        relay_url: relay_url.clone(),
                        error: Some("Timeout waiting for OK response".to_string()),
                    });
                }
            }
            success_count = 0;
        } else if success_count == 0
            && attempts
                .iter()
                .filter(|attempt| !attempt.success)
                .all(|attempt| {
                    attempt.error.as_deref() == Some("Relay disconnected before OK response")
                })
        {
            for relay_url in relay_urls {
                let already_recorded = failures.iter().any(|entry| entry.relay_url == *relay_url);
                if !already_recorded {
                    failures.push(RelayPublishFailure {
                        relay_url: relay_url.clone(),
                        error: Some("Relay disconnected before OK response".to_string()),
                    });
                }
            }
            success_count = 0;
        }

        if failures.len() > relay_urls.len() {
            failures.truncate(relay_urls.len());
        }
        if success_count > relay_urls.len() {
            success_count = relay_urls.len();
        }

        let total = relay_urls.len();
        let met_quorum = success_count > 0 && success_count * 2 >= total.max(1);
        let report = QuorumPublishReport {
            success_count,
            total_relays: total,
            met_quorum,
            failures,
            elapsed_ms,
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
        let session_id = result.value.and_then(|v| v.session_id).expect("session id");
        let ratchet = runtime.get_ratchet_session(&session_id);
        assert!(ratchet.ok);
    }

    #[test]
    fn publish_attempts_meet_quorum_when_majority_succeeds() {
        let mut db_path: PathBuf = std::env::temp_dir();
        db_path.push(format!(
            "obscur-protocol-publish-test-{}.sqlite3",
            unix_ms_now()
        ));
        let runtime = ProtocolRuntime::new(db_path.to_string_lossy().to_string()).expect("runtime");
        let relays = vec![
            "wss://relay-1.example".to_string(),
            "wss://relay-2.example".to_string(),
            "wss://relay-3.example".to_string(),
        ];
        let attempts = vec![
            RelayPublishAttempt {
                relay_url: relays[0].clone(),
                success: true,
                error: None,
            },
            RelayPublishAttempt {
                relay_url: relays[1].clone(),
                success: true,
                error: None,
            },
            RelayPublishAttempt {
                relay_url: relays[2].clone(),
                success: false,
                error: Some("Timeout waiting for OK response".to_string()),
            },
        ];

        let result = runtime.publish_with_quorum_attempts("payload", &relays, &attempts, 33);
        assert!(result.ok);
        let report = result.value.expect("report");
        assert_eq!(report.success_count, 2);
        assert_eq!(report.total_relays, 3);
        assert!(report.met_quorum);
        assert_eq!(report.failures.len(), 1);
        assert_eq!(report.elapsed_ms, 33);
    }

    #[test]
    fn publish_attempts_fail_when_no_writable_relay_connection_exists() {
        let mut db_path: PathBuf = std::env::temp_dir();
        db_path.push(format!(
            "obscur-protocol-publish-test-{}.sqlite3",
            unix_ms_now()
        ));
        let runtime = ProtocolRuntime::new(db_path.to_string_lossy().to_string()).expect("runtime");
        let relays = vec![
            "wss://relay-1.example".to_string(),
            "wss://relay-2.example".to_string(),
        ];
        let attempts = vec![
            RelayPublishAttempt {
                relay_url: relays[0].clone(),
                success: false,
                error: Some("No writable relay connection".to_string()),
            },
            RelayPublishAttempt {
                relay_url: relays[1].clone(),
                success: false,
                error: Some("No writable relay connection".to_string()),
            },
        ];

        let result = runtime.publish_with_quorum_attempts("payload", &relays, &attempts, 19);
        assert!(result.ok);
        let report = result.value.expect("report");
        assert_eq!(report.success_count, 0);
        assert!(!report.met_quorum);
        assert_eq!(report.failures.len(), 2);
        assert!(report
            .failures
            .iter()
            .all(|entry| entry.error.as_deref() == Some("No writable relay connection")));
    }

    #[test]
    fn publish_attempts_require_payload_and_relay_scope() {
        let mut db_path: PathBuf = std::env::temp_dir();
        db_path.push(format!(
            "obscur-protocol-publish-test-{}.sqlite3",
            unix_ms_now()
        ));
        let runtime = ProtocolRuntime::new(db_path.to_string_lossy().to_string()).expect("runtime");
        let relays = vec!["wss://relay-1.example".to_string()];
        let attempts = vec![RelayPublishAttempt {
            relay_url: relays[0].clone(),
            success: true,
            error: None,
        }];

        let missing_payload = runtime.publish_with_quorum_attempts("", &relays, &attempts, 10);
        assert!(!missing_payload.ok);
        assert_eq!(
            missing_payload.error.as_ref().map(|error| &error.reason),
            Some(&SecurityReasonCode::InvalidInput)
        );

        let missing_relays = runtime.publish_with_quorum_attempts("payload", &[], &attempts, 10);
        assert!(!missing_relays.ok);
        assert_eq!(
            missing_relays.error.as_ref().map(|error| &error.reason),
            Some(&SecurityReasonCode::InvalidInput)
        );
    }
}
