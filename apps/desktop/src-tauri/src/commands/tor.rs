use tauri::{AppHandle, Emitter, Manager};
use crate::commands::tor_gateway_client::{self, GatewayTorStatus};
use crate::commands::tor_gateway_spawn::{
    spawn_gateway_process, stop_gateway_child, wait_for_gateway_health, UI_PROCESS_MAY_SPAWN_GATEWAY,
};
use crate::models::tor::{TorSettings, TorRuntimeStatus, TorState, TorStatusSnapshot};
use crate::net;

const TOR_LOG_BUFFER_LIMIT: usize = 200;

fn append_tor_log(state: &TorState, line: impl Into<String>) -> Result<(), String> {
    let mut logs = state.logs.lock().map_err(|e| e.to_string())?;
    logs.push(line.into());
    let overflow = logs.len().saturating_sub(TOR_LOG_BUFFER_LIMIT);
    if overflow > 0 {
        logs.drain(0..overflow);
    }
    Ok(())
}

#[cfg(test)]
fn parse_socks_port(proxy_url: &str) -> u16 {
    let addr = proxy_url
        .trim_start_matches("socks5h://")
        .trim_start_matches("socks5://");
    addr
        .rsplit_once(':')
        .and_then(|(_, port)| port.parse::<u16>().ok())
        .unwrap_or(9050)
}

fn parse_bootstrap_percent_from_detail(detail: &str) -> Option<u8> {
    // Prefer explicit Stuck at N% (common when TLS_ERROR stalls bootstrap).
    if let Some(idx) = detail.find("Stuck at ") {
        let rest = &detail[idx + "Stuck at ".len()..];
        let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(pct) = digits.parse::<u8>() {
            return Some(pct.min(99));
        }
    }
    // Ignore "waiting for Bootstrapped 100%" — that is a wait message, not progress.
    if detail.to_ascii_lowercase().contains("waiting for bootstrapped") {
        return None;
    }
    if let Some(idx) = detail.find("Bootstrapped ") {
        let rest = &detail[idx + "Bootstrapped ".len()..];
        let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(pct) = digits.parse::<u8>() {
            // Never treat <100 lifecycle as dial-ready percent 100.
            return Some(pct.min(99));
        }
    }
    // Gateway may emit lowercase "bootstrapped N%" progress lines.
    if let Some(idx) = detail.to_ascii_lowercase().find("bootstrapped ") {
        let rest = &detail[idx + "bootstrapped ".len()..];
        let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(pct) = digits.parse::<u8>() {
            return Some(pct.min(99));
        }
    }
    None
}

fn detail_is_bootstrap_problem(detail: &str) -> bool {
    let lower = detail.to_ascii_lowercase();
    lower.contains("problem bootstrapping")
        || lower.contains("stuck at ")
        || lower.contains("tls_error")
        || lower.contains("wsaetimedout")
        || lower.contains("timeout")
}

fn detail_is_weak_progress(detail: &str) -> bool {
    let lower = detail.to_ascii_lowercase();
    lower.contains("waiting for bootstrapped")
        || (lower.starts_with("bootstrapped ") && !detail_is_bootstrap_problem(detail))
}

fn remember_gateway_progress(
    state: &TorState,
    gw: &GatewayTorStatus,
) -> Result<(), String> {
    let incoming = gw
        .detail
        .as_ref()
        .map(|d| d.trim().to_string())
        .filter(|d| !d.is_empty());
    {
        let mut guard = state.last_gateway_detail.lock().map_err(|e| e.to_string())?;
        match (&*guard, &incoming) {
            // Prefer explicit failure detail over "waiting…" / "bootstrapped N%" churn.
            (Some(prev), Some(next))
                if detail_is_bootstrap_problem(prev) && detail_is_weak_progress(next) => {}
            (_, next) => {
                *guard = next.clone();
            }
        }
    }
    let retained = state
        .last_gateway_detail
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or(None);
    let percent = retained
        .as_ref()
        .and_then(|d| parse_bootstrap_percent_from_detail(d));
    {
        let mut guard = state
            .last_bootstrap_percent
            .lock()
            .map_err(|e| e.to_string())?;
        *guard = if gw.bootstrap_ready {
            Some(100)
        } else {
            // Keep percent < 100 while not Ready so UI soft-stall can fire.
            percent.filter(|p| *p < 100)
        };
    }
    Ok(())
}

fn clear_gateway_progress(state: &TorState) -> Result<(), String> {
    {
        let mut guard = state.last_gateway_detail.lock().map_err(|e| e.to_string())?;
        // Keep last Stuck/TIMEOUT reason across stop/restart so UI honesty survives churn.
        if guard.as_ref().is_some_and(|d| detail_is_bootstrap_problem(d)) {
            return Ok(());
        }
        *guard = None;
    }
    {
        let mut guard = state
            .last_bootstrap_percent
            .lock()
            .map_err(|e| e.to_string())?;
        *guard = None;
    }
    Ok(())
}

fn build_tor_status_snapshot(
    state: &TorState,
    lifecycle_ready: bool,
    gateway_reachable: bool,
) -> Result<TorStatusSnapshot, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    let runtime_status = state.runtime_status.lock().map_err(|e| e.to_string())?;
    let using_external = state
        .using_external_instance
        .lock()
        .map(|guard| *guard)
        .unwrap_or(false);
    let detail = state
        .last_gateway_detail
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or(None);
    let bootstrap_percent = state
        .last_bootstrap_percent
        .lock()
        .map(|guard| *guard)
        .unwrap_or(None);

    // Slice 4a: dial-ready means gateway can perform SOCKS HTTP (UI never opens SOCKS).
    let ready = GATEWAY_OWNS_HTTP_DIALS && lifecycle_ready && !UI_PROCESS_MAY_DIAL_VIA_SOCKS;

    Ok(TorStatusSnapshot {
        state: *runtime_status,
        configured: settings.enable_tor,
        ready,
        lifecycle_ready,
        using_external_instance: using_external,
        proxy_url: settings.proxy_url.clone(),
        gateway_reachable,
        detail,
        bootstrap_percent,
    })
}

fn set_tor_runtime_status(
    app: &AppHandle,
    state: &TorState,
    status: TorRuntimeStatus,
    external: Option<bool>,
) -> Result<(), String> {
    // Emit only on transition — identical-status spam fills WebView2 PostMessage quota (L3).
    let status_changed = {
        let mut guard = state.runtime_status.lock().map_err(|e| e.to_string())?;
        if *guard == status {
            false
        } else {
            *guard = status;
            true
        }
    };
    if let Some(ext) = external {
        let mut guard = state
            .using_external_instance
            .lock()
            .map_err(|e| e.to_string())?;
        *guard = ext;
    }
    if status_changed {
        crate::emit_pressure::note_webview_emit("tor-status");
        let _ = app.emit("tor-status", status);
    }
    Ok(())
}

fn apply_gateway_status(
    app: &AppHandle,
    state: &TorState,
    gw: &GatewayTorStatus,
) -> Result<(TorRuntimeStatus, bool), String> {
    let (status, ready) = tor_gateway_client::map_gateway_to_runtime(gw);
    if !gw.socks.is_empty() {
        let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
        settings.proxy_url = gw.socks.clone();
    }
    remember_gateway_progress(state, gw)?;
    // Gateway owns Tor → "external" from the UI process perspective.
    set_tor_runtime_status(app, state, status, Some(true))?;
    Ok((status, ready))
}

pub fn stop_tor_child(state: &TorState) -> Result<bool, String> {
    let mut child_opt = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = child_opt.take() {
        let _ = child.write("\n".as_bytes());
        let _ = child.kill();
        Ok(true)
    } else {
        Ok(false)
    }
}

/// R4: the UI / Tauri process must never own `tor.exe`.
pub const UI_PROCESS_MAY_SPAWN_TOR: bool = false;
const _: () = assert!(!UI_PROCESS_MAY_SPAWN_TOR);

/// UI process must never open SOCKS sockets (freeze class). Remains false after Slice 4a.
pub const UI_PROCESS_MAY_DIAL_VIA_SOCKS: bool = false;

/// Slice 4a: mesh may treat lifecycle-ready as dial-ready because HTTP SOCKS runs in gateway.
pub const GATEWAY_OWNS_HTTP_DIALS: bool = true;

/// Slice 4b: NativeRelay WS dials use gateway tunnel (UI never opens Tor SOCKS).
pub const GATEWAY_OWNS_WS_DIALS: bool = true;
const _: () = assert!(GATEWAY_OWNS_WS_DIALS);

/// Best-effort kill of orphan Tor processes left after crash / legacy in-process sidecar.
pub fn kill_orphan_tor_processes() {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/IM", "tor.exe", "/F", "/T"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    #[cfg(all(unix, not(target_os = "android")))]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-x", "tor"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

/// R4 / TI-2: ask gateway to start Tor. May spawn `obscur-tor-gateway` (never `tor.exe`).
#[tauri::command]
pub async fn start_tor(
    app: tauri::AppHandle,
    state: tauri::State<'_, TorState>,
    net_runtime: tauri::State<'_, net::NativeNetworkRuntime>,
) -> Result<String, String> {
    if crate::perf_plane::is_local() {
        crate::invoke_pressure::note_invoke("perf_plane:reject:start_tor");
        return Ok(crate::perf_plane::reject_message("start_tor"));
    }
    let _ = stop_tor_child(&state)?;
    // UI process must never arm SOCKS (Slice 4 owns dials).
    net_runtime.set(false, net_runtime.get_proxy_url());

    if !tor_gateway_client::health().await {
        if UI_PROCESS_MAY_SPAWN_GATEWAY {
            append_tor_log(
                &state,
                "TI-2: gateway unreachable — spawning obscur-tor-gateway (not tor.exe)…",
            )?;
            {
                let mut gateway_child = state.gateway_child.lock().map_err(|e| e.to_string())?;
                if gateway_child.is_none() {
                    let launch = crate::commands::tor_gateway_spawn::resolve_gateway_launch()?;
                    let child = spawn_gateway_process(&launch)?;
                    *gateway_child = Some(child);
                }
            }
            if let Err(err) = wait_for_gateway_health().await
            {
                let msg = format!(
                    "tor gateway unreachable at {} — {err}",
                    tor_gateway_client::gateway_base_url()
                );
                append_tor_log(&state, format!("TI-2: {msg}"))?;
                crate::emit_pressure::note_webview_emit("tor-error");
                let _ = app.emit("tor-error", msg.clone());
                set_tor_runtime_status(&app, &state, TorRuntimeStatus::Error, Some(false))?;
                return Err(msg);
            }
            append_tor_log(&state, "TI-2: obscur-tor-gateway is healthy.")?;
        } else {
            let msg = format!(
                "tor gateway unreachable at {} — run `pnpm dev:tor-gateway`",
                tor_gateway_client::gateway_base_url()
            );
            append_tor_log(&state, format!("R4: {msg}"))?;
            crate::emit_pressure::note_webview_emit("tor-error");
            let _ = app.emit("tor-error", msg.clone());
            set_tor_runtime_status(&app, &state, TorRuntimeStatus::Error, Some(false))?;
            return Err(msg);
        }
    }

    match tor_gateway_client::start().await {
        Ok(gw) => {
            let (status, ready) = apply_gateway_status(&app, &state, &gw)?;
            append_tor_log(
                &state,
                format!(
                    "R4: gateway start accepted (state={}, bootstrapReady={}{})",
                    gw.state,
                    gw.bootstrap_ready,
                    gw.detail
                        .as_ref()
                        .map(|d| format!(", detail={d}"))
                        .unwrap_or_default()
                ),
            )?;
            crate::emit_pressure::note_webview_emit("tor-log");
            let _ = app.emit(
                "tor-log",
                format!("R4: gateway start → {} ready={}", status_label(status), ready),
            );
            if let Some(detail) = gw.detail.as_ref() {
                crate::emit_pressure::note_webview_emit("tor-log");
                let _ = app.emit("tor-log", format!("R4: gateway detail: {detail}"));
            }
            Ok(if ready {
                "Tor ready via gateway".to_string()
            } else {
                "Tor starting via gateway".to_string()
            })
        }
        Err(err) => {
            let msg = err.to_string();
            append_tor_log(&state, format!("R4: {msg}"))?;
            crate::emit_pressure::note_webview_emit("tor-log");
            let _ = app.emit("tor-log", format!("R4: {msg}"));
            crate::emit_pressure::note_webview_emit("tor-error");
            let _ = app.emit("tor-error", msg.clone());
            set_tor_runtime_status(&app, &state, TorRuntimeStatus::Error, Some(false))?;
            Err(msg)
        }
    }
}

fn status_label(status: TorRuntimeStatus) -> &'static str {
    match status {
        TorRuntimeStatus::Disconnected => "disconnected",
        TorRuntimeStatus::Starting => "starting",
        TorRuntimeStatus::Connected => "connected",
        TorRuntimeStatus::Error => "error",
        TorRuntimeStatus::Stopped => "stopped",
    }
}

#[tauri::command]
pub async fn stop_tor(
    state: tauri::State<'_, TorState>,
    app: tauri::AppHandle,
    net_runtime: tauri::State<'_, net::NativeNetworkRuntime>,
) -> Result<String, String> {
    if crate::perf_plane::is_local() {
        crate::invoke_pressure::note_invoke("perf_plane:reject:stop_tor");
        return Ok(crate::perf_plane::reject_message("stop_tor"));
    }
    let stopped_child = stop_tor_child(&state)?;
    net_runtime.set(false, net_runtime.get_proxy_url());

    match tor_gateway_client::stop().await {
        Ok(gw) => {
            let _ = apply_gateway_status(&app, &state, &gw)?;
            clear_gateway_progress(&state)?;
            append_tor_log(&state, "R4: gateway stop accepted.")?;
            crate::emit_pressure::note_webview_emit("tor-log");
            let _ = app.emit("tor-log", "R4: gateway stop accepted.");
        }
        Err(err) => {
            // Kill-switch: gateway down — still clear local leftovers.
            kill_orphan_tor_processes();
            clear_gateway_progress(&state)?;
            append_tor_log(
                &state,
                format!("R4: gateway stop failed ({err}); local orphan cleanup attempted."),
            )?;
            set_tor_runtime_status(&app, &state, TorRuntimeStatus::Stopped, Some(false))?;
        }
    }

    // TI-2: only kill gateway if this desktop process spawned it.
    {
        let mut gateway_child = state.gateway_child.lock().map_err(|e| e.to_string())?;
        if stop_gateway_child(&mut gateway_child) {
            append_tor_log(&state, "TI-2: stopped desktop-spawned obscur-tor-gateway.")?;
        }
    }

    if stopped_child {
        Ok("Tor stopped".to_string())
    } else {
        Ok("Tor stop requested".to_string())
    }
}

#[tauri::command]
pub async fn get_tor_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, TorState>,
) -> Result<TorStatusSnapshot, String> {
    if crate::perf_plane::is_local() {
        crate::invoke_pressure::note_invoke("perf_plane:reject:get_tor_status");
        return build_tor_status_snapshot(&state, false, false);
    }
    // R4: never promote ready from SOCKS TCP probe — gateway bootstrap only.
    match tor_gateway_client::status().await {
        Ok(gw) => {
            let (_status, lifecycle_ready) = apply_gateway_status(&app, &state, &gw)?;
            // Pull path: never emit here (listener → get_tor_status → emit was a feedback loop).
            build_tor_status_snapshot(&state, lifecycle_ready, true)
        }
        Err(_err) => {
            // Kill-switch: gateway down → lifecycle/dial ready false; do not spam logs on poll.
            let configured = state
                .settings
                .lock()
                .map(|g| g.enable_tor)
                .unwrap_or(false);
            if configured {
                set_tor_runtime_status(&app, &state, TorRuntimeStatus::Stopped, Some(false))?;
            }
            build_tor_status_snapshot(&state, false, false)
        }
    }
}

#[tauri::command]
pub async fn get_tor_logs(state: tauri::State<'_, TorState>) -> Result<Vec<String>, String> {
    let logs = state.logs.lock().map_err(|e| e.to_string())?;
    Ok(logs.clone())
}

#[tauri::command]
pub async fn save_tor_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, TorState>,
    net_runtime: tauri::State<'_, net::NativeNetworkRuntime>,
    enable_tor: bool,
    proxy_url: String,
) -> Result<(), String> {
    {
        let mut settings = state.settings.lock().unwrap();
        // Preference may be stored, but the UI process must never arm SOCKS (R4).
        settings.enable_tor = enable_tor;
        settings.proxy_url = proxy_url.clone();
        net_runtime.set(false, proxy_url.clone());

        if !enable_tor {
            let _ = clear_gateway_progress(&state);
            let _ =
                set_tor_runtime_status(&app, &state, TorRuntimeStatus::Disconnected, Some(false));
        } else {
            let _ = set_tor_runtime_status(&app, &state, TorRuntimeStatus::Stopped, Some(false));
            append_tor_log(
                &state,
                "Tor preference saved; start/stop via obscur-tor-gateway (UI will not arm SOCKS).",
            )?;
        }

        let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let path = app_dir.join("tor_settings.json");
        let json = serde_json::to_string(&*settings).map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| e.to_string())?;
    }

    if !enable_tor {
        let _ = stop_tor_child(&state)?;
        // Best-effort gateway stop; ignore unreachable.
        let _ = tor_gateway_client::stop().await;
        {
            let mut gateway_child = state.gateway_child.lock().map_err(|e| e.to_string())?;
            let _ = stop_gateway_child(&mut gateway_child);
        }
        kill_orphan_tor_processes();
    }

    Ok(())
}

pub fn load_tor_settings(app: &tauri::AppHandle) -> TorSettings {
    let default = TorSettings {
        enable_tor: false,
        proxy_url: "socks5h://127.0.0.1:9050".to_string(),
    };

    let Ok(app_dir) = app.path().app_data_dir() else {
        return default;
    };
    let path = app_dir.join("tor_settings.json");
    let Ok(json) = std::fs::read_to_string(path) else {
        return default;
    };
    let mut settings: TorSettings = serde_json::from_str(&json).unwrap_or(default.clone());
    if settings.proxy_url == "socks5://127.0.0.1:9050" {
        settings.proxy_url = default.proxy_url;
    }
    settings
}

#[cfg(test)]
mod tests {
    use super::{
        parse_bootstrap_percent_from_detail, parse_socks_port, GATEWAY_OWNS_HTTP_DIALS,
        GATEWAY_OWNS_WS_DIALS, UI_PROCESS_MAY_DIAL_VIA_SOCKS, UI_PROCESS_MAY_SPAWN_TOR,
    };
    use crate::commands::tor_gateway_spawn::UI_PROCESS_MAY_SPAWN_GATEWAY;

    #[test]
    fn parse_socks_port_from_socks5h_url() {
        assert_eq!(parse_socks_port("socks5h://127.0.0.1:9050"), 9050);
        assert_eq!(parse_socks_port("socks5://127.0.0.1:9150"), 9150);
        assert_eq!(parse_socks_port("invalid"), 9050);
    }

    #[test]
    fn parse_bootstrap_percent_prefers_stuck_at() {
        let stuck = "Problem bootstrapping. Stuck at 10% (conn_done): Connected to a relay. (TLS_ERROR)";
        assert_eq!(parse_bootstrap_percent_from_detail(stuck), Some(10));
        assert_eq!(
            parse_bootstrap_percent_from_detail("Bootstrapped 45% (connecting_to_relay)"),
            Some(45)
        );
        assert_eq!(
            parse_bootstrap_percent_from_detail("bootstrapped 10%"),
            Some(10)
        );
        assert_eq!(
            parse_bootstrap_percent_from_detail("waiting for Bootstrapped 100%"),
            None
        );
    }

    #[test]
    fn ui_process_must_not_spawn_tor_under_r4() {
        assert!(!UI_PROCESS_MAY_SPAWN_TOR);
        assert!(UI_PROCESS_MAY_SPAWN_GATEWAY);
    }

    #[test]
    fn ui_process_must_never_open_socks_sockets() {
        assert!(!UI_PROCESS_MAY_DIAL_VIA_SOCKS);
    }

    #[test]
    fn gateway_owns_http_dials_under_slice_4a() {
        assert!(GATEWAY_OWNS_HTTP_DIALS);
        // Dial-ready requires gateway ownership XOR UI SOCKS — never both.
        assert!(GATEWAY_OWNS_HTTP_DIALS != UI_PROCESS_MAY_DIAL_VIA_SOCKS || !GATEWAY_OWNS_HTTP_DIALS);
        assert!(GATEWAY_OWNS_HTTP_DIALS && !UI_PROCESS_MAY_DIAL_VIA_SOCKS);
    }

    #[test]
    fn dial_ready_requires_lifecycle_and_gateway_ownership() {
        assert!(GATEWAY_OWNS_HTTP_DIALS && !UI_PROCESS_MAY_DIAL_VIA_SOCKS);
        // Documented L3 invariant: poll must not spam emit (see investigation spec).
    }

    #[test]
    fn gateway_owns_ws_dials_under_slice_4b() {
        assert!(GATEWAY_OWNS_WS_DIALS);
        assert!(!UI_PROCESS_MAY_DIAL_VIA_SOCKS);
    }
}
