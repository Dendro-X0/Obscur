//! Tor policy filter for mesh scheduler — R-RELAY-RUST-1b.

use super::descriptor::ConduitNetworkPolicy;
use super::registry::{ConduitRegistryEntry, ConduitRegistryHealth};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct MeshTorRuntimeState {
    pub configured: bool,
    pub ready: bool,
}

impl MeshTorRuntimeState {
    pub const OFF: Self = Self {
        configured: false,
        ready: false,
    };

    /// Used by unit tests and L3 product harnesses for a ready Tor runtime.
    #[cfg(test)]
    pub const READY: Self = Self {
        configured: true,
        ready: true,
    };
}

/// Viable vs tor-blocked entries (fail closed for tor_required when Tor not ready).
pub fn partition_by_tor_policy(
    entries: &[ConduitRegistryEntry],
    tor: MeshTorRuntimeState,
) -> (Vec<ConduitRegistryEntry>, Vec<ConduitRegistryEntry>) {
    let mut viable = Vec::new();
    let mut blocked = Vec::new();
    for entry in entries {
        if entry.health == ConduitRegistryHealth::Blocked {
            blocked.push(entry.clone());
            continue;
        }
        if !entry.descriptor.enabled {
            continue;
        }
        match entry.descriptor.network_policy {
            ConduitNetworkPolicy::TorRequired if !tor.ready => {
                blocked.push(entry.clone());
            }
            ConduitNetworkPolicy::Unknown => {
                blocked.push(entry.clone());
            }
            _ => viable.push(entry.clone()),
        }
    }
    (viable, blocked)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::descriptor::{
        ConduitCapability, ConduitDescriptor, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
        ConduitUnderlay,
    };
    use crate::mesh::registry::ConduitRegistryHealth;

    fn entry(id: &str, policy: ConduitNetworkPolicy) -> ConduitRegistryEntry {
        ConduitRegistryEntry {
            descriptor: ConduitDescriptor {
                conduit_id: id.into(),
                dialect: ConduitDialect::NostrWs,
                endpoints: vec![format!("ws://127.0.0.1/{id}")],
                capabilities: vec![ConduitCapability::Publish],
                network_policy: policy,
                trust_tier: ConduitTrustTier::UserConfigured,
                enabled: true,
                priority: 1,
                label: None,
                underlay: None,
                ssh_tunnel: None,
            },
            health: ConduitRegistryHealth::Unknown,
            last_failure_reason: None,
            resolved_underlay: ConduitUnderlay::Clearnet,
        }
    }

    #[test]
    fn tor_required_blocked_when_tor_not_ready() {
        let entries = vec![
            entry("clear", ConduitNetworkPolicy::Clearnet),
            entry("req", ConduitNetworkPolicy::TorRequired),
        ];
        let (viable, blocked) = partition_by_tor_policy(&entries, MeshTorRuntimeState::OFF);
        assert_eq!(viable.len(), 1);
        assert_eq!(viable[0].descriptor.conduit_id, "clear");
        assert_eq!(blocked.len(), 1);
        assert_eq!(blocked[0].descriptor.conduit_id, "req");
    }

    #[test]
    fn tor_required_viable_when_tor_ready() {
        let entries = vec![entry("req", ConduitNetworkPolicy::TorRequired)];
        let (viable, blocked) = partition_by_tor_policy(&entries, MeshTorRuntimeState::READY);
        assert_eq!(viable.len(), 1);
        assert!(blocked.is_empty());
    }
}
