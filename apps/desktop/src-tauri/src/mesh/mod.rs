//! Rust conduit mesh skeleton — R-RELAY-RUST-1 / RUST-3 dialect adapters
//! (see specs/backend/r-relay-rust-1-mesh-skeleton-design-2026-07.md,
//!  specs/backend/r-relay-rust-3-nostr-ws-adapter-design-2026-07.md).

pub mod descriptor;
pub mod dialect;
#[cfg(test)]
mod l3_offline_sneakernet;
#[cfg(test)]
mod l3_product;
#[cfg(test)]
mod l3_soak;
#[cfg(test)]
mod l3_ssh_underlay;
pub mod offline;
pub mod publish;
pub mod registry;
pub mod runtime;
pub mod scheduler;
pub mod snapshot;
pub mod tor_policy;
pub mod underlay;
