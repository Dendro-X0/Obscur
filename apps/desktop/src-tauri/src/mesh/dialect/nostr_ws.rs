//! `nostr_ws` dialect — NIP-01 EVENT over existing RelayPool.

use super::{DialectId, DialectPort, DialectPublishAttempt, DialectPublishRequest, DialectPublishResult};
use crate::mesh::descriptor::ConduitTrustTier;
use crate::mesh::registry::ConduitRegistryEntry;
use crate::mesh::publish::resolve_mesh_publish_urls;
use crate::relay::RelayPool;
use std::collections::HashMap;
use std::time::Duration;
use tauri::State;

pub struct NostrWsDialect;

impl DialectPort for NostrWsDialect {
    fn id(&self) -> DialectId {
        DialectId::NostrWs
    }
}

impl NostrWsDialect {
    pub fn new() -> Self {
        Self
    }

    /// Order mesh-active URLs: private trust first, then public_untrusted.
    pub fn order_publish_urls(
        mesh_active_urls: &[String],
        entries: &[ConduitRegistryEntry],
        requested_urls: Option<&[String]>,
    ) -> Result<Vec<String>, String> {
        let resolved = resolve_mesh_publish_urls(mesh_active_urls, requested_urls)?;
        let trust_by_url: HashMap<&str, ConduitTrustTier> = entries
            .iter()
            .flat_map(|entry| {
                entry.descriptor.endpoints.iter().filter_map(|url| {
                    let trimmed = url.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some((trimmed, entry.descriptor.trust_tier.clone()))
                    }
                })
            })
            .collect();

        let mut private = Vec::new();
        let mut public = Vec::new();
        let mut other = Vec::new();
        for url in resolved {
            match trust_by_url.get(url.as_str()) {
                Some(ConduitTrustTier::PublicUntrusted) => public.push(url),
                Some(ConduitTrustTier::UserConfigured)
                | Some(ConduitTrustTier::OperatorAttested) => private.push(url),
                _ => other.push(url),
            }
        }
        private.extend(other);
        private.extend(public);
        Ok(private)
    }

    pub async fn publish_via_pool(
        &self,
        pool: &State<'_, RelayPool>,
        window_label: &str,
        request: DialectPublishRequest,
        ack_timeout: Duration,
    ) -> DialectPublishResult {
        let mut attempts = Vec::with_capacity(request.relay_urls.len());
        for relay_url in &request.relay_urls {
            match pool
                .publish_event_with_ack(
                    window_label,
                    relay_url,
                    request.event.clone(),
                    ack_timeout,
                )
                .await
            {
                Ok(_) => attempts.push(DialectPublishAttempt {
                    relay_url: relay_url.clone(),
                    success: true,
                    error: None,
                }),
                Err(error) => attempts.push(DialectPublishAttempt {
                    relay_url: relay_url.clone(),
                    success: false,
                    error: Some(error),
                }),
            }
        }
        DialectPublishResult { attempts }
    }
}

impl Default for NostrWsDialect {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::descriptor::{
        ConduitCapability, ConduitDescriptor, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
        ConduitUnderlay,
    };
    use crate::mesh::registry::{ConduitRegistryEntry, ConduitRegistryHealth};

    fn entry(id: &str, url: &str, trust: ConduitTrustTier) -> ConduitRegistryEntry {
        ConduitRegistryEntry {
            descriptor: ConduitDescriptor {
                conduit_id: id.into(),
                dialect: ConduitDialect::NostrWs,
                endpoints: vec![url.into()],
                capabilities: vec![ConduitCapability::Publish],
                network_policy: ConduitNetworkPolicy::Clearnet,
                trust_tier: trust,
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
    fn prefers_private_urls_before_public_untrusted() {
        let local = "ws://127.0.0.1:7000";
        let damus = "wss://relay.damus.io";
        let entries = vec![
            entry("pub", damus, ConduitTrustTier::PublicUntrusted),
            entry("priv", local, ConduitTrustTier::UserConfigured),
        ];
        let active = vec![damus.to_string(), local.to_string()];
        let ordered = NostrWsDialect::order_publish_urls(&active, &entries, None).unwrap();
        assert_eq!(ordered, vec![local.to_string(), damus.to_string()]);
    }

    #[test]
    fn still_rejects_urls_outside_mesh_active_set() {
        let local = "ws://127.0.0.1:7000";
        let entries = vec![entry("priv", local, ConduitTrustTier::UserConfigured)];
        let active = vec![local.to_string()];
        let err = NostrWsDialect::order_publish_urls(
            &active,
            &entries,
            Some(&["wss://nos.lol".to_string()]),
        )
        .unwrap_err();
        assert!(err.contains("not_in_mesh_active_set"));
    }

    #[test]
    fn dialect_id_is_nostr_ws() {
        assert_eq!(NostrWsDialect::new().id(), DialectId::NostrWs);
    }
}
