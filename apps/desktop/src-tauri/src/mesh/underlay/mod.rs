//! Reachability underlays — R-RELAY-RUST-5b.
//! Dialects stay unaware; mesh owns spawn/stop before dial.

pub mod ssh_tunnel;

pub use ssh_tunnel::{OpenSshSpawner, SshTunnelSession};
