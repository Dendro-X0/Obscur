//! Dialect adapters — R-RELAY-RUST-3.
//! Wire maps only; sockets stay in `relay::RelayPool`.

pub mod nostr_ws;

use serde_json::Value;

/// Dialect identifier (mirrors descriptor dialect snake_case).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)] // adapter id space; NostrWs used via DialectPort::id
pub enum DialectId {
    NostrWs,
    /// Reserved — future adapters
    Custom,
    /// Reserved — future adapters
    TeamRelay,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DialectPublishRequest {
    pub envelope_id: String,
    pub event: Value,
    pub relay_urls: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DialectPublishAttempt {
    pub relay_url: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DialectPublishResult {
    pub attempts: Vec<DialectPublishAttempt>,
}

/// Thin dialect contract — RUST-3 nostr_ws implements publish; subscribe later.
#[allow(dead_code)] // trait surface for future multi-dialect dispatch
pub trait DialectPort {
    fn id(&self) -> DialectId;
}
