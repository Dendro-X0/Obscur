//! Mesh snapshot JSON — R-RELAY-RUST-1c (maps to TransportSnapshot on TS).

use super::registry::{ConduitRegistryEntry, ConduitRegistryHealth};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeshPhase {
    Booting,
    Connecting,
    Healthy,
    Degraded,
    Recovering,
    Offline,
    Fatal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeshReadiness {
    Healthy,
    Degraded,
    Recovering,
    Offline,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshConduitSnapshot {
    pub conduit_id: String,
    pub dialect: String,
    pub endpoints: Vec<String>,
    pub health: String,
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_failure_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshSnapshotJson {
    pub profile_id: String,
    pub revision: u64,
    pub phase: MeshPhase,
    pub readiness: MeshReadiness,
    pub enabled_endpoint_urls: Vec<String>,
    pub active_conduit_ids: Vec<String>,
    pub writable_conduit_count: u32,
    pub subscribable_conduit_count: u32,
    pub blocked_conduit_count: u32,
    pub pending_outbound_count: u32,
    pub mesh_scheduler_owns_failover: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_failure_reason: Option<String>,
    pub conduits: Vec<MeshConduitSnapshot>,
    pub updated_at_unix_ms: u64,
}

fn dialect_label(entry: &ConduitRegistryEntry) -> String {
    use crate::mesh::descriptor::ConduitDialect;
    match entry.descriptor.dialect {
        ConduitDialect::TeamRelay => "team_relay",
        ConduitDialect::CoordinationHttp => "coordination_http",
        ConduitDialect::CoordinationSse => "coordination_sse",
        ConduitDialect::NostrWs => "nostr_ws",
        ConduitDialect::Custom => "custom",
        ConduitDialect::LanMdns => "lan_mdns",
        ConduitDialect::StoreForward => "store_forward",
        ConduitDialect::Unknown => "unknown",
    }
    .to_string()
}

fn health_label(health: &ConduitRegistryHealth) -> &'static str {
    match health {
        ConduitRegistryHealth::Unknown => "unknown",
        ConduitRegistryHealth::Healthy => "healthy",
        ConduitRegistryHealth::Degraded => "degraded",
        ConduitRegistryHealth::Blocked => "blocked",
        ConduitRegistryHealth::Offline => "offline",
    }
}

pub fn build_mesh_snapshot(params: BuildMeshSnapshotParams<'_>) -> MeshSnapshotJson {
    let conduits: Vec<MeshConduitSnapshot> = params
        .entries
        .iter()
        .map(|entry| MeshConduitSnapshot {
            conduit_id: entry.descriptor.conduit_id.clone(),
            dialect: dialect_label(entry),
            endpoints: entry.descriptor.endpoints.clone(),
            health: health_label(&entry.health).to_string(),
            enabled: entry.descriptor.enabled,
            last_failure_reason: entry.last_failure_reason.clone(),
        })
        .collect();

    let writable = params
        .entries
        .iter()
        .filter(|e| {
            e.descriptor.enabled
                && matches!(
                    e.health,
                    ConduitRegistryHealth::Healthy | ConduitRegistryHealth::Degraded
                )
        })
        .count() as u32;

    let blocked = params
        .entries
        .iter()
        .filter(|e| {
            matches!(
                e.health,
                ConduitRegistryHealth::Blocked | ConduitRegistryHealth::Offline
            )
        })
        .count() as u32;

    let has_unknown_connecting = params.entries.iter().any(|e| {
        e.descriptor.enabled && e.health == ConduitRegistryHealth::Unknown
    });

    let (phase, readiness) = if writable > 0 && blocked == 0 && !has_unknown_connecting {
        (MeshPhase::Healthy, MeshReadiness::Healthy)
    } else if writable > 0 {
        (MeshPhase::Degraded, MeshReadiness::Degraded)
    } else if has_unknown_connecting && !params.enabled_endpoint_urls.is_empty() {
        (MeshPhase::Connecting, MeshReadiness::Recovering)
    } else if !params.tor_blocked_ids.is_empty() && params.enabled_endpoint_urls.is_empty() {
        (MeshPhase::Offline, MeshReadiness::Offline)
    } else if params.entries.is_empty() {
        (MeshPhase::Booting, MeshReadiness::Offline)
    } else {
        (MeshPhase::Offline, MeshReadiness::Offline)
    };

    let last_failure_reason = params.last_failure_reason.clone().or_else(|| {
        if !params.tor_blocked_ids.is_empty() && writable == 0 {
            Some("tor_unreachable".into())
        } else if writable == 0 && !params.enabled_endpoint_urls.is_empty() {
            Some("no_writable_conduits".into())
        } else if params.entries.is_empty() {
            Some("no_viable_conduit".into())
        } else {
            None
        }
    });

    MeshSnapshotJson {
        profile_id: params.profile_id.to_string(),
        revision: params.revision,
        phase,
        readiness,
        enabled_endpoint_urls: params.enabled_endpoint_urls.to_vec(),
        active_conduit_ids: params.active_conduit_ids.to_vec(),
        writable_conduit_count: writable,
        subscribable_conduit_count: writable,
        blocked_conduit_count: blocked,
        pending_outbound_count: 0,
        mesh_scheduler_owns_failover: params.mesh_scheduler_owns_failover,
        last_failure_reason,
        conduits,
        updated_at_unix_ms: params.updated_at_unix_ms,
    }
}

pub struct BuildMeshSnapshotParams<'a> {
    pub profile_id: &'a str,
    pub revision: u64,
    pub entries: &'a [ConduitRegistryEntry],
    pub enabled_endpoint_urls: &'a [String],
    pub active_conduit_ids: &'a [String],
    pub tor_blocked_ids: &'a [String],
    pub mesh_scheduler_owns_failover: bool,
    pub last_failure_reason: Option<String>,
    pub updated_at_unix_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::descriptor::{
        ConduitCapability, ConduitDescriptor, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
        ConduitUnderlay,
    };

    fn healthy_local() -> ConduitRegistryEntry {
        ConduitRegistryEntry {
            descriptor: ConduitDescriptor {
                conduit_id: "local".into(),
                dialect: ConduitDialect::NostrWs,
                endpoints: vec!["ws://127.0.0.1:7000".into()],
                capabilities: vec![ConduitCapability::Publish],
                network_policy: ConduitNetworkPolicy::Clearnet,
                trust_tier: ConduitTrustTier::UserConfigured,
                enabled: true,
                priority: 1,
                label: None,
                underlay: None,
                ssh_tunnel: None,
            },
            health: ConduitRegistryHealth::Healthy,
            last_failure_reason: None,
            resolved_underlay: ConduitUnderlay::Clearnet,
        }
    }

    #[test]
    fn healthy_snapshot_maps_phase() {
        let entry = healthy_local();
        let urls = vec!["ws://127.0.0.1:7000".to_string()];
        let ids = vec!["local".to_string()];
        let snap = build_mesh_snapshot(BuildMeshSnapshotParams {
            profile_id: "p1",
            revision: 2,
            entries: &[entry],
            enabled_endpoint_urls: &urls,
            active_conduit_ids: &ids,
            tor_blocked_ids: &[],
            mesh_scheduler_owns_failover: true,
            last_failure_reason: None,
            updated_at_unix_ms: 1,
        });
        assert_eq!(snap.phase, MeshPhase::Healthy);
        assert_eq!(snap.writable_conduit_count, 1);
        assert!(snap.mesh_scheduler_owns_failover);
        let json = serde_json::to_string(&snap).unwrap();
        assert!(json.contains("\"profileId\""));
        assert!(json.contains("\"enabledEndpointUrls\""));
    }
}
