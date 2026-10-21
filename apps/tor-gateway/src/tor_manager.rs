use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;

use serde::Serialize;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::{
    line_signals_bootstrap_ready, line_signals_socks_conflict, parse_bootstrap_percent,
    DEFAULT_SOCKS_URL,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TorRuntimeState {
    Stopped,
    Starting,
    Ready,
    Error,
}

impl TorRuntimeState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stopped => "stopped",
            Self::Starting => "starting",
            Self::Ready => "ready",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TorStatusView {
    pub state: &'static str,
    pub bootstrap_ready: bool,
    pub socks: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

struct Inner {
    state: TorRuntimeState,
    socks_url: String,
    detail: Option<String>,
    child: Option<Child>,
    data_dir: PathBuf,
    tor_bin: PathBuf,
}

pub struct TorLifecycle {
    inner: Mutex<Inner>,
}

impl TorLifecycle {
    pub fn new(tor_bin: PathBuf, data_dir: PathBuf, socks_url: String) -> Self {
        Self {
            inner: Mutex::new(Inner {
                state: TorRuntimeState::Stopped,
                socks_url,
                detail: None,
                child: None,
                data_dir,
                tor_bin,
            }),
        }
    }

    pub async fn status(&self) -> TorStatusView {
        let guard = self.inner.lock().await;
        TorStatusView {
            state: guard.state.as_str(),
            bootstrap_ready: guard.state == TorRuntimeState::Ready,
            socks: guard.socks_url.clone(),
            detail: guard.detail.clone(),
        }
    }

    pub async fn start(self: &Arc<Self>) -> Result<TorStatusView, String> {
        {
            let mut guard = self.inner.lock().await;
            if matches!(
                guard.state,
                TorRuntimeState::Starting | TorRuntimeState::Ready
            ) {
                return Ok(status_from_inner(&guard));
            }
            if guard.child.is_some() {
                return Ok(status_from_inner(&guard));
            }

            let torrc = prepare_torrc(&guard.data_dir, &guard.socks_url)?;
            if !guard.tor_bin.is_file() {
                guard.state = TorRuntimeState::Error;
                guard.detail = Some(format!(
                    "tor binary not found at {} (set OBSCUR_TOR_BIN)",
                    guard.tor_bin.display()
                ));
                return Err(guard.detail.clone().unwrap_or_default());
            }

            kill_orphan_tor_processes();

            let mut child = Command::new(&guard.tor_bin)
                .args(["-f", torrc.to_str().ok_or("torrc path not UTF-8")?])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| format!("failed to spawn tor: {e}"))?;

            let stdout = child.stdout.take();
            let stderr = child.stderr.take();
            let notice_log = guard.data_dir.join("tor").join("notice.log");
            guard.child = Some(child);
            guard.state = TorRuntimeState::Starting;
            guard.detail = Some("waiting for Bootstrapped 100%".to_string());

            drop(guard);

            if let Some(out) = stdout {
                let this = Arc::clone(self);
                tokio::spawn(async move {
                    let mut lines = BufReader::new(out).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        this.apply_log_line(&line).await;
                    }
                });
            }
            if let Some(err) = stderr {
                let this = Arc::clone(self);
                tokio::spawn(async move {
                    let mut lines = BufReader::new(err).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        this.apply_log_line(&line).await;
                    }
                });
            }

            // Windows pipes often block-buffer Tor's stdout — also watch notice.log.
            let this = Arc::clone(self);
            tokio::spawn(async move {
                this.watch_notice_log(notice_log).await;
            });

            let this = Arc::clone(self);
            tokio::spawn(async move {
                this.watch_exit().await;
            });
        }

        Ok(self.status().await)
    }

    pub async fn stop(&self) -> TorStatusView {
        let mut guard = self.inner.lock().await;
        if let Some(mut child) = guard.child.take() {
            let _ = child.kill().await;
            let _ = child.wait().await;
        }
        kill_orphan_tor_processes();
        guard.state = TorRuntimeState::Stopped;
        guard.detail = None;
        status_from_inner(&guard)
    }

    async fn apply_log_line(&self, line: &str) {
        let mut guard = self.inner.lock().await;
        if line_signals_bootstrap_ready(line) {
            guard.state = TorRuntimeState::Ready;
            guard.detail = None;
            eprintln!("[obscur-tor-gateway] bootstrap ready");
            return;
        }
        if line.contains("Problem bootstrapping") {
            guard.detail = Some(line.trim().to_string());
            eprintln!("[obscur-tor-gateway] bootstrap problem: {line}");
            return;
        }
        if let Some(pct) = parse_bootstrap_percent(line) {
            if matches!(guard.state, TorRuntimeState::Starting) && pct < 100 {
                // Do not clobber an explicit Stuck/TIMEOUT line with weak progress text.
                let keep_problem = guard
                    .detail
                    .as_ref()
                    .is_some_and(|d| d.contains("Problem bootstrapping") || d.contains("Stuck at "));
                if !keep_problem {
                    guard.detail = Some(format!("bootstrapped {pct}%"));
                }
            }
        }
        if line_signals_socks_conflict(line) {
            guard.state = TorRuntimeState::Error;
            guard.detail = Some(
                "SocksPort address already in use — refusing false READY".to_string(),
            );
            eprintln!("[obscur-tor-gateway] socks conflict (not ready): {line}");
        }
    }

    async fn watch_notice_log(&self, path: PathBuf) {
        let mut offset = 0usize;
        for _ in 0..600 {
            // ~5 minutes at 500ms
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            {
                let guard = self.inner.lock().await;
                if !matches!(
                    guard.state,
                    TorRuntimeState::Starting | TorRuntimeState::Ready
                ) {
                    return;
                }
                if guard.state == TorRuntimeState::Ready {
                    return;
                }
            }
            let Ok(bytes) = tokio::fs::read(&path).await else {
                continue;
            };
            if bytes.len() <= offset {
                continue;
            }
            let chunk = String::from_utf8_lossy(&bytes[offset..]);
            offset = bytes.len();
            for line in chunk.lines() {
                self.apply_log_line(line).await;
                let ready = {
                    let guard = self.inner.lock().await;
                    guard.state == TorRuntimeState::Ready
                };
                if ready {
                    return;
                }
            }
        }
    }

    async fn watch_exit(&self) {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            let mut guard = self.inner.lock().await;
            let Some(child) = guard.child.as_mut() else {
                return;
            };
            match child.try_wait() {
                Ok(Some(status)) => {
                    guard.child = None;
                    if guard.state != TorRuntimeState::Stopped {
                        guard.state = TorRuntimeState::Error;
                        guard.detail = Some(format!("tor exited: {status}"));
                    }
                    return;
                }
                Ok(None) => {}
                Err(e) => {
                    guard.child = None;
                    guard.state = TorRuntimeState::Error;
                    guard.detail = Some(format!("tor wait error: {e}"));
                    return;
                }
            }
        }
    }
}

fn status_from_inner(guard: &Inner) -> TorStatusView {
    TorStatusView {
        state: guard.state.as_str(),
        bootstrap_ready: guard.state == TorRuntimeState::Ready,
        socks: guard.socks_url.clone(),
        detail: guard.detail.clone(),
    }
}

pub fn parse_socks_port(proxy_url: &str) -> u16 {
    let addr = proxy_url
        .trim_start_matches("socks5h://")
        .trim_start_matches("socks5://");
    addr.rsplit_once(':')
        .and_then(|(_, port)| port.parse::<u16>().ok())
        .unwrap_or(9050)
}

/// T5-1 client torrc body (unit-tested). Paths use forward slashes for Tor on Windows.
/// IsolateSOCKSAuth is a SocksPort *flag*, not a top-level option (Tor rejects the latter).
pub fn render_client_torrc(data_dir_display: &str, socks_port: u16, notice_display: &str) -> String {
    format!(
        "DataDirectory \"{data_dir}\"\n\
SocksPort {socks_port} IsolateSOCKSAuth\n\
CircuitBuildTimeout 15\n\
KeepalivePeriod 60\n\
CookieAuthentication 0\n\
ClientOnly 1\n\
AvoidDiskWrites 1\n\
Log notice file {notice}\n\
Log notice stdout\n",
        data_dir = data_dir_display,
        socks_port = socks_port,
        notice = notice_display,
    )
}

fn prepare_torrc(data_root: &Path, socks_url: &str) -> Result<PathBuf, String> {
    let tor_dir = data_root.join("tor");
    let data_dir = tor_dir.join("data");
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let socks_port = parse_socks_port(socks_url);
    let data_dir_display = data_dir
        .to_str()
        .ok_or_else(|| "Tor DataDirectory path is not valid UTF-8".to_string())?
        .replace('\\', "/");
    let notice_log = tor_dir.join("notice.log");
    let notice_display = notice_log
        .to_str()
        .ok_or_else(|| "Tor notice.log path is not valid UTF-8".to_string())?
        .replace('\\', "/");
    // Truncate prior log so bootstrap watcher does not read stale 100%.
    let _ = std::fs::write(&notice_log, "");
    let torrc_path = tor_dir.join("torrc");
    let torrc = render_client_torrc(&data_dir_display, socks_port, &notice_display);
    std::fs::write(&torrc_path, torrc).map_err(|e| e.to_string())?;
    Ok(torrc_path)
}

pub fn kill_orphan_tor_processes() {
    #[cfg(windows)]
    {
        // Packaged sidecar is often named tor-<triple>.exe, not tor.exe.
        for image in [
            "tor.exe",
            "tor-x86_64-pc-windows-msvc.exe",
            "tor-i686-pc-windows-msvc.exe",
        ] {
            let _ = std::process::Command::new("taskkill")
                .args(["/IM", image, "/F", "/T"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    }
    #[cfg(all(unix, not(target_os = "android")))]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-x", "tor"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

pub fn resolve_tor_bin() -> PathBuf {
    if let Ok(explicit) = std::env::var("OBSCUR_TOR_BIN") {
        return PathBuf::from(explicit);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let beside = dir.join(if cfg!(windows) { "tor.exe" } else { "tor" });
            if beside.is_file() {
                return beside;
            }
        }
    }
    // Dev fallback: packaged Tauri externalBin next to desktop src-tauri.
    let triple = current_target_triple();
    let name = if cfg!(windows) {
        format!("tor-{triple}.exe")
    } else {
        format!("tor-{triple}")
    };
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../desktop/src-tauri")
        .join(name)
}

pub fn resolve_data_dir() -> PathBuf {
    if let Ok(explicit) = std::env::var("OBSCUR_TOR_GATEWAY_DATA") {
        return PathBuf::from(explicit);
    }
    if let Some(base) = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
    {
        return base.join("app.obscur.desktop").join("tor-gateway");
    }
    std::env::temp_dir().join("obscur-tor-gateway")
}

pub fn resolve_socks_url() -> String {
    std::env::var("OBSCUR_TOR_SOCKS_URL").unwrap_or_else(|_| DEFAULT_SOCKS_URL.to_string())
}

fn current_target_triple() -> &'static str {
    #[cfg(all(windows, target_arch = "x86_64"))]
    {
        "x86_64-pc-windows-msvc"
    }
    #[cfg(all(windows, target_arch = "x86"))]
    {
        "i686-pc-windows-msvc"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "x86_64-apple-darwin"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "aarch64-apple-darwin"
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "x86_64-unknown-linux-gnu"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "aarch64-unknown-linux-gnu"
    }
    #[cfg(not(any(
        all(windows, target_arch = "x86_64"),
        all(windows, target_arch = "x86"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
    )))]
    {
        "unknown"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_socks_port_from_urls() {
        assert_eq!(parse_socks_port("socks5h://127.0.0.1:9050"), 9050);
        assert_eq!(parse_socks_port("socks5://127.0.0.1:9150"), 9150);
        assert_eq!(parse_socks_port("invalid"), 9050);
    }

    #[test]
    fn status_json_uses_camel_case_bootstrap_ready() {
        let view = TorStatusView {
            state: "starting",
            bootstrap_ready: false,
            socks: DEFAULT_SOCKS_URL.to_string(),
            detail: Some("waiting".into()),
        };
        let json = serde_json::to_string(&view).unwrap();
        assert!(json.contains("\"bootstrapReady\":false"));
        assert!(json.contains("\"socks\":"));
        assert!(!json.contains("bootstrap_ready"));
    }

    #[test]
    fn torrc_includes_t5_isolation_and_keepalive() {
        let body = render_client_torrc("/tmp/tor/data", 9050, "/tmp/tor/notice.log");
        assert!(
            body.contains("SocksPort 9050 IsolateSOCKSAuth"),
            "IsolateSOCKSAuth must be a SocksPort flag, not a top-level option"
        );
        assert!(
            !body.contains("IsolateSOCKSAuth 1"),
            "top-level IsolateSOCKSAuth is rejected by Tor 0.4.8"
        );
        assert!(body.contains("CircuitBuildTimeout 15"));
        assert!(body.contains("KeepalivePeriod 60"));
    }
}
