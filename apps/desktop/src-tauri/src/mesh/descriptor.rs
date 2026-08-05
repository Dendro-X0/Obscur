//! Conduit mesh types — R-RELAY-RUST-1a · RUST-5a `sshTunnel` params.
//! Mirrors `@obscur/conduit-mesh-contracts` ConduitDescriptor (+ optional underlay).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConduitDialect {
    TeamRelay,
    CoordinationHttp,
    CoordinationSse,
    NostrWs,
    Custom,
    LanMdns,
    StoreForward,
    /// Unknown dialect from newer clients — soft-fail, do not panic.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConduitNetworkPolicy {
    Clearnet,
    TorPreferred,
    TorRequired,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConduitTrustTier {
    OperatorAttested,
    UserConfigured,
    PublicUntrusted,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConduitCapability {
    Publish,
    Subscribe,
    Pull,
    Push,
    StoreForward,
    #[serde(other)]
    Unknown,
}

/// Reachability layer — dialect vs underlay split (charter).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConduitUnderlay {
    Clearnet,
    TorSocks,
    /// RUST-5 — local-forward underlay; dialing gated until adapter (5b).
    SshTunnel,
    #[serde(other)]
    Unknown,
}

/// Bastion local-forward params — dialect dials `endpoints` (loopback) after tunnel up.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTunnelParams {
    pub bastion_host: String,
    #[serde(default = "default_bastion_port")]
    pub bastion_port: u16,
    pub bastion_user: String,
    pub remote_host: String,
    pub remote_port: u16,
    #[serde(default = "default_local_bind_host")]
    pub local_bind_host: String,
    pub local_bind_port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_file: Option<String>,
}

fn default_bastion_port() -> u16 {
    22
}

fn default_local_bind_host() -> String {
    "127.0.0.1".into()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConduitDescriptor {
    pub conduit_id: String,
    pub dialect: ConduitDialect,
    pub endpoints: Vec<String>,
    pub capabilities: Vec<ConduitCapability>,
    pub network_policy: ConduitNetworkPolicy,
    pub trust_tier: ConduitTrustTier,
    pub enabled: bool,
    pub priority: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Optional. When absent, derive from `network_policy` (see `resolved_underlay`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub underlay: Option<ConduitUnderlay>,
    /// Required when `underlay` is `ssh_tunnel` (RUST-5a).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_tunnel: Option<SshTunnelParams>,
}

impl ConduitDescriptor {
    /// Resolve underlay for dial planning (no live network).
    pub fn resolved_underlay(&self) -> ConduitUnderlay {
        if let Some(ref underlay) = self.underlay {
            return underlay.clone();
        }
        match self.network_policy {
            ConduitNetworkPolicy::TorRequired | ConduitNetworkPolicy::TorPreferred => {
                ConduitUnderlay::TorSocks
            }
            ConduitNetworkPolicy::Clearnet | ConduitNetworkPolicy::Unknown => {
                ConduitUnderlay::Clearnet
            }
        }
    }

    /// Soft-fail gate: unknown dialect/underlay or empty endpoints → skip.
    pub fn is_configurable(&self) -> bool {
        if matches!(self.dialect, ConduitDialect::Unknown) {
            return false;
        }
        if matches!(self.resolved_underlay(), ConduitUnderlay::Unknown) {
            return false;
        }
        self.endpoints.iter().any(|e| !e.trim().is_empty())
    }

    /// Clearnet/Tor always; SSH when params valid (RUST-5b adapter present in this binary).
    pub fn is_underlay_supported(&self) -> bool {
        match self.resolved_underlay() {
            ConduitUnderlay::Unknown => false,
            ConduitUnderlay::SshTunnel => self
                .ssh_tunnel
                .as_ref()
                .map(SshTunnelParams::is_valid)
                .unwrap_or(false),
            ConduitUnderlay::Clearnet | ConduitUnderlay::TorSocks => true,
        }
    }

    /// Soft-skip reason for SSH configure before registry accept (RUST-5a).
    pub fn ssh_configure_skip_reason(&self) -> Option<&'static str> {
        if !matches!(self.resolved_underlay(), ConduitUnderlay::SshTunnel) {
            return None;
        }
        let Some(params) = self.ssh_tunnel.as_ref() else {
            return Some("ssh_params_missing");
        };
        if !params.is_valid() {
            return Some("ssh_params_missing");
        }
        if !self.endpoints_match_ssh_local_bind(params) {
            return Some("ssh_endpoint_mismatch");
        }
        None
    }

    fn endpoints_match_ssh_local_bind(&self, params: &SshTunnelParams) -> bool {
        let Some(endpoint) = self.endpoints.iter().find(|e| !e.trim().is_empty()) else {
            return false;
        };
        let Ok(parsed) = url::Url::parse(endpoint.trim()) else {
            return false;
        };
        let host = parsed.host_str().unwrap_or("");
        let port = parsed.port_or_known_default().unwrap_or(0);
        let bind_host = params.local_bind_host.trim();
        let host_ok = host == bind_host
            || (is_loopback_host(host) && is_loopback_host(bind_host));
        host_ok && port == params.local_bind_port
    }
}

impl SshTunnelParams {
    pub fn is_valid(&self) -> bool {
        !self.bastion_host.trim().is_empty()
            && !self.bastion_user.trim().is_empty()
            && !self.remote_host.trim().is_empty()
            && self.remote_port > 0
            && !self.local_bind_host.trim().is_empty()
            && self.local_bind_port > 0
    }
}

fn is_loopback_host(host: &str) -> bool {
    matches!(host, "127.0.0.1" | "localhost" | "::1")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local_dev_descriptor() -> ConduitDescriptor {
        ConduitDescriptor {
            conduit_id: "local-dev-1".into(),
            dialect: ConduitDialect::NostrWs,
            endpoints: vec!["ws://127.0.0.1:7000".into()],
            capabilities: vec![ConduitCapability::Publish, ConduitCapability::Subscribe],
            network_policy: ConduitNetworkPolicy::Clearnet,
            trust_tier: ConduitTrustTier::UserConfigured,
            enabled: true,
            priority: 10,
            label: Some("Local mesh".into()),
            underlay: None,
            ssh_tunnel: None,
        }
    }

    fn sample_ssh_params() -> SshTunnelParams {
        SshTunnelParams {
            bastion_host: "bastion.example".into(),
            bastion_port: 22,
            bastion_user: "ops".into(),
            remote_host: "127.0.0.1".into(),
            remote_port: 7000,
            local_bind_host: "127.0.0.1".into(),
            local_bind_port: 19001,
            identity_file: None,
        }
    }

    #[test]
    fn descriptor_json_round_trip_camel_case() {
        let original = local_dev_descriptor();
        let json = serde_json::to_string(&original).expect("serialize");
        assert!(json.contains("\"conduitId\""));
        assert!(json.contains("\"networkPolicy\""));
        assert!(json.contains("\"trustTier\""));
        assert!(json.contains("\"nostr_ws\""));
        let parsed: ConduitDescriptor = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed, original);
        assert_eq!(parsed.resolved_underlay(), ConduitUnderlay::Clearnet);
    }

    #[test]
    fn ts_shaped_json_deserializes() {
        let raw = r#"{
            "conduitId": "vps-1",
            "dialect": "custom",
            "endpoints": ["https://relay.example.internal"],
            "capabilities": ["publish", "pull"],
            "networkPolicy": "tor_required",
            "trustTier": "operator_attested",
            "enabled": true,
            "priority": 5,
            "label": "VPS",
            "underlay": "tor_socks"
        }"#;
        let d: ConduitDescriptor = serde_json::from_str(raw).expect("ts json");
        assert_eq!(d.conduit_id, "vps-1");
        assert_eq!(d.dialect, ConduitDialect::Custom);
        assert_eq!(d.network_policy, ConduitNetworkPolicy::TorRequired);
        assert_eq!(d.resolved_underlay(), ConduitUnderlay::TorSocks);
        assert!(d.is_configurable());
        assert!(d.is_underlay_supported());
    }

    #[test]
    fn tor_preferred_defaults_underlay_to_socks() {
        let mut d = local_dev_descriptor();
        d.network_policy = ConduitNetworkPolicy::TorPreferred;
        assert_eq!(d.resolved_underlay(), ConduitUnderlay::TorSocks);
    }

    #[test]
    fn ssh_underlay_supported_when_params_valid() {
        let mut d = local_dev_descriptor();
        d.underlay = Some(ConduitUnderlay::SshTunnel);
        d.endpoints = vec!["ws://127.0.0.1:19001".into()];
        d.ssh_tunnel = Some(sample_ssh_params());
        assert!(d.is_configurable());
        assert!(d.is_underlay_supported());
        assert_eq!(d.ssh_configure_skip_reason(), None);
    }

    #[test]
    fn ssh_underlay_unsupported_without_params() {
        let mut d = local_dev_descriptor();
        d.underlay = Some(ConduitUnderlay::SshTunnel);
        d.endpoints = vec!["ws://127.0.0.1:19001".into()];
        assert!(!d.is_underlay_supported());
    }

    #[test]
    fn ssh_params_round_trip_and_defaults() {
        let raw = r#"{
            "conduitId": "home-via-bastion",
            "dialect": "nostr_ws",
            "endpoints": ["ws://127.0.0.1:19001"],
            "capabilities": ["publish", "subscribe"],
            "networkPolicy": "clearnet",
            "trustTier": "user_configured",
            "enabled": true,
            "priority": 10,
            "underlay": "ssh_tunnel",
            "sshTunnel": {
                "bastionHost": "bastion.example",
                "bastionUser": "ops",
                "remoteHost": "127.0.0.1",
                "remotePort": 7000,
                "localBindPort": 19001
            }
        }"#;
        let d: ConduitDescriptor = serde_json::from_str(raw).expect("ssh json");
        let params = d.ssh_tunnel.as_ref().expect("params");
        assert_eq!(params.bastion_port, 22);
        assert_eq!(params.local_bind_host, "127.0.0.1");
        assert_eq!(params.local_bind_port, 19001);
        assert_eq!(d.ssh_configure_skip_reason(), None);
        assert!(d.is_underlay_supported());
    }

    #[test]
    fn ssh_missing_params_skip_reason() {
        let mut d = local_dev_descriptor();
        d.underlay = Some(ConduitUnderlay::SshTunnel);
        d.endpoints = vec!["ws://127.0.0.1:19001".into()];
        assert_eq!(d.ssh_configure_skip_reason(), Some("ssh_params_missing"));
    }

    #[test]
    fn ssh_endpoint_mismatch_skip_reason() {
        let mut d = local_dev_descriptor();
        d.underlay = Some(ConduitUnderlay::SshTunnel);
        d.endpoints = vec!["ws://127.0.0.1:7000".into()];
        d.ssh_tunnel = Some(sample_ssh_params());
        assert_eq!(d.ssh_configure_skip_reason(), Some("ssh_endpoint_mismatch"));
    }

    #[test]
    fn unknown_dialect_not_configurable() {
        let raw = r#"{
            "conduitId": "x",
            "dialect": "future_dialect_xyz",
            "endpoints": ["ws://127.0.0.1:1"],
            "capabilities": [],
            "networkPolicy": "clearnet",
            "trustTier": "user_configured",
            "enabled": true,
            "priority": 0
        }"#;
        let d: ConduitDescriptor = serde_json::from_str(raw).expect("unknown dialect");
        assert_eq!(d.dialect, ConduitDialect::Unknown);
        assert!(!d.is_configurable());
    }
}
