//! Tor proxy and network models

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

/// Tor configuration settings
#[derive(Serialize, Deserialize, Clone)]
pub struct TorSettings {
    pub enable_tor: bool,
    pub proxy_url: String,
}

/// Tor runtime status
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TorRuntimeStatus {
    Disconnected,
    Starting,
    Connected,
    Error,
    Stopped,
}

/// Tor status snapshot for UI
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TorStatusSnapshot {
    pub state: TorRuntimeStatus,
    pub configured: bool,
    /// Dial-ready for mesh/NativeRelay SOCKS. R4 P0: always false until Slice 4.
    pub ready: bool,
    /// Gateway reported Bootstrapped 100% (lifecycle only — must not open UI SOCKS).
    pub lifecycle_ready: bool,
    pub using_external_instance: bool,
    pub proxy_url: String,
    /// R4: true when obscur-tor-gateway answered on loopback.
    pub gateway_reachable: bool,
    /// Latest gateway detail (bootstrap progress / Stuck at / TLS_ERROR).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// Parsed Bootstrapped N% or Stuck at N% while still Starting — never implies Ready.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bootstrap_percent: Option<u8>,
}

/// Tor process state
pub struct TorState {
    /// Legacy shell sidecar slot (must not hold tor.exe under R4).
    pub child: Mutex<Option<CommandChild>>,
    /// TI-2: obscur-tor-gateway child when desktop spawned it (not tor.exe).
    pub gateway_child: Mutex<Option<std::process::Child>>,
    pub settings: Mutex<TorSettings>,
    pub runtime_status: Mutex<TorRuntimeStatus>,
    pub using_external_instance: Mutex<bool>,
    pub logs: Mutex<Vec<String>>,
    /// Last gateway detail string for UI honesty while Warming/Stuck.
    pub last_gateway_detail: Mutex<Option<String>>,
    pub last_bootstrap_percent: Mutex<Option<u8>>,
}
