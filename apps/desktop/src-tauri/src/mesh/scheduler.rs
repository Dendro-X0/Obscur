//! Active-set scheduler — absorbs R-RELAY-1 pad intent into Rust (RUST-1b).

use super::registry::{ConduitRegistryEntry, ConduitRegistryHealth};
use super::tor_policy::{partition_by_tor_policy, MeshTorRuntimeState};
use std::collections::HashSet;

pub const DEFAULT_MAX_REDUNDANCY: usize = 3;

#[derive(Debug, Clone)]
pub struct SchedulerHints {
    pub tor: MeshTorRuntimeState,
    pub max_redundancy: usize,
    /// Conduit ids with open circuit — excluded from active set.
    pub circuit_open_conduit_ids: HashSet<String>,
    /// Prefer these (writable/healthy) when filling the active set first.
    pub preferred_conduit_ids: HashSet<String>,
}

impl Default for SchedulerHints {
    fn default() -> Self {
        Self {
            tor: MeshTorRuntimeState::OFF,
            max_redundancy: DEFAULT_MAX_REDUNDANCY,
            circuit_open_conduit_ids: HashSet::new(),
            preferred_conduit_ids: HashSet::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveSetSelection {
    pub conduit_ids: Vec<String>,
    pub endpoint_urls: Vec<String>,
    pub tor_blocked_conduit_ids: Vec<String>,
}

/// Select up to `max_redundancy` conduits: prefer preferred/healthy, then pad with remaining.
pub fn select_active_set(
    entries: &[ConduitRegistryEntry],
    hints: &SchedulerHints,
) -> ActiveSetSelection {
    let (viable, tor_blocked) = partition_by_tor_policy(entries, hints.tor);
    let tor_blocked_conduit_ids: Vec<String> = tor_blocked
        .iter()
        .map(|e| e.descriptor.conduit_id.clone())
        .collect();

    let mut candidates: Vec<&ConduitRegistryEntry> = viable
        .iter()
        .filter(|e| !hints.circuit_open_conduit_ids.contains(&e.descriptor.conduit_id))
        .filter(|e| e.health != ConduitRegistryHealth::Blocked)
        .collect();

    // priority desc, then stable list order (original index)
    candidates.sort_by(|a, b| {
        b.descriptor
            .priority
            .cmp(&a.descriptor.priority)
            .then_with(|| {
                let ai = entries
                    .iter()
                    .position(|e| e.descriptor.conduit_id == a.descriptor.conduit_id)
                    .unwrap_or(0);
                let bi = entries
                    .iter()
                    .position(|e| e.descriptor.conduit_id == b.descriptor.conduit_id)
                    .unwrap_or(0);
                ai.cmp(&bi)
            })
    });

    let max = hints.max_redundancy.max(1);
    let mut selected: Vec<&ConduitRegistryEntry> = Vec::new();

    // Prefer preferred / healthy first
    for entry in &candidates {
        if selected.len() >= max {
            break;
        }
        let preferred = hints
            .preferred_conduit_ids
            .contains(&entry.descriptor.conduit_id)
            || matches!(
                entry.health,
                ConduitRegistryHealth::Healthy | ConduitRegistryHealth::Degraded
            );
        if preferred {
            selected.push(entry);
        }
    }
    // Pad with remaining (cold standbys) — R-RELAY-1 intent
    for entry in &candidates {
        if selected.len() >= max {
            break;
        }
        if selected
            .iter()
            .any(|s| s.descriptor.conduit_id == entry.descriptor.conduit_id)
        {
            continue;
        }
        selected.push(entry);
    }

    let mut conduit_ids = Vec::new();
    let mut endpoint_urls = Vec::new();
    let mut seen_urls = HashSet::new();
    for entry in selected {
        conduit_ids.push(entry.descriptor.conduit_id.clone());
        for url in &entry.descriptor.endpoints {
            let trimmed = url.trim();
            if trimmed.is_empty() {
                continue;
            }
            if seen_urls.insert(trimmed.to_string()) {
                endpoint_urls.push(trimmed.to_string());
            }
        }
    }

    ActiveSetSelection {
        conduit_ids,
        endpoint_urls,
        tor_blocked_conduit_ids,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::descriptor::{
        ConduitCapability, ConduitDescriptor, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
        ConduitUnderlay,
    };

    fn entry(id: &str, priority: i32, endpoint: &str) -> ConduitRegistryEntry {
        ConduitRegistryEntry {
            descriptor: ConduitDescriptor {
                conduit_id: id.into(),
                dialect: ConduitDialect::NostrWs,
                endpoints: vec![endpoint.into()],
                capabilities: vec![ConduitCapability::Publish],
                network_policy: ConduitNetworkPolicy::Clearnet,
                trust_tier: ConduitTrustTier::UserConfigured,
                enabled: true,
                priority,
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
    fn pads_cold_standbys_up_to_max_redundancy() {
        let entries = vec![
            entry("a", 10, "ws://127.0.0.1:7000"),
            entry("b", 5, "ws://127.0.0.1:7001"),
            entry("c", 1, "ws://127.0.0.1:7002"),
            entry("d", 0, "ws://127.0.0.1:7003"),
        ];
        let selection = select_active_set(
            &entries,
            &SchedulerHints {
                max_redundancy: 3,
                ..SchedulerHints::default()
            },
        );
        assert_eq!(selection.conduit_ids, vec!["a", "b", "c"]);
        assert_eq!(selection.endpoint_urls.len(), 3);
    }

    #[test]
    fn skips_circuit_open() {
        let entries = vec![
            entry("a", 10, "ws://127.0.0.1:7000"),
            entry("b", 5, "ws://127.0.0.1:7001"),
        ];
        let mut hints = SchedulerHints {
            max_redundancy: 3,
            ..SchedulerHints::default()
        };
        hints.circuit_open_conduit_ids.insert("a".into());
        let selection = select_active_set(&entries, &hints);
        assert_eq!(selection.conduit_ids, vec!["b"]);
    }

    #[test]
    fn prefers_writable_then_pads() {
        let mut entries = vec![
            entry("cold-high", 100, "ws://127.0.0.1:1"),
            entry("warm", 1, "ws://127.0.0.1:2"),
            entry("cold-low", 0, "ws://127.0.0.1:3"),
        ];
        entries[1].health = ConduitRegistryHealth::Healthy;
        let mut hints = SchedulerHints {
            max_redundancy: 2,
            ..SchedulerHints::default()
        };
        hints.preferred_conduit_ids.insert("warm".into());
        let selection = select_active_set(&entries, &hints);
        assert_eq!(selection.conduit_ids[0], "warm");
        assert_eq!(selection.conduit_ids.len(), 2);
        assert!(selection.conduit_ids.contains(&"cold-high".to_string()));
    }
}
