use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::mpsc::{self, Sender};
use tokio::sync::oneshot;
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::timeout;
use tokio::time::{sleep, Instant};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::commands::tor_gateway_client::{self, RelayDialMode};
use crate::models::tor::TorState;
use crate::net::NativeNetworkRuntime;

type MaybeTlsStream = tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>;

// Keep native connect command completion bounded below frontend invoke timeout.
// JS connect_relay timeout is 120_000ms (Tor tunnel headroom; dials serialize).
const CONNECT_COMMAND_BUDGET_MS: u64 = 18_000;
// Clearnet connect attempt cap (non-Tor path); Tor uses TOR_TUNNEL_ATTEMPT_TIMEOUT_MS.
const _CLEARNET_CONNECT_ATTEMPT_TIMEOUT_MS: u64 = 8_000;
const _: () = assert!(_CLEARNET_CONNECT_ATTEMPT_TIMEOUT_MS > 0);
/// Tor tunnel path needs headroom for SOCKS + TLS + WS (serialized dials).
const TOR_TUNNEL_CONNECT_BUDGET_MS: u64 = 50_000;
const TOR_TUNNEL_ATTEMPT_TIMEOUT_MS: u64 = 25_000;
/// Timeout/IO only — hard HTTP rejects fail the invoke immediately (4b-3 thrash cut).
const TOR_CONNECT_RETRY_DELAY_MS: u64 = 3_000;
/// After CF/edge 403/429/5xx, pause all Tor tunnel dials so the pool cannot stampede.
const TOR_HARD_REJECT_COOLDOWN_MS: u64 = 45_000;
	const RELAY_WRITE_SEND_TIMEOUT_MS: u64 = 4_000;
	/// Batch high-frequency EVENT frames before webview emit (Slice 1–2 lag / PostMessage).
	const RELAY_EVENT_COALESCE_MS: u64 = 50;
	const RELAY_EVENT_COALESCE_MAX: usize = 24;
	/// Hard bound — drop oldest EVENTs when JS cannot keep up (Slice 2).
	const RELAY_EVENT_HARD_CAP: usize = 72;

fn tor_tunnel_dial_gate() -> &'static AsyncMutex<()> {
    static GATE: OnceLock<AsyncMutex<()>> = OnceLock::new();
    GATE.get_or_init(|| AsyncMutex::new(()))
}

/// Serialize all relay dials (clearnet + Tor) so unlock cannot stampede WebView2 / heap.
fn relay_dial_gate() -> &'static AsyncMutex<()> {
    static GATE: OnceLock<AsyncMutex<()>> = OnceLock::new();
    GATE.get_or_init(|| AsyncMutex::new(()))
}

/// v2.0.0-beta: capped Quiet public dials (nos/primal/damus/…).
/// Cap was 0 after pre-thin L2 heap soaks; thin shell + serial dial + EVENT coalesce
/// make a small clearnet pool viable again. Keep ≤2 — not uncapped fan-in.
const QUIET_PUBLIC_DIAL_CAP: usize = 2;
const QUIET_PUBLIC_RELAY_HOSTS: &[&str] = &[
    "relay.damus.io",
    "nos.lol",
    "relay.primal.net",
    "relay.snort.social",
    "relay.nostr.band",
    "groups.fiatjaf.com",
];

fn quiet_public_relay_host(url: &str) -> Option<String> {
    let parsed = url::Url::parse(url).ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();
    QUIET_PUBLIC_RELAY_HOSTS
        .iter()
        .any(|candidate| host == *candidate)
        .then_some(host)
}

/// Host → open Quiet connection refcount (process-wide).
fn quiet_public_host_claims() -> &'static Mutex<HashMap<String, usize>> {
    static CLAIMS: OnceLock<Mutex<HashMap<String, usize>>> = OnceLock::new();
    CLAIMS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn release_quiet_public_host(host: &str) {
    if let Ok(mut claims) = quiet_public_host_claims().lock() {
        if let Some(count) = claims.get_mut(host) {
            if *count <= 1 {
                claims.remove(host);
            } else {
                *count -= 1;
            }
        }
    }
}

fn release_quiet_public_dial_url(url: &str) {
    if let Some(host) = quiet_public_relay_host(url) {
        release_quiet_public_host(&host);
    }
}

/// Quiet host claim — Drop releases unless `commit` (success path holds until disconnect).
struct QuietPublicDialClaim {
    host: Option<String>,
}

impl QuietPublicDialClaim {
    fn try_acquire(url: &str) -> Result<Self, String> {
        let Some(host) = quiet_public_relay_host(url) else {
            return Ok(Self { host: None });
        };
        if QUIET_PUBLIC_DIAL_CAP == 0 {
            println!(
                "[NativeRelay] quiet_dial_cap refused url={} (cap=0 host={})",
                url, host
            );
            return Err("quiet_dial_cap".to_string());
        }
        let mut claims = quiet_public_host_claims()
            .lock()
            .map_err(|_| "quiet_dial_cap_lock".to_string())?;
        if let Some(count) = claims.get_mut(&host) {
            *count = count.saturating_add(1);
            println!(
                "[NativeRelay] quiet_dial_cap reuse host={} refs={}",
                host, count
            );
            return Ok(Self { host: Some(host) });
        }
        if claims.len() >= QUIET_PUBLIC_DIAL_CAP {
            println!(
                "[NativeRelay] quiet_dial_cap refused url={} (cap={} hosts={:?})",
                url,
                QUIET_PUBLIC_DIAL_CAP,
                claims.keys().collect::<Vec<_>>()
            );
            return Err("quiet_dial_cap".to_string());
        }
        println!("[NativeRelay] quiet_dial_cap chose host={}", host);
        claims.insert(host.clone(), 1);
        Ok(Self { host: Some(host) })
    }

    /// Keep claim until `release_quiet_public_dial_url` on disconnect.
    fn commit(self) {
        std::mem::forget(self);
    }
}

impl Drop for QuietPublicDialClaim {
    fn drop(&mut self) {
        if let Some(host) = self.host.take() {
            release_quiet_public_host(&host);
        }
    }
}

fn tor_hard_reject_cooldown_until_ms() -> &'static AtomicU64 {
    static UNTIL: OnceLock<AtomicU64> = OnceLock::new();
    UNTIL.get_or_init(|| AtomicU64::new(0))
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn tor_hard_reject_cooldown_remaining_ms() -> Option<u64> {
    let until = tor_hard_reject_cooldown_until_ms().load(Ordering::Relaxed);
    let now = now_unix_ms();
    if until > now {
        Some(until - now)
    } else {
        None
    }
}

fn arm_tor_hard_reject_cooldown() {
    let until = now_unix_ms().saturating_add(TOR_HARD_REJECT_COOLDOWN_MS);
    tor_hard_reject_cooldown_until_ms().store(until, Ordering::Relaxed);
}

fn enqueue_relay_message(tx: &Sender<Message>, message: Message) -> Result<(), String> {
    match tx.try_send(message) {
        Ok(()) => Ok(()),
        Err(TrySendError::Closed(_)) => Err("Not connected".to_string()),
        Err(TrySendError::Full(_)) => Err("Relay send queue saturated".to_string()),
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RelayProbeReport {
    pub url: String,
    pub scheme: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub tor_enabled: bool,
    pub proxy_url: Option<String>,
    pub dns_ok: bool,
    pub dns_results: Vec<String>,
    pub tcp_ok: bool,
    pub ws_ok: bool,
    pub error: Option<String>,
}

fn format_ws_error_details(err: &tokio_tungstenite::tungstenite::Error) -> String {
    use tokio_tungstenite::tungstenite::Error;
    match err {
        Error::Http(response) => {
            let status = response.status();
            let headers = response.headers();
            format!("HTTP error: {} headers={:?}", status, headers)
        }
        _ => err.to_string(),
    }
}

fn format_ws_connect_error(err: &tokio_tungstenite::tungstenite::Error) -> String {
    use tokio_tungstenite::tungstenite::Error;
    match err {
        Error::Http(response) => {
            let status = response.status();
            let headers = response.headers();
            format!("HTTP error: {} headers={:?}", status, headers)
        }
        _ => err.to_string(),
    }
}

/// Cloudflare / edge rejects (403/429/5xx) do not heal on sub-second retries over Tor.
fn is_hard_http_reject(err: &tokio_tungstenite::tungstenite::Error) -> bool {
    use tokio_tungstenite::tungstenite::Error;
    match err {
        Error::Http(response) => {
            let code = response.status().as_u16();
            code == 403 || code == 429 || code >= 500
        }
        _ => false,
    }
}

/// SOCKS connect timeout / gateway tunnel refusal — retrying in-invoke only queues the pool.
fn is_tor_tunnel_no_retry(err: &tokio_tungstenite::tungstenite::Error) -> bool {
    if is_hard_http_reject(err) {
        return true;
    }
    let message = err.to_string().to_ascii_lowercase();
    message.contains("socks_connect")
        || message.contains("socks connect timed out")
        || message.contains("tor_not_ready")
}

#[tauri::command]
pub async fn probe_relay(
    net_runtime: State<'_, NativeNetworkRuntime>,
    url: String,
) -> Result<RelayProbeReport, String> {
    if crate::perf_plane::is_local() {
        crate::invoke_pressure::note_invoke("perf_plane:reject:probe_relay");
        return Err(crate::perf_plane::reject_message("probe_relay"));
    }
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    let scheme = parsed.scheme().to_string();
    let host = parsed.host_str().map(|s| s.to_string());
    let port = parsed.port_or_known_default();
    let tor_enabled = net_runtime.is_tor_enabled();
    let proxy_url = if tor_enabled {
        Some(net_runtime.get_proxy_url())
    } else {
        None
    };

    let mut report = RelayProbeReport {
        url: url.clone(),
        scheme,
        host: host.clone(),
        port,
        tor_enabled,
        proxy_url,
        dns_ok: false,
        dns_results: Vec::new(),
        tcp_ok: false,
        ws_ok: false,
        error: None,
    };

    let Some(host_value) = host else {
        report.error = Some("Relay URL missing host".to_string());
        return Ok(report);
    };
    let Some(port_value) = port else {
        report.error = Some("Relay URL missing port".to_string());
        return Ok(report);
    };

    let dns_lookup = timeout(
        Duration::from_secs(5),
        tokio::net::lookup_host((host_value.as_str(), port_value)),
    )
    .await;
    match dns_lookup {
        Ok(Ok(addrs)) => {
            let results: Vec<String> = addrs.map(|a| a.to_string()).collect();
            report.dns_ok = !results.is_empty();
            report.dns_results = results;
        }
        Ok(Err(e)) => {
            report.error = Some(format!("DNS failed: {}", e));
            return Ok(report);
        }
        Err(_) => {
            report.error = Some("DNS timeout".to_string());
            return Ok(report);
        }
    }

    let tcp_connect = timeout(
        Duration::from_secs(5),
        tokio::net::TcpStream::connect((host_value.as_str(), port_value)),
    )
    .await;
    match tcp_connect {
        Ok(Ok(_stream)) => {
            report.tcp_ok = true;
        }
        Ok(Err(e)) => {
            report.error = Some(format!("TCP connect failed: {}", e));
            return Ok(report);
        }
        Err(_) => {
            report.error = Some("TCP connect timeout".to_string());
            return Ok(report);
        }
    }

    let ws_connect = timeout(
        Duration::from_secs(10),
        net_runtime.connect_websocket(&parsed),
    )
    .await;
    match ws_connect {
        Ok(Ok(mut ws)) => {
            report.ws_ok = true;
            let _ = ws.close(None).await;
        }
        Ok(Err(e)) => {
            report.error = Some(format!(
                "WS connect failed: {}",
                format_ws_error_details(&e)
            ));
        }
        Err(_) => {
            report.error = Some("WS connect timeout".to_string());
        }
    }

    Ok(report)
}

// Type alias for Relay URL
type RelayUrl = String;
type PendingAckKey = (String, RelayUrl, String);

#[derive(Debug)]
pub struct RelayPublishAck {
    pub ok: bool,
    pub message: Option<String>,
}

struct PendingRelayAck {
    sender: oneshot::Sender<RelayPublishAck>,
}

// Message structure used for IPC communication
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RelayMessage {
    pub relay_url: String,
    pub payload: Value, // Raw JSON message from relay
}

/// Batched EVENT frames — one PostMessage for many relay EVENTs (JS fans out).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RelayEventBatch {
    pub relay_url: String,
    pub payloads: Vec<Value>,
}

fn relay_payload_type(value: &Value) -> Option<&str> {
    value
        .as_array()
        .and_then(|array| array.first())
        .and_then(Value::as_str)
}

/// EVENT frames coalesce; OK / EOSE / NOTICE / other flush immediately.
fn should_coalesce_relay_payload(value: &Value) -> bool {
    matches!(relay_payload_type(value), Some("EVENT"))
}

fn emit_relay_event_to_window(
    app: &AppHandle,
    window_label: &str,
    relay_url: &str,
    payload: Value,
) {
    if let Some(window) = app.get_webview_window(window_label) {
        crate::emit_pressure::note_webview_emit("relay-event");
        let _ = window.emit(
            "relay-event",
            RelayMessage {
                relay_url: relay_url.to_string(),
                payload,
            },
        );
    }
}

fn flush_coalesced_relay_events(
    app: &AppHandle,
    window_label: &str,
    relay_url: &str,
    pending: &mut Vec<Value>,
) {
    if pending.is_empty() {
        return;
    }
    let Some(window) = app.get_webview_window(window_label) else {
        pending.clear();
        return;
    };
    if pending.len() == 1 {
        let payload = pending.pop().expect("len checked");
        crate::emit_pressure::note_webview_emit("relay-event");
        let _ = window.emit(
            "relay-event",
            RelayMessage {
                relay_url: relay_url.to_string(),
                payload,
            },
        );
        return;
    }
    let payloads = std::mem::take(pending);
    crate::emit_pressure::note_webview_emit("relay-event-batch");
    let _ = window.emit(
        "relay-event-batch",
        RelayEventBatch {
            relay_url: relay_url.to_string(),
            payloads,
        },
    );
}

// Persistent state for a relay (survives disconnections)
#[derive(Default)]
struct RelayState {
    subscriptions: HashMap<String, Value>, // sub_id -> filters
}

// Active relay connection (ephemeral)
struct RelayConnection {
    tx: Sender<Message>,
}

struct DialInFlightGuard {
    connecting: Arc<Mutex<HashSet<(String, String)>>>,
    key: (String, String),
}

impl Drop for DialInFlightGuard {
    fn drop(&mut self) {
        if let Ok(mut connecting) = self.connecting.lock() {
            connecting.remove(&self.key);
        }
    }
}

// Manage all relay connections and their persistent states
pub struct RelayPool {
    // Keys are (window_label, relay_url)
    connections: Arc<Mutex<HashMap<(String, RelayUrl), RelayConnection>>>,
    states: Arc<Mutex<HashMap<(String, RelayUrl), RelayState>>>,
    pending_acks: Arc<Mutex<HashMap<PendingAckKey, PendingRelayAck>>>,
    /// In-flight dials — blocks concurrent duplicate connect_relay for same key.
    connecting: Arc<Mutex<HashSet<(String, String)>>>,
}

impl RelayPool {
    pub fn new() -> Self {
        RelayPool {
            connections: Arc::new(Mutex::new(HashMap::new())),
            states: Arc::new(Mutex::new(HashMap::new())),
            pending_acks: Arc::new(Mutex::new(HashMap::new())),
            connecting: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub async fn publish_event_with_ack(
        &self,
        window_label: &str,
        relay_url: &str,
        event_json: Value,
        ack_timeout: Duration,
    ) -> Result<RelayPublishAck, String> {
        let event_id = extract_event_id(&event_json)?;
        let key = (window_label.to_string(), relay_url.to_string());
        let tx = {
            let connections = self.connections.lock().unwrap();
            connections
                .get(&key)
                .map(|connection| connection.tx.clone())
        };
        let Some(tx) = tx else {
            return Err("No writable relay connection".to_string());
        };

        let pending_key = (window_label.to_string(), relay_url.to_string(), event_id);
        let (ack_tx, ack_rx) = oneshot::channel::<RelayPublishAck>();
        {
            let mut pending_acks = self.pending_acks.lock().unwrap();
            if let Some(previous) = pending_acks.remove(&pending_key) {
                let _ = previous.sender.send(RelayPublishAck {
                    ok: false,
                    message: Some("Superseded by a newer publish attempt.".to_string()),
                });
            }
            pending_acks.insert(pending_key.clone(), PendingRelayAck { sender: ack_tx });
        }

        let payload = serde_json::json!(["EVENT", event_json]);
        if let Err(error) = enqueue_relay_message(&tx, Message::Text(payload.to_string().into())) {
            let mut pending_acks = self.pending_acks.lock().unwrap();
            pending_acks.remove(&pending_key);
            return Err(error);
        }

        match timeout(ack_timeout, ack_rx).await {
            Ok(Ok(ack)) => {
                if ack.ok {
                    Ok(ack)
                } else {
                    Err(ack
                        .message
                        .unwrap_or_else(|| "Relay rejected event (NIP-20 OK=false).".to_string()))
                }
            }
            Ok(Err(_)) => Err("Relay acknowledgement channel closed.".to_string()),
            Err(_) => {
                let mut pending_acks = self.pending_acks.lock().unwrap();
                pending_acks.remove(&pending_key);
                Err("Timeout waiting for OK response".to_string())
            }
        }
    }
}

fn extract_event_id(event_json: &Value) -> Result<String, String> {
    let Some(event_id) = event_json.get("id").and_then(Value::as_str) else {
        return Err("Malformed event payload: missing event id".to_string());
    };
    if event_id.trim().is_empty() {
        return Err("Malformed event payload: empty event id".to_string());
    }
    Ok(event_id.to_string())
}

fn parse_ok_payload(value: &Value) -> Option<(String, bool, Option<String>)> {
    let array = value.as_array()?;
    if array.first()?.as_str()? != "OK" {
        return None;
    }
    let event_id = array.get(1)?.as_str()?.to_string();
    let ok = array.get(2).and_then(Value::as_bool).unwrap_or(false);
    let message = array
        .get(3)
        .and_then(Value::as_str)
        .map(|raw| raw.to_string())
        .filter(|raw| !raw.trim().is_empty());
    Some((event_id, ok, message))
}

fn resolve_pending_ack(
    pending_acks: &Arc<Mutex<HashMap<PendingAckKey, PendingRelayAck>>>,
    window_label: &str,
    relay_url: &str,
    event_id: &str,
    ok: bool,
    message: Option<String>,
) {
    let key = (
        window_label.to_string(),
        relay_url.to_string(),
        event_id.to_string(),
    );
    let sender = {
        let mut pending = pending_acks.lock().unwrap();
        pending.remove(&key).map(|entry| entry.sender)
    };
    if let Some(sender) = sender {
        let _ = sender.send(RelayPublishAck { ok, message });
    }
}

fn fail_pending_acks_for_scope_relay(
    pending_acks: &Arc<Mutex<HashMap<PendingAckKey, PendingRelayAck>>>,
    window_label: &str,
    relay_url: &str,
    message: &str,
) {
    let keys = {
        let pending = pending_acks.lock().unwrap();
        pending
            .keys()
            .filter(|(scope, url, _)| scope == window_label && url == relay_url)
            .cloned()
            .collect::<Vec<_>>()
    };
    if keys.is_empty() {
        return;
    }
    let mut pending = pending_acks.lock().unwrap();
    for key in keys {
        if let Some(entry) = pending.remove(&key) {
            let _ = entry.sender.send(RelayPublishAck {
                ok: false,
                message: Some(message.to_string()),
            });
        }
    }
}

// Command: Connect to a relay
// Internal: Connect to a relay for a specific window (also used by mesh configure RUST-1b).
pub(crate) async fn connect_relay_internal(
    app: AppHandle,
    window_label: String,
    url: String,
    state: State<'_, RelayPool>,
    _net_runtime: State<'_, NativeNetworkRuntime>,
    tor_state: State<'_, TorState>,
) -> Result<String, String> {
    let key = (window_label.clone(), url.clone());

    // Check if already connected
    {
        let connections = state.connections.lock().unwrap();
        if connections.contains_key(&key) {
            if let Some(window) = app.get_webview_window(&window_label) {
                crate::emit_pressure::note_webview_emit("relay-status");
                let _ = window.emit(
                    "relay-status",
                    serde_json::json!({
                        "url": url,
                        "status": "connected"
                    }),
                );
            }
            return Ok("Already connected".to_string());
        }
    }

    {
        let mut connecting = state.connecting.lock().unwrap();
        if connecting.contains(&key) {
            return Ok("Connect already in progress".to_string());
        }
        connecting.insert(key.clone());
    }
    let _dial_guard = DialInFlightGuard {
        connecting: state.connecting.clone(),
        key: key.clone(),
    };
    // Slice 2: one dial at a time — parallel public Quiet dials correlated with heap corruption.
    let _dial_serial = relay_dial_gate().lock().await;
    // Cap Quiet public-default hosts process-wide (JS multi-mount cannot bypass).
    let quiet_claim = QuietPublicDialClaim::try_acquire(&url)?;

    // Parse URL
    let relay_url = url::Url::parse(&url).map_err(|e| e.to_string())?;

    let enable_tor_preference = tor_state
        .settings
        .lock()
        .map(|s| s.enable_tor)
        .unwrap_or(false);

    let (gateway_reachable, bootstrap_ready) = if enable_tor_preference {
        match tor_gateway_client::status().await {
            Ok(gw) => (true, gw.bootstrap_ready),
            Err(err) => {
                println!("[NativeRelay] gateway status failed: {err}");
                (false, false)
            }
        }
    } else {
        (false, false)
    };

    let dial_mode = tor_gateway_client::resolve_relay_dial_mode(
        enable_tor_preference,
        gateway_reachable,
        bootstrap_ready,
    );

    println!("[NativeRelay] connect_relay url={}", url);
    println!(
        "[NativeRelay] Tor preference={} dial_mode={:?} (UI SOCKS armed=false)",
        enable_tor_preference, dial_mode
    );

    let emit_error = |message: &str| {
        if let Some(window) = app.get_webview_window(&window_label) {
            crate::emit_pressure::note_webview_emit("relay-status");
            let _ = window.emit(
                "relay-status",
                serde_json::json!({
                    "url": url,
                    "status": "error",
                    "error": message
                }),
            );
        }
    };

    // Attempt connection
    let ws_stream: tokio_tungstenite::WebSocketStream<MaybeTlsStream> = match dial_mode {
        RelayDialMode::FailClosedGatewayDown => {
            let message = format!(
                "tor gateway unreachable at {} — run `pnpm dev:tor-gateway`",
                tor_gateway_client::gateway_base_url()
            );
            emit_error(&message);
            return Err(message);
        }
        RelayDialMode::FailClosedTorNotReady => {
            let message =
                "tor gateway not Bootstrapped 100% — waiting before relay WS via tunnel".to_string();
            emit_error(&message);
            return Err(message);
        }
        RelayDialMode::GatewayTunnel => {
            println!("[NativeRelay] Relay scheme={} via gateway tunnel", relay_url.scheme());
            if let Some(remaining_ms) = tor_hard_reject_cooldown_remaining_ms() {
                let message = format!(
                    "tor tunnel cooling down after edge reject ({}ms remaining)",
                    remaining_ms
                );
                println!("[NativeRelay] {message}");
                emit_error(&message);
                return Err(message);
            }
            if let Some(window) = app.get_webview_window(&window_label) {
                crate::emit_pressure::note_webview_emit("relay-status");
                let _ = window.emit(
                    "relay-status",
                    serde_json::json!({
                        "url": url,
                        "status": "starting"
                    }),
                );
            }
            // Serialize Tor dials per attempt only — do not hold the gate across retries
            // (one relay's CF 503 storm must not block the rest of the pool for 50s).
            let budget = Duration::from_millis(TOR_TUNNEL_CONNECT_BUDGET_MS);
            let attempt_timeout_cap = Duration::from_millis(TOR_TUNNEL_ATTEMPT_TIMEOUT_MS);
            let retry_delay = Duration::from_millis(TOR_CONNECT_RETRY_DELAY_MS);
            let deadline = Instant::now() + budget;
            let mut attempts: u32 = 0;
            let mut last_error_message: Option<String> = None;
            let mut connected_stream: Option<tokio_tungstenite::WebSocketStream<MaybeTlsStream>> =
                None;
            while Instant::now() < deadline {
                attempts = attempts.saturating_add(1);
                let remaining = deadline.saturating_duration_since(Instant::now());
                let attempt_timeout = remaining.min(attempt_timeout_cap);
                let attempt_result = {
                    let _tor_dial_guard = tor_tunnel_dial_gate().lock().await;
                    timeout(
                        attempt_timeout,
                        NativeNetworkRuntime::connect_websocket_via_gateway_tunnel(&relay_url),
                    )
                    .await
                };
                match attempt_result {
                    Ok(Ok(stream)) => {
                        println!("[NativeRelay] Tor tunnel connected {}", url);
                        connected_stream = Some(stream);
                        last_error_message = None;
                        break;
                    }
                    Ok(Err(err)) => {
                        let error_message = format_ws_connect_error(&err);
                        println!(
                            "[NativeRelay] Tor tunnel connect attempt {} failed: {}",
                            attempts, error_message
                        );
                        last_error_message = Some(error_message);
                        if is_hard_http_reject(&err) {
                            // Edge reject — pause the whole Tor dial pool; do not stampede CF.
                            arm_tor_hard_reject_cooldown();
                            break;
                        }
                        if is_tor_tunnel_no_retry(&err) {
                            // SOCKS timeout: fail this invoke; let JS backoff instead of
                            // holding the dial gate for a second 12s+ Tor attempt.
                            break;
                        }
                    }
                    Err(_) => {
                        let error_message =
                            format!("attempt timed out after {}ms", attempt_timeout.as_millis());
                        println!(
                            "[NativeRelay] Tor tunnel connect attempt {} failed: {}",
                            attempts, error_message
                        );
                        last_error_message = Some(error_message);
                    }
                }

                if Instant::now() + retry_delay >= deadline {
                    break;
                }
                sleep(retry_delay).await;
            }
            if let Some(stream) = connected_stream {
                stream
            } else {
                let message =
                    last_error_message.unwrap_or_else(|| "Unknown Tor tunnel error".to_string());
                let final_error = format!(
                    "Tor gateway tunnel connect failed after {} attempt(s) within {}ms: {}",
                    attempts, TOR_TUNNEL_CONNECT_BUDGET_MS, message
                );
                emit_error(&final_error);
                return Err(final_error);
            }
        }
        RelayDialMode::Clearnet => {
            let connect_timeout = Duration::from_millis(CONNECT_COMMAND_BUDGET_MS);
            match timeout(connect_timeout, connect_async(relay_url.as_str())).await {
                Ok(Ok((stream, _response))) => stream,
                Ok(Err(e)) => {
                    let message = format_ws_connect_error(&e);
                    emit_error(&message);
                    return Err(message);
                }
                Err(_) => {
                    let message =
                        format!("Connect timed out after {}ms", CONNECT_COMMAND_BUDGET_MS);
                    emit_error(&message);
                    return Err(message);
                }
            }
        }
    };

    let (mut write, read) = ws_stream.split();
    let (tx, mut rx) = mpsc::channel::<Message>(32);

    // Spawn write task (Messages from app -> Relay)
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            match timeout(
                Duration::from_millis(RELAY_WRITE_SEND_TIMEOUT_MS),
                write.send(msg),
            )
            .await
            {
                Ok(Ok(())) => {}
                Ok(Err(_)) => break,
                Err(_) => {
                    println!(
                        "[NativeRelay] write loop send timed out after {}ms",
                        RELAY_WRITE_SEND_TIMEOUT_MS
                    );
                    break;
                }
            }
        }
    });

    // Spawn read task (Messages from Relay -> App)
    let app_handle = app.clone();
    let connections_clone = state.connections.clone();
    let pending_acks_clone = state.pending_acks.clone();
    let win_label_loop = window_label.clone();
    let read_url = url.clone();
    let control_tx = tx.clone();

    tokio::spawn(async move {
        let mut read_stream = read;
        let mut pending_events: Vec<Value> = Vec::new();
        let coalesce = Duration::from_millis(RELAY_EVENT_COALESCE_MS);

        loop {
            let next_msg = if pending_events.is_empty() {
                read_stream.next().await
            } else {
                tokio::select! {
                    msg = read_stream.next() => msg,
                    _ = sleep(coalesce) => {
                        flush_coalesced_relay_events(
                            &app_handle,
                            &win_label_loop,
                            &read_url,
                            &mut pending_events,
                        );
                        continue;
                    }
                }
            };

            let Some(msg) = next_msg else {
                break;
            };

            match msg {
                Ok(Message::Text(text)) => {
                    if let Ok(json) = serde_json::from_str::<Value>(&text) {
                        if let Some((event_id, ok, message)) = parse_ok_payload(&json) {
                            resolve_pending_ack(
                                &pending_acks_clone,
                                &win_label_loop,
                                &read_url,
                                &event_id,
                                ok,
                                message,
                            );
                        }
                        if should_coalesce_relay_payload(&json) {
                            pending_events.push(json);
                            if pending_events.len() >= RELAY_EVENT_COALESCE_MAX {
                                flush_coalesced_relay_events(
                                    &app_handle,
                                    &win_label_loop,
                                    &read_url,
                                    &mut pending_events,
                                );
                            }
                            if pending_events.len() >= RELAY_EVENT_HARD_CAP {
                                let drop_n = pending_events.len() / 2;
                                pending_events.drain(0..drop_n);
                                eprintln!(
                                    "[NativeRelay] dropped {} coalesced EVENTs under emit pressure url={}",
                                    drop_n, read_url
                                );
                            }
                        } else {
                            flush_coalesced_relay_events(
                                &app_handle,
                                &win_label_loop,
                                &read_url,
                                &mut pending_events,
                            );
                            emit_relay_event_to_window(
                                &app_handle,
                                &win_label_loop,
                                &read_url,
                                json,
                            );
                        }
                    }
                }
                Ok(Message::Ping(payload)) => {
                    // Keep relay sessions alive by explicitly answering ping frames.
                    // Native tungstenite paths do not have browser-level automatic control-frame handling.
                    if control_tx.send(Message::Pong(payload)).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Pong(_)) => {
                    // Control-frame heartbeat acknowledgement, no routing needed.
                }
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }

        flush_coalesced_relay_events(
            &app_handle,
            &win_label_loop,
            &read_url,
            &mut pending_events,
        );

        // Cleanup on disconnect
        fail_pending_acks_for_scope_relay(
            &pending_acks_clone,
            &win_label_loop,
            &read_url,
            "Relay disconnected before OK response",
        );

        if let Some(window) = app_handle.get_webview_window(&win_label_loop) {
            crate::emit_pressure::note_webview_emit("relay-status");
            let _ = window.emit(
                "relay-status",
                serde_json::json!({
                    "url": read_url,
                    "status": "disconnected"
                }),
            );
        }

        // Remove from pool
        let mut connections = connections_clone.lock().unwrap();
        connections.remove(&(win_label_loop.clone(), read_url.clone()));
        release_quiet_public_dial_url(&read_url);
    });

    // Add to pool
    {
        let mut connections = state.connections.lock().unwrap();
        connections.insert(
            (window_label.clone(), url.clone()),
            RelayConnection { tx: tx.clone() },
        );
    }
    // Keep Quiet slot until disconnect / read-loop exit.
    quiet_claim.commit();

    // Auto-resubscribe from persistent state
    let subs_to_re = {
        let states = state.states.lock().unwrap();
        states
            .get(&key)
            .map(|s| s.subscriptions.clone())
            .unwrap_or_default()
    };

    for (sub_id, filter) in subs_to_re {
        let msg_json = serde_json::json!(["REQ", sub_id, filter]);
        let _ = enqueue_relay_message(&tx, Message::Text(msg_json.to_string().into()));
        println!("Auto-resubscribed to {} on {}", sub_id, url);
    }

    if let Some(window) = app.get_webview_window(&window_label) {
        crate::emit_pressure::note_webview_emit("relay-status");
        let _ = window.emit(
            "relay-status",
            serde_json::json!({
                "url": url,
                "status": "connected"
            }),
        );
    }

    Ok("Connected".to_string())
}

#[tauri::command]
pub async fn connect_relay(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, RelayPool>,
    net_runtime: State<'_, NativeNetworkRuntime>,
    tor_state: State<'_, TorState>,
    url: String,
) -> Result<String, String> {
    if crate::perf_plane::is_local() {
        crate::invoke_pressure::note_invoke("perf_plane:reject:connect_relay");
        return Err(crate::perf_plane::reject_message("connect_relay"));
    }
    connect_relay_internal(
        app,
        window.label().to_string(),
        url,
        state,
        net_runtime,
        tor_state,
    )
    .await
}

// Command: Disconnect from a relay
#[tauri::command]
pub async fn disconnect_relay(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, RelayPool>,
    url: String,
) -> Result<String, String> {
    let window_label = window.label().to_string();
    let key = (window_label.clone(), url.clone());

    let tx = {
        let mut connections = state.connections.lock().unwrap();
        connections.remove(&key).map(|c| c.tx)
    };

    if let Some(tx) = tx {
        fail_pending_acks_for_scope_relay(
            &state.pending_acks,
            &window_label,
            &url,
            "Relay disconnected before OK response",
        );
        // Sending Close message will terminate the read loop eventually;
        // Quiet host claim is released in the read-loop cleanup (not here).
        let _ = tx.send(Message::Close(None)).await;
        if let Some(window) = app.get_webview_window(&window_label) {
            crate::emit_pressure::note_webview_emit("relay-status");
            let _ = window.emit(
                "relay-status",
                serde_json::json!({
                    "url": url,
                    "status": "disconnected"
                }),
            );
        }
        Ok("Disconnected".to_string())
    } else {
        Err("Not connected".to_string())
    }
}

#[tauri::command]
pub async fn recycle_relays(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, RelayPool>,
    net_runtime: State<'_, NativeNetworkRuntime>,
    tor_state: State<'_, TorState>,
) -> Result<String, String> {
    let window_label = window.label().to_string();

    let mut reconnect_urls: HashSet<String> = {
        let states = state.states.lock().unwrap();
        states
            .iter()
            .filter_map(|((w, u), _)| {
                if w == &window_label {
                    Some(u.clone())
                } else {
                    None
                }
            })
            .collect()
    };

    {
        let connections = state.connections.lock().unwrap();
        connections
            .iter()
            .filter(|((w, _), _)| w == &window_label)
            .for_each(|((_, url), _)| {
                reconnect_urls.insert(url.clone());
            });
    };

    let active_connections: Vec<(String, Sender<Message>)> = {
        let mut connections = state.connections.lock().unwrap();
        let mut to_remove = Vec::new();
        for ((w, u), _) in connections.iter() {
            if w == &window_label {
                to_remove.push((w.clone(), u.clone()));
            }
        }

        let mut results = Vec::new();
        for key in to_remove {
            if let Some(conn) = connections.remove(&key) {
                results.push((key.1, conn.tx));
            }
        }
        results
    };

    for (url, tx) in active_connections {
        fail_pending_acks_for_scope_relay(
            &state.pending_acks,
            &window_label,
            &url,
            "Relay recycled before OK response",
        );
        let _ = tx.send(Message::Close(None)).await;
        if let Some(window) = app.get_webview_window(&window_label) {
            crate::emit_pressure::note_webview_emit("relay-status");
            let _ = window.emit(
                "relay-status",
                serde_json::json!({
                    "url": url,
                    "status": "disconnected"
                }),
            );
        }
    }

    for url in reconnect_urls {
        let _ = connect_relay_internal(
            app.clone(),
            window_label.clone(),
            url.clone(),
            state.clone(),
            net_runtime.clone(),
            tor_state.clone(),
        )
        .await;
    }

    Ok("Recycled profile relay connections".to_string())
}

#[tauri::command]
pub async fn subscribe_relay(
    window: WebviewWindow,
    state: State<'_, RelayPool>,
    url: String,
    sub_id: String,
    filter: Value,
) -> Result<String, String> {
    let key = (window.label().to_string(), url.clone());

    // 1. Update persistent state
    {
        let mut states = state.states.lock().unwrap();
        let relay_state = states.entry(key.clone()).or_default();
        relay_state
            .subscriptions
            .insert(sub_id.clone(), filter.clone());
    }

    // 2. Send REQ if connected
    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&key).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        let msg_json = serde_json::json!(["REQ", sub_id, filter]);
        enqueue_relay_message(&tx, Message::Text(msg_json.to_string().into()))?;
        Ok("Subscribed (active)".to_string())
    } else {
        Ok("Subscribed (persistent, offline)".to_string())
    }
}

#[tauri::command]
pub async fn unsubscribe_relay(
    window: WebviewWindow,
    state: State<'_, RelayPool>,
    url: String,
    sub_id: String,
) -> Result<String, String> {
    let key = (window.label().to_string(), url);

    // 1. Remove from persistent state
    {
        let mut states = state.states.lock().unwrap();
        if let Some(relay_state) = states.get_mut(&key) {
            relay_state.subscriptions.remove(&sub_id);
        }
    }

    // 2. Send CLOSE if connected
    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&key).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        let msg_json = serde_json::json!(["CLOSE", sub_id]);
        enqueue_relay_message(&tx, Message::Text(msg_json.to_string().into()))?;
        Ok("Unsubscribed (active)".to_string())
    } else {
        Ok("Unsubscribed (persistent, offline)".to_string())
    }
}

// Command: Send Raw Message
#[tauri::command]
pub async fn send_relay_message(
    window: WebviewWindow,
    state: State<'_, RelayPool>,
    url: String,
    message: String,
) -> Result<String, String> {
    let key = (window.label().to_string(), url);
    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&key).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        enqueue_relay_message(&tx, Message::Text(message.into()))?;
        Ok("Sent".to_string())
    } else {
        Err("Not connected".to_string())
    }
}

#[cfg(test)]
mod lag_slice1_tests {
    use super::{relay_payload_type, should_coalesce_relay_payload};
    use serde_json::json;

    #[test]
    fn event_payloads_coalesce() {
        let event = json!(["EVENT", "sub", {"id": "abc"}]);
        assert_eq!(relay_payload_type(&event), Some("EVENT"));
        assert!(should_coalesce_relay_payload(&event));
    }

    #[test]
    fn ok_eose_notice_do_not_coalesce() {
        assert!(!should_coalesce_relay_payload(&json!(["OK", "id", true, ""])));
        assert!(!should_coalesce_relay_payload(&json!(["EOSE", "sub"])));
        assert!(!should_coalesce_relay_payload(&json!(["NOTICE", "hi"])));
    }

    #[test]
    fn slice2_coalesce_bounds_are_tighter_than_slice1() {
        assert!(super::RELAY_EVENT_COALESCE_MAX <= 24);
        assert!(super::RELAY_EVENT_HARD_CAP > super::RELAY_EVENT_COALESCE_MAX);
        assert!(super::RELAY_EVENT_COALESCE_MS >= 50);
    }

    #[test]
    fn quiet_public_host_detection() {
        assert_eq!(
            super::quiet_public_relay_host("wss://nos.lol"),
            Some("nos.lol".to_string())
        );
        assert_eq!(
            super::quiet_public_relay_host("wss://relay.primal.net/"),
            Some("relay.primal.net".to_string())
        );
        assert_eq!(super::quiet_public_relay_host("ws://localhost:7000"), None);
        assert_eq!(super::quiet_public_relay_host("wss://example.com"), None);
    }

    #[test]
    fn quiet_public_dial_cap_is_two_for_beta() {
        assert_eq!(super::QUIET_PUBLIC_DIAL_CAP, 2);
    }

    #[test]
    fn quiet_public_cap_allows_two_hosts_refuses_third_allows_private() {
        if let Ok(mut claims) = super::quiet_public_host_claims().lock() {
            claims.clear();
        }
        let a = super::QuietPublicDialClaim::try_acquire("wss://nos.lol").expect("slot 1");
        let b = super::QuietPublicDialClaim::try_acquire("wss://relay.primal.net").expect("slot 2");
        assert!(super::QuietPublicDialClaim::try_acquire("wss://relay.damus.io").is_err());
        assert!(super::QuietPublicDialClaim::try_acquire("ws://localhost:7000").is_ok());
        // Same host while slots full still reuses.
        let a2 = super::QuietPublicDialClaim::try_acquire("wss://nos.lol").expect("reuse nos");
        drop(a2);
        drop(b);
        drop(a);
        if let Ok(mut claims) = super::quiet_public_host_claims().lock() {
            claims.clear();
        }
    }
}
