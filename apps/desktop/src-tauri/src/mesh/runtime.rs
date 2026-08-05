//! Mesh runtime façade — configure, schedule, snapshot (RUST-1b/1c) · SSH underlay (RUST-5b).

use super::descriptor::{ConduitDescriptor, ConduitDialect, ConduitUnderlay};
use super::registry::{ConduitRegistry, ConfigureMeshResult, SkippedConduit};
use super::scheduler::{select_active_set, SchedulerHints, DEFAULT_MAX_REDUNDANCY};
use super::snapshot::{build_mesh_snapshot, BuildMeshSnapshotParams, MeshSnapshotJson};
use super::tor_policy::MeshTorRuntimeState;
use super::underlay::{OpenSshSpawner, SshTunnelSession};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const SSH_LISTEN_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshConnectAttempt {
    pub endpoint_url: String,
    pub success: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshConfigureOutcome {
    pub ok: bool,
    pub revision: u64,
    pub accepted_conduit_ids: Vec<String>,
    pub skipped: Vec<SkippedConduit>,
    pub active_conduit_ids: Vec<String>,
    pub active_endpoint_urls: Vec<String>,
    pub tor_blocked_conduit_ids: Vec<String>,
    /// Dual-run flag: TS should not own failover when true.
    pub mesh_scheduler_owns_failover: bool,
    #[serde(default)]
    pub connect_attempts: Vec<MeshConnectAttempt>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot: Option<MeshSnapshotJson>,
}

#[derive(Debug, Default)]
struct ProfileRuntimeCache {
    active_conduit_ids: Vec<String>,
    active_endpoint_urls: Vec<String>,
    tor_blocked_conduit_ids: Vec<String>,
    mesh_scheduler_owns_failover: bool,
    last_failure_reason: Option<String>,
    #[allow(dead_code)]
    last_tor: MeshTorRuntimeState,
    #[allow(dead_code)]
    max_redundancy: usize,
}

pub struct MeshRuntimeState {
    registry: Mutex<ConduitRegistry>,
    cache: Mutex<HashMap<String, ProfileRuntimeCache>>,
    /// Live SSH local-forward sessions keyed by profileId → conduitId.
    ssh_underlays: Mutex<HashMap<String, HashMap<String, SshTunnelSession>>>,
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl MeshRuntimeState {
    pub fn new() -> Self {
        Self {
            registry: Mutex::new(ConduitRegistry::new()),
            cache: Mutex::new(HashMap::new()),
            ssh_underlays: Mutex::new(HashMap::new()),
        }
    }

    /// Stop prior SSH sessions for a profile; start forwards for SSH conduits.
    /// Fail closed: mark blocked on error — never dial remote clearnet.
    fn restart_ssh_underlays(&self, profile_id: &str, registry: &mut ConduitRegistry) {
        {
            let mut map = self.ssh_underlays.lock().expect("mesh ssh underlay lock");
            if let Some(sessions) = map.remove(profile_id) {
                for (_, mut session) in sessions {
                    session.stop();
                }
            }
        }

        let entries = registry.entries(profile_id);
        let mut started: HashMap<String, SshTunnelSession> = HashMap::new();
        for entry in entries {
            if entry.resolved_underlay != ConduitUnderlay::SshTunnel {
                continue;
            }
            let conduit_id = entry.descriptor.conduit_id.clone();
            let Some(params) = entry.descriptor.ssh_tunnel.clone() else {
                registry.mark_underlay_failed(profile_id, &conduit_id, "ssh_params_missing");
                continue;
            };
            let mut spawner = OpenSshSpawner;
            match SshTunnelSession::start(&params, &mut spawner, SSH_LISTEN_TIMEOUT) {
                Ok(session) => {
                    started.insert(conduit_id, session);
                }
                Err(error) => {
                    registry.mark_underlay_failed(profile_id, &conduit_id, error.code());
                }
            }
        }
        if !started.is_empty() {
            self.ssh_underlays
                .lock()
                .expect("mesh ssh underlay lock")
                .insert(profile_id.to_string(), started);
        }
    }

    /// Register conduits, bring up SSH underlays, select active set. Does not dial WS.
    pub fn configure_and_select(
        &self,
        profile_id: &str,
        conduits: Vec<ConduitDescriptor>,
        tor: MeshTorRuntimeState,
        max_redundancy: Option<usize>,
    ) -> MeshConfigureOutcome {
        let max_redundancy = max_redundancy.unwrap_or(DEFAULT_MAX_REDUNDANCY);
        let mut registry = self.registry.lock().expect("mesh registry lock");
        let configured: ConfigureMeshResult = registry.configure(profile_id, conduits);
        self.restart_ssh_underlays(profile_id, &mut registry);

        let entries = registry.entries(profile_id);
        let mut skipped = configured.skipped;

        let hints = SchedulerHints {
            tor,
            max_redundancy,
            ..SchedulerHints::default()
        };
        let selection = select_active_set(&entries, &hints);
        registry.mark_tor_blocked(profile_id, &selection.tor_blocked_conduit_ids);

        let dialable: Vec<(String, String)> = entries
            .iter()
            .filter(|e| selection.conduit_ids.contains(&e.descriptor.conduit_id))
            .filter(|e| {
                matches!(
                    e.descriptor.dialect,
                    ConduitDialect::NostrWs | ConduitDialect::TeamRelay
                )
            })
            .flat_map(|e| {
                e.descriptor
                    .endpoints
                    .iter()
                    .filter(|u| !u.trim().is_empty())
                    .map(|u| (e.descriptor.conduit_id.clone(), u.trim().to_string()))
                    .collect::<Vec<_>>()
            })
            .collect();

        let mut active_endpoint_urls = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for (_id, url) in &dialable {
            if seen.insert(url.clone()) {
                active_endpoint_urls.push(url.clone());
            }
        }

        for id in &selection.conduit_ids {
            if let Some(entry) = entries.iter().find(|e| &e.descriptor.conduit_id == id) {
                if !matches!(
                    entry.descriptor.dialect,
                    ConduitDialect::NostrWs | ConduitDialect::TeamRelay
                ) {
                    skipped.push(SkippedConduit {
                        conduit_id: id.clone(),
                        reason: "dialect_dial_deferred_rust_1b".into(),
                    });
                }
            }
        }

        let active_conduit_ids: Vec<String> = selection
            .conduit_ids
            .iter()
            .filter(|id| {
                entries.iter().any(|e| {
                    &e.descriptor.conduit_id == *id
                        && matches!(
                            e.descriptor.dialect,
                            ConduitDialect::NostrWs | ConduitDialect::TeamRelay
                        )
                })
            })
            .cloned()
            .collect();

        let mesh_scheduler_owns_failover = !active_endpoint_urls.is_empty();
        let tor_blocked = selection.tor_blocked_conduit_ids.clone();

        {
            let mut cache = self.cache.lock().expect("mesh cache lock");
            cache.insert(
                profile_id.to_string(),
                ProfileRuntimeCache {
                    active_conduit_ids: active_conduit_ids.clone(),
                    active_endpoint_urls: active_endpoint_urls.clone(),
                    tor_blocked_conduit_ids: tor_blocked.clone(),
                    mesh_scheduler_owns_failover,
                    last_failure_reason: None,
                    last_tor: tor,
                    max_redundancy,
                },
            );
        }

        let revision = configured.revision;
        drop(registry);

        let snapshot = self.get_snapshot(profile_id);

        MeshConfigureOutcome {
            ok: configured.ok,
            revision,
            accepted_conduit_ids: configured.accepted_conduit_ids,
            skipped,
            active_conduit_ids,
            active_endpoint_urls,
            tor_blocked_conduit_ids: tor_blocked,
            mesh_scheduler_owns_failover,
            connect_attempts: Vec::new(),
            snapshot: Some(snapshot),
        }
    }

    pub fn apply_connect_attempts(&self, profile_id: &str, attempts: &[MeshConnectAttempt]) {
        let mut registry = self.registry.lock().expect("mesh registry lock");
        let mut last_failure: Option<String> = None;
        for attempt in attempts {
            registry.apply_endpoint_connect_result(
                profile_id,
                &attempt.endpoint_url,
                attempt.success,
                attempt.error.clone(),
            );
            if !attempt.success {
                last_failure = attempt
                    .error
                    .clone()
                    .or_else(|| Some("connect_failed".into()));
            }
        }
        drop(registry);
        if let Some(reason) = last_failure {
            let mut cache = self.cache.lock().expect("mesh cache lock");
            if let Some(entry) = cache.get_mut(profile_id) {
                entry.last_failure_reason = Some(reason);
            }
        }
    }

    pub fn get_snapshot(&self, profile_id: &str) -> MeshSnapshotJson {
        let registry = self.registry.lock().expect("mesh registry lock");
        let cache = self.cache.lock().expect("mesh cache lock");
        let entries = registry.entries(profile_id);
        let revision = registry.revision(profile_id);
        let empty = ProfileRuntimeCache::default();
        let profile_cache = cache.get(profile_id).unwrap_or(&empty);

        build_mesh_snapshot(BuildMeshSnapshotParams {
            profile_id,
            revision,
            entries: &entries,
            enabled_endpoint_urls: &profile_cache.active_endpoint_urls,
            active_conduit_ids: &profile_cache.active_conduit_ids,
            tor_blocked_ids: &profile_cache.tor_blocked_conduit_ids,
            mesh_scheduler_owns_failover: profile_cache.mesh_scheduler_owns_failover,
            last_failure_reason: profile_cache.last_failure_reason.clone(),
            updated_at_unix_ms: now_unix_ms(),
        })
    }

    pub fn active_endpoint_urls(&self, profile_id: &str) -> Vec<String> {
        self.cache
            .lock()
            .expect("mesh cache lock")
            .get(profile_id)
            .map(|c| c.active_endpoint_urls.clone())
            .unwrap_or_default()
    }

    /// Registry entries for publish trust ordering (RUST-3).
    pub fn registry_entries(
        &self,
        profile_id: &str,
    ) -> Vec<crate::mesh::registry::ConduitRegistryEntry> {
        self.registry
            .lock()
            .expect("mesh registry lock")
            .entries(profile_id)
    }

    #[allow(dead_code)] // reserved for TS dual-run gate (RUST-2)
    pub fn mesh_scheduler_owns_failover(&self, profile_id: &str) -> bool {
        self.cache
            .lock()
            .expect("mesh cache lock")
            .get(profile_id)
            .map(|c| c.mesh_scheduler_owns_failover)
            .unwrap_or(false)
    }
}

impl Default for MeshRuntimeState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::descriptor::{
        ConduitCapability, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
    };
    use crate::mesh::snapshot::MeshPhase;

    fn nostr(id: &str, priority: i32, url: &str) -> ConduitDescriptor {
        ConduitDescriptor {
            conduit_id: id.into(),
            dialect: ConduitDialect::NostrWs,
            endpoints: vec![url.into()],
            capabilities: vec![ConduitCapability::Publish],
            network_policy: ConduitNetworkPolicy::Clearnet,
            trust_tier: ConduitTrustTier::UserConfigured,
            enabled: true,
            priority,
            label: None,
            underlay: None,
            ssh_tunnel: None,
        }
    }

    #[test]
    fn configure_selects_padded_local_pool() {
        let runtime = MeshRuntimeState::new();
        let outcome = runtime.configure_and_select(
            "p1",
            vec![
                nostr("a", 10, "ws://127.0.0.1:7000"),
                nostr("b", 5, "ws://127.0.0.1:7001"),
                nostr("c", 1, "ws://127.0.0.1:7002"),
            ],
            MeshTorRuntimeState::OFF,
            Some(3),
        );
        assert!(outcome.ok);
        assert!(outcome.mesh_scheduler_owns_failover);
        assert_eq!(outcome.active_endpoint_urls.len(), 3);
        assert!(outcome.snapshot.is_some());
    }

    #[test]
    fn connect_success_moves_snapshot_healthy() {
        let runtime = MeshRuntimeState::new();
        runtime.configure_and_select(
            "p1",
            vec![nostr("local", 1, "ws://127.0.0.1:7000")],
            MeshTorRuntimeState::OFF,
            Some(1),
        );
        runtime.apply_connect_attempts(
            "p1",
            &[MeshConnectAttempt {
                endpoint_url: "ws://127.0.0.1:7000".into(),
                success: true,
                error: None,
            }],
        );
        let snap = runtime.get_snapshot("p1");
        assert_eq!(snap.phase, MeshPhase::Healthy);
        assert_eq!(snap.writable_conduit_count, 1);
        assert!(snap.mesh_scheduler_owns_failover);
    }

    #[test]
    fn custom_dialect_deferred_from_dial() {
        let runtime = MeshRuntimeState::new();
        let custom = ConduitDescriptor {
            conduit_id: "http-1".into(),
            dialect: ConduitDialect::Custom,
            endpoints: vec!["https://vps.example/mesh".into()],
            capabilities: vec![ConduitCapability::Publish],
            network_policy: ConduitNetworkPolicy::Clearnet,
            trust_tier: ConduitTrustTier::UserConfigured,
            enabled: true,
            priority: 100,
            label: None,
            underlay: None,
            ssh_tunnel: None,
        };
        let outcome = runtime.configure_and_select(
            "p1",
            vec![custom, nostr("local", 1, "ws://127.0.0.1:7000")],
            MeshTorRuntimeState::OFF,
            Some(3),
        );
        assert!(outcome
            .active_endpoint_urls
            .contains(&"ws://127.0.0.1:7000".to_string()));
        assert!(!outcome
            .active_endpoint_urls
            .iter()
            .any(|u| u.starts_with("https://")));
        assert!(outcome
            .skipped
            .iter()
            .any(|s| s.reason == "dialect_dial_deferred_rust_1b"));
    }
}
