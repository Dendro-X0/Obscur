use crate::protocol::types::{
    CheckpointRepairResult, DeviceAuthorizationRecord, DeviceKeyRecord, IdentityRootState, QuorumPublishReport,
    RatchetChainState, RatchetSessionState, SecurityReasonCode, SessionKeyState, StorageHealthState,
    StorageRecoveryReport, unix_ms_now,
};
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};

pub struct ProtocolStore {
    db_path: String,
}

impl ProtocolStore {
    pub fn new(db_path: impl Into<String>) -> Result<Self, String> {
        let store = Self {
            db_path: db_path.into(),
        };
        store.apply_schema()?;
        store.ensure_local_identity_material()?;
        Ok(store)
    }

    fn open(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path).map_err(|e| e.to_string())
    }

    fn apply_schema(&self) -> Result<(), String> {
        let conn = self.open()?;
        conn.execute_batch(
            r#"
CREATE TABLE IF NOT EXISTS protocol_root_identity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  root_public_key_hex TEXT NOT NULL,
  root_secret_key_hex TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available',
  created_at_unix_ms INTEGER NOT NULL,
  last_rotated_at_unix_ms INTEGER
);

CREATE TABLE IF NOT EXISTS protocol_device_keys (
  device_id TEXT PRIMARY KEY,
  public_key_hex TEXT NOT NULL,
  label TEXT,
  authorized_at_unix_ms INTEGER NOT NULL,
  revoked_at_unix_ms INTEGER,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_sessions (
  session_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  peer_public_key_hex TEXT NOT NULL,
  created_at_unix_ms INTEGER NOT NULL,
  expires_at_unix_ms INTEGER,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_ratchet_sessions (
  session_id TEXT PRIMARY KEY,
  peer_public_key_hex TEXT NOT NULL,
  root_key_hex TEXT NOT NULL,
  sending_chain_key_hex TEXT NOT NULL,
  receiving_chain_key_hex TEXT NOT NULL,
  send_counter INTEGER NOT NULL DEFAULT 0,
  recv_counter INTEGER NOT NULL DEFAULT 0,
  previous_message_counter INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_replay_window (
  session_id TEXT PRIMARY KEY,
  highest_counter INTEGER NOT NULL DEFAULT 0,
  skipped_counters_json TEXT NOT NULL DEFAULT '[]',
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_outbox_publish_reports (
  id TEXT PRIMARY KEY,
  success_count INTEGER NOT NULL,
  total_relays INTEGER NOT NULL,
  met_quorum INTEGER NOT NULL,
  failures_json TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  created_at_unix_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_checkpoint_repairs (
  id TEXT PRIMARY KEY,
  result TEXT NOT NULL,
  reason TEXT,
  created_at_unix_ms INTEGER NOT NULL
);
"#,
        )
        .map_err(|e| e.to_string())
    }

    fn ensure_local_identity_material(&self) -> Result<(), String> {
        let conn = self.open()?;
        let exists: Option<String> = conn
            .query_row(
                "SELECT root_public_key_hex FROM protocol_root_identity WHERE id=1",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if exists.is_some() {
            return Ok(());
        }

        let mut secret = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret);
        let mut pub_seed = Sha256::new();
        pub_seed.update(secret);
        let pub_hex = hex::encode(pub_seed.finalize());
        let now = unix_ms_now();
        conn.execute(
            "INSERT INTO protocol_root_identity (id, root_public_key_hex, root_secret_key_hex, revision, status, created_at_unix_ms) VALUES (1, ?1, ?2, 1, 'available', ?3)",
            params![pub_hex, hex::encode(secret), now],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn identity_root_state(&self) -> Result<IdentityRootState, String> {
        let conn = self.open()?;
        conn.query_row(
            "SELECT root_public_key_hex, created_at_unix_ms, last_rotated_at_unix_ms, revision, status FROM protocol_root_identity WHERE id=1",
            [],
            |row| {
                Ok(IdentityRootState {
                    root_public_key_hex: row.get(0)?,
                    created_at_unix_ms: row.get::<_, i64>(1)? as u64,
                    last_rotated_at_unix_ms: row.get::<_, Option<i64>>(2)?.map(|v| v as u64),
                    revision: row.get::<_, i64>(3)? as u64,
                    status: row.get(4)?,
                })
            },
        )
        .map_err(|e| e.to_string())
    }

    pub fn local_root_secret_hex(&self) -> Result<String, String> {
        let conn = self.open()?;
        conn.query_row(
            "SELECT root_secret_key_hex FROM protocol_root_identity WHERE id=1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    }

    pub fn authorize_device(&self, device_public_key_hex: &str) -> Result<DeviceAuthorizationRecord, String> {
        if device_public_key_hex.trim().is_empty() {
            return Err("Device public key is required".into());
        }
        let now = unix_ms_now();
        let digest = Sha256::digest(device_public_key_hex.as_bytes());
        let device_id = format!("dev-{}", &hex::encode(digest)[..16]);
        let signature = format!("sig-{}", &hex::encode(Sha256::digest(format!("{device_id}:{now}").as_bytes()))[..24]);
        let root = self.identity_root_state()?;
        let conn = self.open()?;
        conn.execute(
            "INSERT INTO protocol_device_keys (device_id, public_key_hex, label, authorized_at_unix_ms, revoked_at_unix_ms, status)
             VALUES (?1, ?2, NULL, ?3, NULL, 'authorized')
             ON CONFLICT(device_id) DO UPDATE SET public_key_hex=excluded.public_key_hex, authorized_at_unix_ms=excluded.authorized_at_unix_ms, revoked_at_unix_ms=NULL, status='authorized'",
            params![device_id, device_public_key_hex, now],
        )
        .map_err(|e| e.to_string())?;

        Ok(DeviceAuthorizationRecord {
            id: device_id,
            root_public_key_hex: root.root_public_key_hex,
            device_public_key_hex: device_public_key_hex.to_string(),
            issued_at_unix_ms: now,
            expires_at_unix_ms: None,
            signature,
        })
    }

    pub fn revoke_device(&self, device_id: &str) -> Result<bool, String> {
        let conn = self.open()?;
        let now = unix_ms_now() as i64;
        let affected = conn
            .execute(
                "UPDATE protocol_device_keys SET status='revoked', revoked_at_unix_ms=?2 WHERE device_id=?1",
                params![device_id, now],
            )
            .map_err(|e| e.to_string())?;
        Ok(affected > 0)
    }

    pub fn get_device_by_pubkey(&self, public_key_hex: &str) -> Result<Option<DeviceKeyRecord>, String> {
        let conn = self.open()?;
        conn.query_row(
            "SELECT device_id, public_key_hex, label, authorized_at_unix_ms, revoked_at_unix_ms, status FROM protocol_device_keys WHERE public_key_hex=?1",
            params![public_key_hex],
            |row| {
                Ok(DeviceKeyRecord {
                    device_id: row.get(0)?,
                    public_key_hex: row.get(1)?,
                    label: row.get(2)?,
                    authorized_at_unix_ms: row.get::<_, i64>(3)? as u64,
                    revoked_at_unix_ms: row.get::<_, Option<i64>>(4)?.map(|v| v as u64),
                    status: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn upsert_session(&self, session: &SessionKeyState, peer_public_key_hex: &str) -> Result<(), String> {
        let conn = self.open()?;
        conn.execute(
            "INSERT INTO protocol_sessions (session_id, device_id, peer_public_key_hex, created_at_unix_ms, expires_at_unix_ms, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(session_id) DO UPDATE SET device_id=excluded.device_id, peer_public_key_hex=excluded.peer_public_key_hex, expires_at_unix_ms=excluded.expires_at_unix_ms, status=excluded.status",
            params![
                session.session_id,
                session.device_id,
                peer_public_key_hex,
                session.created_at_unix_ms as i64,
                session.expires_at_unix_ms.map(|v| v as i64),
                session.status,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn session_state(&self, session_id: &str) -> Result<Option<SessionKeyState>, String> {
        let conn = self.open()?;
        conn.query_row(
            "SELECT session_id, device_id, created_at_unix_ms, expires_at_unix_ms, status FROM protocol_sessions WHERE session_id=?1",
            params![session_id],
            |row| {
                Ok(SessionKeyState {
                    session_id: row.get(0)?,
                    device_id: row.get(1)?,
                    created_at_unix_ms: row.get::<_, i64>(2)? as u64,
                    expires_at_unix_ms: row.get::<_, Option<i64>>(3)?.map(|v| v as u64),
                    status: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn upsert_ratchet(&self, session_id: &str, peer_public_key_hex: &str, state: &RatchetChainState) -> Result<(), String> {
        let conn = self.open()?;
        conn.execute(
            "INSERT INTO protocol_ratchet_sessions (session_id, peer_public_key_hex, root_key_hex, sending_chain_key_hex, receiving_chain_key_hex, send_counter, recv_counter, previous_message_counter, status, updated_at_unix_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active', ?9)
             ON CONFLICT(session_id) DO UPDATE SET
               peer_public_key_hex=excluded.peer_public_key_hex,
               root_key_hex=excluded.root_key_hex,
               sending_chain_key_hex=excluded.sending_chain_key_hex,
               receiving_chain_key_hex=excluded.receiving_chain_key_hex,
               send_counter=excluded.send_counter,
               recv_counter=excluded.recv_counter,
               previous_message_counter=excluded.previous_message_counter,
               status='active',
               updated_at_unix_ms=excluded.updated_at_unix_ms",
            params![
                session_id,
                peer_public_key_hex,
                state.root_key_hex,
                state.sending_chain_key_hex,
                state.receiving_chain_key_hex,
                state.send_counter as i64,
                state.recv_counter as i64,
                state.previous_message_counter.map(|v| v as i64),
                unix_ms_now() as i64,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn ratchet_state(&self, session_id: &str) -> Result<Option<RatchetSessionState>, String> {
        let conn = self.open()?;
        conn.query_row(
            "SELECT session_id, peer_public_key_hex, root_key_hex, send_counter, recv_counter, previous_message_counter, status FROM protocol_ratchet_sessions WHERE session_id=?1",
            params![session_id],
            |row| {
                Ok(RatchetSessionState {
                    session_id: row.get(0)?,
                    peer_public_key_hex: row.get(1)?,
                    root_key_id: row.get(2)?,
                    sending_chain_length: row.get::<_, i64>(3)? as u32,
                    receiving_chain_length: row.get::<_, i64>(4)? as u32,
                    previous_message_counter: row.get::<_, Option<i64>>(5)?.map(|v| v as u32),
                    status: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn raw_ratchet_chain_state(&self, session_id: &str) -> Result<Option<RatchetChainState>, String> {
        let conn = self.open()?;
        conn.query_row(
            "SELECT root_key_hex, sending_chain_key_hex, receiving_chain_key_hex, send_counter, recv_counter, previous_message_counter FROM protocol_ratchet_sessions WHERE session_id=?1",
            params![session_id],
            |row| {
                Ok(RatchetChainState {
                    root_key_hex: row.get(0)?,
                    sending_chain_key_hex: row.get(1)?,
                    receiving_chain_key_hex: row.get(2)?,
                    send_counter: row.get::<_, i64>(3)? as u32,
                    recv_counter: row.get::<_, i64>(4)? as u32,
                    previous_message_counter: row.get::<_, Option<i64>>(5)?.map(|v| v as u32),
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn record_publish_report(&self, report: &QuorumPublishReport) -> Result<(), String> {
        let conn = self.open()?;
        let now = unix_ms_now();
        let id = format!("pub-{}", now);
        let failures_json = serde_json::to_string(&report.failures).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO protocol_outbox_publish_reports (id, success_count, total_relays, met_quorum, failures_json, elapsed_ms, created_at_unix_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                report.success_count as i64,
                report.total_relays as i64,
                if report.met_quorum { 1 } else { 0 },
                failures_json,
                report.elapsed_ms as i64,
                now as i64,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn record_checkpoint_repair(
        &self,
        result: CheckpointRepairResult,
        reason: Option<SecurityReasonCode>,
    ) -> Result<(), String> {
        let conn = self.open()?;
        let now = unix_ms_now();
        conn.execute(
            "INSERT INTO protocol_checkpoint_repairs (id, result, reason, created_at_unix_ms) VALUES (?1, ?2, ?3, ?4)",
            params![
                format!("repair-{now}"),
                serde_json::to_string(&result).unwrap_or_else(|_| "\"failed\"".to_string()),
                reason.map(|r| serde_json::to_string(&r).unwrap_or_else(|_| "\"failed\"".to_string())),
                now as i64
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn check_storage_health(&self) -> StorageHealthState {
        let now = unix_ms_now();
        match self.open().and_then(|conn| {
            let status: String = conn.query_row("PRAGMA integrity_check", [], |row| row.get(0)).map_err(|e| e.to_string())?;
            if status.eq_ignore_ascii_case("ok") {
                Ok(status)
            } else {
                Err(format!("Integrity check failed: {status}"))
            }
        }) {
            Ok(_) => StorageHealthState {
                healthy: true,
                reason_code: None,
                last_checked_at_unix_ms: now,
                details: Some("SQLite integrity_check returned ok".into()),
            },
            Err(err) => StorageHealthState {
                healthy: false,
                reason_code: Some(SecurityReasonCode::StorageUnavailable),
                last_checked_at_unix_ms: now,
                details: Some(err),
            },
        }
    }

    pub fn run_storage_recovery(&self) -> StorageRecoveryReport {
        let started = unix_ms_now();
        let health_before = self.check_storage_health();
        let mut repaired = false;
        let mut message = None;

        if !health_before.healthy {
            if let Ok(conn) = self.open() {
                let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
                repaired = true;
            } else {
                message = Some("Unable to open DB for recovery.".to_string());
            }
        }

        let post = self.check_storage_health();
        let duration_ms = unix_ms_now().saturating_sub(started);
        StorageRecoveryReport {
            repaired: repaired && post.healthy,
            recovered_entries: if repaired && post.healthy { 1 } else { 0 },
            duration_ms,
            reason_code: if post.healthy { None } else { Some(SecurityReasonCode::StorageUnavailable) },
            message: message.or_else(|| post.details),
        }
    }
}

