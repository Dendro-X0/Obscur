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
    pub ready: bool,
    pub using_external_instance: bool,
    pub proxy_url: String,
}

/// Tor process state
pub struct TorState {
    pub child: Mutex<Option<CommandChild>>,
    pub settings: Mutex<TorSettings>,
    pub runtime_status: Mutex<TorRuntimeStatus>,
    pub using_external_instance: Mutex<bool>,
    pub logs: Mutex<Vec<String>>,
}
