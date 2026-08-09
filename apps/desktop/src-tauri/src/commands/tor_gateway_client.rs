//! R4 Slice 3: UI process talks to `obscur-tor-gateway` over loopback HTTP.
//! Slice 4b: loopback TCP tunnel for relay WS (SOCKS stays in gateway).
//! Never spawns `tor.exe`. Never dials Tor SocksPort from the UI process.

use serde::Deserialize;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::models::tor::TorRuntimeStatus;

/// Canonical R4 loopback control plane (must match `obscur-tor-gateway` DEFAULT_BIND).
pub const DEFAULT_GATEWAY_BASE: &str = "http://127.0.0.1:17950";
pub const CANONICAL_GATEWAY_PORT: u16 = 17950;
/// Slice 4b-1 tunnel listener (must match gateway DEFAULT_TUNNEL_BIND).
pub const DEFAULT_TUNNEL_ADDR: &str = "127.0.0.1:17951";
pub const CANONICAL_TUNNEL_PORT: u16 = 17951;
const REQUEST_TIMEOUT: Duration = Duration::from_millis(2_000);
const CONNECT_TIMEOUT: Duration = Duration::from_millis(800);
/// Slice 4a dial proxy — must cover gateway SOCKS connect + upstream.
const DIAL_REQUEST_TIMEOUT: Duration = Duration::from_secs(50);
const TUNNEL_HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(15);

fn is_loopback_http_base(url: &str) -> bool {
    let trimmed = url.trim().trim_end_matches('/');
    trimmed.starts_with("http://127.0.0.1:") || trimmed.starts_with("http://localhost:")
}

fn is_canonical_gateway_base(url: &str) -> bool {
    let trimmed = url.trim().trim_end_matches('/');
    trimmed == DEFAULT_GATEWAY_BASE
        || trimmed == "http://localhost:17950"
}

/// Resolve UI→gateway base URL. T0: ignore drifted ports (e.g. `:11468`) unless
/// `allow_custom` and the URL is still loopback HTTP.
pub fn resolve_gateway_base_url(env_value: Option<&str>, allow_custom: bool) -> String {
    let Some(raw) = env_value.map(str::trim).filter(|s| !s.is_empty()) else {
        return DEFAULT_GATEWAY_BASE.to_string();
    };
    if is_canonical_gateway_base(raw) {
        return DEFAULT_GATEWAY_BASE.to_string();
    }
    if allow_custom && is_loopback_http_base(raw) {
        return raw.trim_end_matches('/').to_string();
    }
    eprintln!(
        "[tor_gateway_client] ignoring OBSCUR_TOR_GATEWAY_URL={raw} — using {DEFAULT_GATEWAY_BASE} (set OBSCUR_TOR_GATEWAY_ALLOW_CUSTOM=1 for loopback override)"
    );
    DEFAULT_GATEWAY_BASE.to_string()
}

fn allow_custom_gateway_url() -> bool {
    std::env::var("OBSCUR_TOR_GATEWAY_ALLOW_CUSTOM")
        .map(|v| v.trim() == "1")
        .unwrap_or(false)
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayTorStatus {
    pub state: String,
    pub bootstrap_ready: bool,
    pub socks: String,
    #[serde(default)]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GatewayClientError {
    Unreachable(String),
    BadResponse(String),
}

impl std::fmt::Display for GatewayClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unreachable(msg) => write!(f, "tor gateway unreachable: {msg}"),
            Self::BadResponse(msg) => write!(f, "tor gateway bad response: {msg}"),
        }
    }
}

pub fn gateway_base_url() -> String {
    resolve_gateway_base_url(
        std::env::var("OBSCUR_TOR_GATEWAY_URL").ok().as_deref(),
        allow_custom_gateway_url(),
    )
}

/// Resolve tunnel bind (`host:port`). Pins canonical unless custom allowed.
pub fn resolve_tunnel_addr(env_value: Option<&str>, allow_custom: bool) -> String {
    let Some(raw) = env_value.map(str::trim).filter(|s| !s.is_empty()) else {
        return DEFAULT_TUNNEL_ADDR.to_string();
    };
    if raw == DEFAULT_TUNNEL_ADDR || raw == "localhost:17951" {
        return DEFAULT_TUNNEL_ADDR.to_string();
    }
    let loopback = raw.starts_with("127.0.0.1:") || raw.starts_with("localhost:");
    if allow_custom && loopback {
        return raw.to_string();
    }
    eprintln!(
        "[tor_gateway_client] ignoring OBSCUR_TOR_GATEWAY_TUNNEL_ADDR={raw} — using {DEFAULT_TUNNEL_ADDR}"
    );
    DEFAULT_TUNNEL_ADDR.to_string()
}

pub fn tunnel_addr() -> String {
    resolve_tunnel_addr(
        std::env::var("OBSCUR_TOR_GATEWAY_TUNNEL_ADDR").ok().as_deref(),
        allow_custom_gateway_url(),
    )
}

/// Dial-mode selection for NativeRelay (4b-2). Never arms UI→Tor SOCKS.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RelayDialMode {
    Clearnet,
    GatewayTunnel,
    FailClosedGatewayDown,
    FailClosedTorNotReady,
}

pub fn resolve_relay_dial_mode(
    enable_tor_preference: bool,
    gateway_reachable: bool,
    bootstrap_ready: bool,
) -> RelayDialMode {
    if !enable_tor_preference {
        return RelayDialMode::Clearnet;
    }
    if !gateway_reachable {
        return RelayDialMode::FailClosedGatewayDown;
    }
    if !bootstrap_ready {
        return RelayDialMode::FailClosedTorNotReady;
    }
    RelayDialMode::GatewayTunnel
}

#[derive(Debug, Deserialize)]
struct TunnelOpenReply {
    ok: bool,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    detail: Option<String>,
}

/// Open a loopback TCP tunnel through the gateway (SOCKS CONNECT runs in gateway).
pub async fn open_tcp_tunnel(host: &str, port: u16) -> Result<TcpStream, GatewayClientError> {
    let addr = tunnel_addr();
    let mut stream = timeout(TUNNEL_HANDSHAKE_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| GatewayClientError::Unreachable(format!("tunnel connect timeout to {addr}")))?
        .map_err(|e| GatewayClientError::Unreachable(format!("tunnel connect {addr}: {e}")))?;

    let req = serde_json::json!({ "v": 1, "host": host, "port": port });
    let mut line = req.to_string();
    line.push('\n');
    timeout(TUNNEL_HANDSHAKE_TIMEOUT, stream.write_all(line.as_bytes()))
        .await
        .map_err(|_| GatewayClientError::Unreachable("tunnel handshake write timeout".into()))?
        .map_err(|e| GatewayClientError::Unreachable(format!("tunnel handshake write: {e}")))?;

    let mut reader = BufReader::new(&mut stream);
    let mut reply = String::new();
    timeout(TUNNEL_HANDSHAKE_TIMEOUT, reader.read_line(&mut reply))
        .await
        .map_err(|_| GatewayClientError::Unreachable("tunnel handshake read timeout".into()))?
        .map_err(|e| GatewayClientError::Unreachable(format!("tunnel handshake read: {e}")))?;

    let parsed: TunnelOpenReply = serde_json::from_str(reply.trim()).map_err(|e| {
        GatewayClientError::BadResponse(format!("tunnel reply parse: {e}; raw={reply:?}"))
    })?;
    if !parsed.ok {
        let err = parsed.error.unwrap_or_else(|| "tunnel_failed".into());
        let detail = parsed.detail.unwrap_or_default();
        return Err(GatewayClientError::BadResponse(format!("{err}: {detail}")));
    }
    Ok(stream)
}

fn http_client() -> Result<reqwest::Client, GatewayClientError> {
    // Loopback control plane must not honor system HTTP(S)_PROXY (Windows registry
    // proxies commonly break 127.0.0.1 and force FailClosedGatewayDown).
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(CONNECT_TIMEOUT)
        .no_proxy()
        .build()
        .map_err(|e| GatewayClientError::Unreachable(e.to_string()))
}

pub async fn health() -> bool {
    let base = gateway_base_url();
    let Ok(client) = http_client() else {
        return false;
    };
    match client.get(format!("{base}/v1/health")).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

pub async fn status() -> Result<GatewayTorStatus, GatewayClientError> {
    get_json("/v1/tor/status").await
}

pub async fn start() -> Result<GatewayTorStatus, GatewayClientError> {
    post_json("/v1/tor/start").await
}

pub async fn stop() -> Result<GatewayTorStatus, GatewayClientError> {
    post_json("/v1/tor/stop").await
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayHttpFetchRequest {
    pub url: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_text: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayHttpFetchResponse {
    pub status: u16,
    pub body_text: String,
    #[serde(default)]
    pub content_type: Option<String>,
}

/// R4 Slice 4a: UI asks gateway to dial via Tor SOCKS (no local SOCKS sockets).
pub async fn http_fetch(
    req: GatewayHttpFetchRequest,
) -> Result<GatewayHttpFetchResponse, GatewayClientError> {
    let base = gateway_base_url();
    let client = reqwest::Client::builder()
        .timeout(DIAL_REQUEST_TIMEOUT)
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .map_err(|e| GatewayClientError::Unreachable(e.to_string()))?;
    let resp = client
        .post(format!("{base}/v1/http/fetch"))
        .json(&req)
        .send()
        .await
        .map_err(|e| GatewayClientError::Unreachable(e.to_string()))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(GatewayClientError::BadResponse(format!(
            "HTTP {status}: {body}"
        )));
    }
    resp.json::<GatewayHttpFetchResponse>()
        .await
        .map_err(|e| GatewayClientError::BadResponse(e.to_string()))
}

async fn get_json(path: &str) -> Result<GatewayTorStatus, GatewayClientError> {
    let base = gateway_base_url();
    let client = http_client()?;
    let resp = client
        .get(format!("{base}{path}"))
        .send()
        .await
        .map_err(|e| GatewayClientError::Unreachable(e.to_string()))?;
    parse_status_response(resp).await
}

async fn post_json(path: &str) -> Result<GatewayTorStatus, GatewayClientError> {
    let base = gateway_base_url();
    let client = http_client()?;
    let resp = client
        .post(format!("{base}{path}"))
        .send()
        .await
        .map_err(|e| GatewayClientError::Unreachable(e.to_string()))?;
    parse_status_response(resp).await
}

async fn parse_status_response(
    resp: reqwest::Response,
) -> Result<GatewayTorStatus, GatewayClientError> {
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(GatewayClientError::BadResponse(format!(
            "HTTP {status}: {body}"
        )));
    }
    resp.json::<GatewayTorStatus>()
        .await
        .map_err(|e| GatewayClientError::BadResponse(e.to_string()))
}

/// Map gateway lifecycle → UI snapshot fields.
/// Ready is true only when gateway reports `ready` **and** `bootstrapReady`.
pub fn map_gateway_to_runtime(
    gw: &GatewayTorStatus,
) -> (TorRuntimeStatus, bool /* ready */) {
    match gw.state.as_str() {
        "ready" if gw.bootstrap_ready => (TorRuntimeStatus::Connected, true),
        "ready" => (TorRuntimeStatus::Starting, false),
        "starting" => (TorRuntimeStatus::Starting, false),
        "error" => (TorRuntimeStatus::Error, false),
        "stopped" => (TorRuntimeStatus::Stopped, false),
        _ => (TorRuntimeStatus::Disconnected, false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ready_requires_bootstrap_flag() {
        let ready = GatewayTorStatus {
            state: "ready".into(),
            bootstrap_ready: true,
            socks: "socks5h://127.0.0.1:9050".into(),
            detail: None,
        };
        assert_eq!(
            map_gateway_to_runtime(&ready),
            (TorRuntimeStatus::Connected, true)
        );

        let false_ready = GatewayTorStatus {
            state: "ready".into(),
            bootstrap_ready: false,
            socks: "socks5h://127.0.0.1:9050".into(),
            detail: None,
        };
        assert_eq!(
            map_gateway_to_runtime(&false_ready),
            (TorRuntimeStatus::Starting, false)
        );
    }

    #[test]
    fn starting_and_error_never_ready() {
        let starting = GatewayTorStatus {
            state: "starting".into(),
            bootstrap_ready: false,
            socks: "socks5h://127.0.0.1:9050".into(),
            detail: Some("waiting".into()),
        };
        assert_eq!(
            map_gateway_to_runtime(&starting),
            (TorRuntimeStatus::Starting, false)
        );

        let err = GatewayTorStatus {
            state: "error".into(),
            bootstrap_ready: true, // ignore — state wins
            socks: "socks5h://127.0.0.1:9050".into(),
            detail: Some("conflict".into()),
        };
        assert_eq!(
            map_gateway_to_runtime(&err),
            (TorRuntimeStatus::Error, false)
        );
    }

    #[test]
    fn default_gateway_base_is_canonical_port() {
        assert_eq!(DEFAULT_GATEWAY_BASE, "http://127.0.0.1:17950");
        assert_eq!(CANONICAL_GATEWAY_PORT, 17950);
    }

    #[test]
    fn resolve_ignores_drifted_env_port() {
        assert_eq!(
            resolve_gateway_base_url(Some("http://127.0.0.1:11468"), false),
            DEFAULT_GATEWAY_BASE
        );
        assert_eq!(
            resolve_gateway_base_url(Some("http://127.0.0.1:17950/"), false),
            DEFAULT_GATEWAY_BASE
        );
        assert_eq!(resolve_gateway_base_url(None, false), DEFAULT_GATEWAY_BASE);
        assert_eq!(resolve_gateway_base_url(Some(""), false), DEFAULT_GATEWAY_BASE);
    }

    #[test]
    fn resolve_allows_custom_loopback_when_flagged() {
        assert_eq!(
            resolve_gateway_base_url(Some("http://127.0.0.1:11468"), true),
            "http://127.0.0.1:11468"
        );
    }

    #[test]
    fn tunnel_addr_is_canonical() {
        assert_eq!(DEFAULT_TUNNEL_ADDR, "127.0.0.1:17951");
        assert_eq!(CANONICAL_TUNNEL_PORT, 17951);
        assert_eq!(resolve_tunnel_addr(None, false), DEFAULT_TUNNEL_ADDR);
        assert_eq!(
            resolve_tunnel_addr(Some("127.0.0.1:19000"), false),
            DEFAULT_TUNNEL_ADDR
        );
    }

    #[test]
    fn relay_dial_mode_selection_matrix() {
        assert_eq!(
            resolve_relay_dial_mode(false, true, true),
            RelayDialMode::Clearnet
        );
        assert_eq!(
            resolve_relay_dial_mode(true, false, false),
            RelayDialMode::FailClosedGatewayDown
        );
        assert_eq!(
            resolve_relay_dial_mode(true, true, false),
            RelayDialMode::FailClosedTorNotReady
        );
        assert_eq!(
            resolve_relay_dial_mode(true, true, true),
            RelayDialMode::GatewayTunnel
        );
    }
}
