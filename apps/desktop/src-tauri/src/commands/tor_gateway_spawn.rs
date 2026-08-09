//! TI-2: spawn `obscur-tor-gateway` (never `tor.exe`) when preference needs the control plane.
//!
//! SOCKS / tor.exe remain owned exclusively by the gateway process.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use crate::commands::tor_gateway_client;

/// TI-2: desktop may spawn the gateway binary — still must never spawn tor.exe.
pub const UI_PROCESS_MAY_SPAWN_GATEWAY: bool = true;

const GATEWAY_SPAWN_HEALTH_TIMEOUT: Duration = Duration::from_secs(90);
const GATEWAY_SPAWN_POLL: Duration = Duration::from_millis(500);

/// Resolve workspace root from this crate (`apps/desktop/src-tauri` → repo root).
pub fn resolve_workspace_root() -> Option<PathBuf> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest
        .parent()? // apps/desktop
        .parent()? // apps
        .parent()? // repo
        .to_path_buf();
    if root.join("Cargo.toml").is_file() && root.join("apps/tor-gateway").is_dir() {
        Some(root)
    } else {
        None
    }
}

/// Prefer packaged/next-to-exe binary, then env override, then cargo-run from workspace.
pub fn resolve_gateway_launch() -> Result<GatewayLaunch, String> {
    if let Ok(bin) = std::env::var("OBSCUR_TOR_GATEWAY_BIN") {
        let trimmed = bin.trim();
        if !trimmed.is_empty() {
            return Ok(GatewayLaunch::Binary(PathBuf::from(trimmed)));
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidates = [
                dir.join("obscur-tor-gateway.exe"),
                dir.join("obscur-tor-gateway"),
                dir.join("tor-gateway").join("obscur-tor-gateway.exe"),
                dir.join("tor-gateway").join("obscur-tor-gateway"),
            ];
            for candidate in candidates {
                if candidate.is_file() {
                    return Ok(GatewayLaunch::Binary(candidate));
                }
            }
        }
    }

    if let Some(root) = resolve_workspace_root() {
        return Ok(GatewayLaunch::CargoRun { workspace: root });
    }

    Err(
        "obscur-tor-gateway binary not found (set OBSCUR_TOR_GATEWAY_BIN or run from workspace)"
            .to_string(),
    )
}

#[derive(Debug, Clone)]
pub enum GatewayLaunch {
    Binary(PathBuf),
    CargoRun { workspace: PathBuf },
}

pub fn spawn_gateway_process(launch: &GatewayLaunch) -> Result<Child, String> {
    if !UI_PROCESS_MAY_SPAWN_GATEWAY {
        return Err("UI_PROCESS_MAY_SPAWN_GATEWAY is false".to_string());
    }

    let mut cmd = match launch {
        GatewayLaunch::Binary(path) => {
            let mut c = Command::new(path);
            c.current_dir(path.parent().unwrap_or_else(|| Path::new(".")));
            c
        }
        GatewayLaunch::CargoRun { workspace } => {
            let mut c = Command::new("cargo");
            c.args(["run", "-p", "obscur-tor-gateway", "--quiet"])
                .current_dir(workspace);
            c
        }
    };

    cmd.env("OBSCUR_TOR_GATEWAY_BIND", "127.0.0.1:17950")
        .env("OBSCUR_TOR_GATEWAY_TUNNEL_BIND", "127.0.0.1:17951")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    cmd.spawn()
        .map_err(|e| format!("failed to spawn obscur-tor-gateway: {e}"))
}

/// Spawn gateway if health fails; wait until `/v1/health` answers.
pub async fn ensure_gateway_reachable(
    store_child: &mut Option<Child>,
) -> Result<(), String> {
    if tor_gateway_client::health().await {
        return Ok(());
    }

    if store_child.is_none() {
        let launch = resolve_gateway_launch()?;
        let child = spawn_gateway_process(&launch)?;
        *store_child = Some(child);
    }

    // Caller should drop the mutex before this await when possible; we still poll here.
    wait_for_gateway_health().await
}

pub async fn wait_for_gateway_health() -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + GATEWAY_SPAWN_HEALTH_TIMEOUT;
    while tokio::time::Instant::now() < deadline {
        if tor_gateway_client::health().await {
            return Ok(());
        }
        tokio::time::sleep(GATEWAY_SPAWN_POLL).await;
    }
    Err(format!(
        "tor gateway did not become healthy within {}s after spawn",
        GATEWAY_SPAWN_HEALTH_TIMEOUT.as_secs()
    ))
}

pub fn stop_gateway_child(child: &mut Option<Child>) -> bool {
    if let Some(mut process) = child.take() {
        let _ = process.kill();
        let _ = process.wait();
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn may_spawn_gateway_but_not_tor_exe() {
        assert!(UI_PROCESS_MAY_SPAWN_GATEWAY);
    }

    #[test]
    fn workspace_root_resolves_from_desktop_crate() {
        let root = resolve_workspace_root().expect("workspace root");
        assert!(root.join("apps/tor-gateway/Cargo.toml").is_file());
    }

    #[test]
    fn launch_prefers_env_binary() {
        std::env::set_var("OBSCUR_TOR_GATEWAY_BIN", "/tmp/fake-gateway");
        let launch = resolve_gateway_launch().unwrap();
        std::env::remove_var("OBSCUR_TOR_GATEWAY_BIN");
        match launch {
            GatewayLaunch::Binary(path) => {
                assert_eq!(path, PathBuf::from("/tmp/fake-gateway"));
            }
            GatewayLaunch::CargoRun { .. } => panic!("expected binary from env"),
        }
    }
}
