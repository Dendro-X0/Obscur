//! In-memory conduit registry — R-RELAY-RUST-1a (no live dial).

use super::descriptor::{ConduitDescriptor, ConduitUnderlay};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConduitRegistryHealth {
    Unknown,
    Healthy,
    Degraded,
    Blocked,
    Offline,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConduitRegistryEntry {
    pub descriptor: ConduitDescriptor,
    pub health: ConduitRegistryHealth,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_failure_reason: Option<String>,
    pub resolved_underlay: ConduitUnderlay,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureMeshResult {
    pub ok: bool,
    pub revision: u64,
    pub accepted_conduit_ids: Vec<String>,
    pub skipped: Vec<SkippedConduit>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedConduit {
    pub conduit_id: String,
    pub reason: String,
}

#[derive(Debug, Default)]
pub struct ConduitRegistry {
    /// Keyed by profileId (explicit — no ambient current-user).
    profiles: HashMap<String, ProfileMeshState>,
}

#[derive(Debug, Default)]
struct ProfileMeshState {
    revision: u64,
    entries: HashMap<String, ConduitRegistryEntry>,
}

impl ConduitRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Replace conduits for a profile. Soft-skips unknown/empty; marks SSH unsupported as blocked.
    pub fn configure(
        &mut self,
        profile_id: &str,
        conduits: Vec<ConduitDescriptor>,
    ) -> ConfigureMeshResult {
        let state = self.profiles.entry(profile_id.to_string()).or_default();
        state.revision = state.revision.saturating_add(1);
        state.entries.clear();

        let mut accepted = Vec::new();
        let mut skipped = Vec::new();

        for descriptor in conduits {
            let conduit_id = descriptor.conduit_id.clone();
            if !descriptor.is_configurable() {
                skipped.push(SkippedConduit {
                    conduit_id,
                    reason: "not_configurable".into(),
                });
                continue;
            }
            if let Some(reason) = descriptor.ssh_configure_skip_reason() {
                skipped.push(SkippedConduit {
                    conduit_id,
                    reason: reason.into(),
                });
                continue;
            }

            let resolved_underlay = descriptor.resolved_underlay();
            let (health, last_failure_reason) = if !descriptor.is_underlay_supported() {
                (
                    ConduitRegistryHealth::Blocked,
                    Some("underlay_unsupported".into()),
                )
            } else {
                (ConduitRegistryHealth::Unknown, None)
            };

            if health == ConduitRegistryHealth::Blocked {
                // Still register so snapshot can show blocked SSH/reserved lanes.
                state.entries.insert(
                    conduit_id.clone(),
                    ConduitRegistryEntry {
                        descriptor,
                        health,
                        last_failure_reason,
                        resolved_underlay,
                    },
                );
                accepted.push(conduit_id);
                continue;
            }

            state.entries.insert(
                conduit_id.clone(),
                ConduitRegistryEntry {
                    descriptor,
                    health,
                    last_failure_reason,
                    resolved_underlay,
                },
            );
            accepted.push(conduit_id);
        }

        ConfigureMeshResult {
            ok: true,
            revision: state.revision,
            accepted_conduit_ids: accepted,
            skipped,
        }
    }

    pub fn revision(&self, profile_id: &str) -> u64 {
        self.profiles
            .get(profile_id)
            .map(|s| s.revision)
            .unwrap_or(0)
    }

    pub fn entries(&self, profile_id: &str) -> Vec<ConduitRegistryEntry> {
        self.profiles
            .get(profile_id)
            .map(|s| s.entries.values().cloned().collect())
            .unwrap_or_default()
    }

    #[allow(dead_code)] // registry query helper; covered by unit tests, not yet wired to commands
    pub fn enabled_endpoints(&self, profile_id: &str) -> Vec<String> {
        self.entries(profile_id)
            .into_iter()
            .filter(|e| e.descriptor.enabled)
            .filter(|e| e.health != ConduitRegistryHealth::Blocked)
            .flat_map(|e| e.descriptor.endpoints)
            .filter(|u| !u.trim().is_empty())
            .collect()
    }

    /// Update health for conduits that expose the given endpoint URL.
    pub fn apply_endpoint_connect_result(
        &mut self,
        profile_id: &str,
        endpoint_url: &str,
        success: bool,
        error: Option<String>,
    ) {
        let Some(state) = self.profiles.get_mut(profile_id) else {
            return;
        };
        let trimmed = endpoint_url.trim();
        for entry in state.entries.values_mut() {
            if !entry
                .descriptor
                .endpoints
                .iter()
                .any(|u| u.trim() == trimmed)
            {
                continue;
            }
            if entry.health == ConduitRegistryHealth::Blocked {
                continue;
            }
            if success {
                entry.health = ConduitRegistryHealth::Healthy;
                entry.last_failure_reason = None;
            } else {
                entry.health = ConduitRegistryHealth::Offline;
                entry.last_failure_reason =
                    Some(error.clone().unwrap_or_else(|| "connect_failed".into()));
            }
        }
    }

    pub fn mark_tor_blocked(&mut self, profile_id: &str, conduit_ids: &[String]) {
        let Some(state) = self.profiles.get_mut(profile_id) else {
            return;
        };
        for id in conduit_ids {
            if let Some(entry) = state.entries.get_mut(id) {
                if entry.last_failure_reason.as_deref() == Some("underlay_unsupported") {
                    continue;
                }
                entry.health = ConduitRegistryHealth::Blocked;
                entry.last_failure_reason = Some("tor_unreachable".into());
            }
        }
    }

    /// Mark SSH (or other) underlay failure — fail closed, never silent clearnet.
    pub fn mark_underlay_failed(
        &mut self,
        profile_id: &str,
        conduit_id: &str,
        reason: &str,
    ) {
        let Some(state) = self.profiles.get_mut(profile_id) else {
            return;
        };
        if let Some(entry) = state.entries.get_mut(conduit_id) {
            entry.health = ConduitRegistryHealth::Blocked;
            entry.last_failure_reason = Some(reason.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::descriptor::{
        ConduitCapability, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier, ConduitUnderlay,
    };

    fn desc(id: &str, endpoint: &str) -> ConduitDescriptor {
        ConduitDescriptor {
            conduit_id: id.into(),
            dialect: ConduitDialect::NostrWs,
            endpoints: vec![endpoint.into()],
            capabilities: vec![ConduitCapability::Publish],
            network_policy: ConduitNetworkPolicy::Clearnet,
            trust_tier: ConduitTrustTier::UserConfigured,
            enabled: true,
            priority: 1,
            label: None,
            underlay: None,
            ssh_tunnel: None,
        }
    }

    #[test]
    fn configure_accepts_local_and_skips_unknown_dialect() {
        let mut registry = ConduitRegistry::new();
        let mut unknown = desc("bad", "ws://127.0.0.1:1");
        unknown.dialect = ConduitDialect::Unknown;

        let result = registry.configure(
            "profile-a",
            vec![desc("local", "ws://127.0.0.1:7000"), unknown],
        );
        assert!(result.ok);
        assert_eq!(result.revision, 1);
        assert_eq!(result.accepted_conduit_ids, vec!["local".to_string()]);
        assert_eq!(result.skipped.len(), 1);
        assert_eq!(result.skipped[0].reason, "not_configurable");
        assert_eq!(
            registry.enabled_endpoints("profile-a"),
            vec!["ws://127.0.0.1:7000".to_string()]
        );
    }

    #[test]
    fn configure_is_profile_scoped() {
        let mut registry = ConduitRegistry::new();
        registry.configure("p1", vec![desc("a", "ws://127.0.0.1:7000")]);
        registry.configure("p2", vec![desc("b", "ws://127.0.0.1:7001")]);
        assert_eq!(registry.enabled_endpoints("p1"), vec!["ws://127.0.0.1:7000"]);
        assert_eq!(registry.enabled_endpoints("p2"), vec!["ws://127.0.0.1:7001"]);
        assert!(registry.enabled_endpoints("p3").is_empty());
    }

    #[test]
    fn ssh_with_valid_params_enters_enabled_endpoints() {
        use crate::mesh::descriptor::SshTunnelParams;
        let mut registry = ConduitRegistry::new();
        let mut ssh = desc("ssh-1", "ws://127.0.0.1:9000");
        ssh.underlay = Some(ConduitUnderlay::SshTunnel);
        ssh.ssh_tunnel = Some(SshTunnelParams {
            bastion_host: "bastion.example".into(),
            bastion_port: 22,
            bastion_user: "ops".into(),
            remote_host: "127.0.0.1".into(),
            remote_port: 7000,
            local_bind_host: "127.0.0.1".into(),
            local_bind_port: 9000,
            identity_file: None,
        });
        let result = registry.configure("p1", vec![ssh]);
        assert!(result.accepted_conduit_ids.contains(&"ssh-1".into()));
        let entries = registry.entries("p1");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].health, ConduitRegistryHealth::Unknown);
        assert_eq!(
            registry.enabled_endpoints("p1"),
            vec!["ws://127.0.0.1:9000".to_string()]
        );
    }

    #[test]
    fn mark_underlay_failed_blocks_endpoint() {
        use crate::mesh::descriptor::SshTunnelParams;
        let mut registry = ConduitRegistry::new();
        let mut ssh = desc("ssh-1", "ws://127.0.0.1:9000");
        ssh.underlay = Some(ConduitUnderlay::SshTunnel);
        ssh.ssh_tunnel = Some(SshTunnelParams {
            bastion_host: "bastion.example".into(),
            bastion_port: 22,
            bastion_user: "ops".into(),
            remote_host: "127.0.0.1".into(),
            remote_port: 7000,
            local_bind_host: "127.0.0.1".into(),
            local_bind_port: 9000,
            identity_file: None,
        });
        registry.configure("p1", vec![ssh]);
        registry.mark_underlay_failed("p1", "ssh-1", "ssh_binary_missing");
        assert!(registry.enabled_endpoints("p1").is_empty());
        assert_eq!(
            registry.entries("p1")[0].last_failure_reason.as_deref(),
            Some("ssh_binary_missing")
        );
    }

    #[test]
    fn ssh_endpoint_mismatch_is_skipped() {
        use crate::mesh::descriptor::SshTunnelParams;
        let mut registry = ConduitRegistry::new();
        let mut ssh = desc("ssh-bad", "ws://127.0.0.1:7000");
        ssh.underlay = Some(ConduitUnderlay::SshTunnel);
        ssh.ssh_tunnel = Some(SshTunnelParams {
            bastion_host: "bastion.example".into(),
            bastion_port: 22,
            bastion_user: "ops".into(),
            remote_host: "127.0.0.1".into(),
            remote_port: 7000,
            local_bind_host: "127.0.0.1".into(),
            local_bind_port: 19001,
            identity_file: None,
        });
        let result = registry.configure("p1", vec![ssh]);
        assert!(result.accepted_conduit_ids.is_empty());
        assert_eq!(result.skipped.len(), 1);
        assert_eq!(result.skipped[0].reason, "ssh_endpoint_mismatch");
    }

    #[test]
    fn configure_result_json_round_trip() {
        let mut registry = ConduitRegistry::new();
        let result = registry.configure("p1", vec![desc("local", "ws://127.0.0.1:7000")]);
        let json = serde_json::to_string(&result).unwrap();
        let parsed: ConfigureMeshResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, result);
    }
}
