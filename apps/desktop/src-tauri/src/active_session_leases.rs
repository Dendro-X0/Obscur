use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::Mutex;
use tauri::AppHandle;

use crate::data_root::resolve_effective_data_root;

const LEASE_FILE: &str = "active_session_leases.json";
pub const ACTIVE_SESSION_LEASE_TTL_MS: u64 = 12_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSessionLeaseRecord {
    pub public_key_hex: String,
    pub profile_id: String,
    pub profile_label: String,
    pub window_label: String,
    pub updated_at_unix_ms: u64,
}

type LeaseMap = HashMap<String, ActiveSessionLeaseRecord>;

pub struct ActiveSessionLeaseState {
    inner: Mutex<LeaseMap>,
}

fn lease_file_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(resolve_effective_data_root(app)?.join(LEASE_FILE))
}

fn read_lease_map(app: &AppHandle) -> Result<LeaseMap, String> {
    let path = lease_file_path(app)?;
    if !path.is_file() {
        return Ok(HashMap::new());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let parsed = serde_json::from_str::<LeaseMap>(&raw).unwrap_or_default();
    Ok(parsed)
}

fn write_lease_map(app: &AppHandle, map: &LeaseMap) -> Result<(), String> {
    let path = lease_file_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string(map).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

fn normalize_public_key_hex(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.len() != 64 || !normalized.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }
    Some(normalized)
}

fn is_lease_fresh(lease: &ActiveSessionLeaseRecord, now_ms: u64) -> bool {
    now_ms.saturating_sub(lease.updated_at_unix_ms) <= ACTIVE_SESSION_LEASE_TTL_MS
}

fn prune_stale_leases(map: &mut LeaseMap, now_ms: u64) {
    map.retain(|_, lease| is_lease_fresh(lease, now_ms));
}

impl ActiveSessionLeaseState {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let mut map = read_lease_map(app)?;
        prune_stale_leases(&mut map, now_unix_ms());
        Ok(Self {
            inner: Mutex::new(map),
        })
    }

    fn persist(&self, app: &AppHandle) -> Result<(), String> {
        let map = self.inner.lock().map_err(|_| "Active session lease lock poisoned".to_string())?;
        write_lease_map(app, &map)
    }

    pub fn find_active_session_lease(
        &self,
        app: &AppHandle,
        public_key_hex: &str,
        exclude_profile_id: Option<&str>,
        exclude_window_label: Option<&str>,
    ) -> Result<Option<ActiveSessionLeaseRecord>, String> {
        let Some(target) = normalize_public_key_hex(public_key_hex) else {
            return Ok(None);
        };
        let now_ms = now_unix_ms();
        let mut map = self.inner.lock().map_err(|_| "Active session lease lock poisoned".to_string())?;
        prune_stale_leases(&mut map, now_ms);
        let Some(lease) = map.get(&target).cloned() else {
            drop(map);
            self.persist(app)?;
            return Ok(None);
        };
        if !is_lease_fresh(&lease, now_ms) {
            map.remove(&target);
            drop(map);
            self.persist(app)?;
            return Ok(None);
        }
        let exclude_profile_id = exclude_profile_id.map(str::trim).filter(|value| !value.is_empty());
        let exclude_window_label = exclude_window_label.map(str::trim).filter(|value| !value.is_empty());
        if let (Some(profile_id), Some(window_label)) = (exclude_profile_id, exclude_window_label) {
            if lease.profile_id == profile_id && lease.window_label == window_label {
                drop(map);
                return Ok(None);
            }
        }
        drop(map);
        Ok(Some(lease))
    }

    pub fn claim_active_session_lease(
        &self,
        app: &AppHandle,
        record: ActiveSessionLeaseRecord,
    ) -> Result<(), String> {
        let Some(public_key_hex) = normalize_public_key_hex(&record.public_key_hex) else {
            return Ok(());
        };
        let now_ms = now_unix_ms();
        let mut map = self.inner.lock().map_err(|_| "Active session lease lock poisoned".to_string())?;
        prune_stale_leases(&mut map, now_ms);
        map.insert(
            public_key_hex,
            ActiveSessionLeaseRecord {
                public_key_hex: record.public_key_hex.trim().to_ascii_lowercase(),
                profile_id: record.profile_id.trim().to_string(),
                profile_label: record.profile_label.trim().to_string(),
                window_label: record.window_label.trim().to_string(),
                updated_at_unix_ms: now_ms,
            },
        );
        drop(map);
        self.persist(app)
    }

    pub fn touch_active_session_lease(
        &self,
        app: &AppHandle,
        public_key_hex: &str,
        profile_id: &str,
    ) -> Result<(), String> {
        let Some(target) = normalize_public_key_hex(public_key_hex) else {
            return Ok(());
        };
        let profile_id = profile_id.trim();
        let now_ms = now_unix_ms();
        let mut map = self.inner.lock().map_err(|_| "Active session lease lock poisoned".to_string())?;
        let Some(existing) = map.get_mut(&target) else {
            return Ok(());
        };
        if existing.profile_id != profile_id {
            return Ok(());
        }
        existing.updated_at_unix_ms = now_ms;
        drop(map);
        self.persist(app)
    }

    pub fn list_active_session_leases(&self, app: &AppHandle) -> Result<Vec<ActiveSessionLeaseRecord>, String> {
        let now_ms = now_unix_ms();
        let mut map = self.inner.lock().map_err(|_| "Active session lease lock poisoned".to_string())?;
        prune_stale_leases(&mut map, now_ms);
        let leases: Vec<ActiveSessionLeaseRecord> = map.values().cloned().collect();
        drop(map);
        self.persist(app)?;
        Ok(leases)
    }

    pub fn release_active_session_lease(
        &self,
        app: &AppHandle,
        public_key_hex: &str,
        profile_id: &str,
    ) -> Result<(), String> {
        let Some(target) = normalize_public_key_hex(public_key_hex) else {
            return Ok(());
        };
        let profile_id = profile_id.trim();
        let mut map = self.inner.lock().map_err(|_| "Active session lease lock poisoned".to_string())?;
        let should_remove = map
            .get(&target)
            .map(|existing| existing.profile_id == profile_id)
            .unwrap_or(false);
        if should_remove {
            map.remove(&target);
        }
        drop(map);
        self.persist(app)
    }
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
