//! Rust-owned account-sync phase snapshot (Step B).
//! Read-only façade until Step C wires `account_sync_run_restore`.
//! Unlock must never drive phase transitions — Settings intent only.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum AccountSyncPhase {
    #[default]
    Idle,
    FoundAccount,
    RestoringProfile,
    RestoringAccountData,
    SyncingMessagesAndRequests,
    Ready,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum AccountSyncStatus {
    #[default]
    IdentityOnly,
    PublicRestored,
    PrivateRestored,
    Degraded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSyncNativeSnapshot {
    pub phase: AccountSyncPhase,
    pub status: AccountSyncStatus,
    pub message: String,
    pub profile_id: Option<String>,
    pub public_key_hex: Option<String>,
    pub in_flight: bool,
    pub updated_at_unix_ms: u64,
}

impl Default for AccountSyncNativeSnapshot {
    fn default() -> Self {
        Self {
            phase: AccountSyncPhase::Idle,
            status: AccountSyncStatus::IdentityOnly,
            message: String::new(),
            profile_id: None,
            public_key_hex: None,
            in_flight: false,
            updated_at_unix_ms: 0,
        }
    }
}

pub struct AccountSyncState {
    inner: Mutex<AccountSyncNativeSnapshot>,
}

impl AccountSyncState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(AccountSyncNativeSnapshot::default()),
        }
    }

    pub fn snapshot(&self) -> AccountSyncNativeSnapshot {
        self.inner
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    /// Internal mutation API for Step C restore — not exposed as unlock autopilot.
    #[allow(dead_code)]
    pub fn replace_snapshot(&self, next: AccountSyncNativeSnapshot) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = next;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_snapshot_is_idle_not_in_flight() {
        let state = AccountSyncState::new();
        let snap = state.snapshot();
        assert_eq!(snap.phase, AccountSyncPhase::Idle);
        assert!(!snap.in_flight);
    }

    #[test]
    fn replace_snapshot_round_trips() {
        let state = AccountSyncState::new();
        state.replace_snapshot(AccountSyncNativeSnapshot {
            phase: AccountSyncPhase::Ready,
            status: AccountSyncStatus::PrivateRestored,
            message: "ok".into(),
            profile_id: Some("default".into()),
            public_key_hex: None,
            in_flight: false,
            updated_at_unix_ms: 1,
        });
        let snap = state.snapshot();
        assert_eq!(snap.phase, AccountSyncPhase::Ready);
        assert_eq!(snap.message, "ok");
    }
}
