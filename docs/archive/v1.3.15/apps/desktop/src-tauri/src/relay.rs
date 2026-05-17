use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::mpsc::{self, Sender};
use tokio::sync::oneshot;
use tokio::time::timeout;
use tokio::time::{sleep, Instant};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::net::NativeNetworkRuntime;

type MaybeTlsStream = tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>;

// Keep native connect command completion bounded below frontend invoke timeout.
// JS currently times out connect_relay at 20_000ms.
const CONNECT_COMMAND_BUDGET_MS: u64 = 18_000;
const CONNECT_ATTEMPT_TIMEOUT_MS: u64 = 8_000;
const TOR_CONNECT_RETRY_DELAY_MS: u64 = 500;
const RELAY_WRITE_SEND_TIMEOUT_MS: u64 = 4_000;

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

#[tauri::command]
pub async fn probe_relay(
    net_runtime: State<'_, NativeNetworkRuntime>,
    url: String,
) -> Result<RelayProbeReport, String> {
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

// Persistent state for a relay (survives disconnections)
#[derive(Default)]
struct RelayState {
    subscriptions: HashMap<String, Value>, // sub_id -> filters
}

// Active relay connection (ephemeral)
struct RelayConnection {
    tx: Sender<Message>,
}

// Manage all relay connections and their persistent states
pub struct RelayPool {
    // Keys are (window_label, relay_url)
    connections: Arc<Mutex<HashMap<(String, RelayUrl), RelayConnection>>>,
    states: Arc<Mutex<HashMap<(String, RelayUrl), RelayState>>>,
    pending_acks: Arc<Mutex<HashMap<PendingAckKey, PendingRelayAck>>>,
}

impl RelayPool {
    pub fn new() -> Self {
        RelayPool {
            connections: Arc::new(Mutex::new(HashMap::new())),
            states: Arc::new(Mutex::new(HashMap::new())),
            pending_acks: Arc::new(Mutex::new(HashMap::new())),
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
// Internal: Connect to a relay for a specific window
async fn connect_relay_internal(
    app: AppHandle,
    window_label: String,
    url: String,
    state: State<'_, RelayPool>,
    net_runtime: State<'_, NativeNetworkRuntime>,
) -> Result<String, String> {
    let key = (window_label.clone(), url.clone());

    // Check if already connected
    {
        let connections = state.connections.lock().unwrap();
        if connections.contains_key(&key) {
            if let Some(window) = app.get_webview_window(&window_label) {
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

    // Parse URL
    let relay_url = url::Url::parse(&url).map_err(|e| e.to_string())?;

    println!("[NativeRelay] connect_relay url={}", url);
    println!("[NativeRelay] Tor enabled={}", net_runtime.is_tor_enabled());
    if net_runtime.is_tor_enabled() {
        println!("[NativeRelay] Tor proxy={}", net_runtime.get_proxy_url());
    }

    // Attempt connection
    let ws_stream: tokio_tungstenite::WebSocketStream<MaybeTlsStream> = if net_runtime
        .is_tor_enabled()
    {
        println!("[NativeRelay] Relay scheme={}", relay_url.scheme());
        if let Some(window) = app.get_webview_window(&window_label) {
            let _ = window.emit(
                "relay-status",
                serde_json::json!({
                    "url": url,
                    "status": "starting"
                }),
            );
        }
        let budget = Duration::from_millis(CONNECT_COMMAND_BUDGET_MS);
        let attempt_timeout_cap = Duration::from_millis(CONNECT_ATTEMPT_TIMEOUT_MS);
        let retry_delay = Duration::from_millis(TOR_CONNECT_RETRY_DELAY_MS);
        let deadline = Instant::now() + budget;
        let mut attempts: u32 = 0;
        let mut last_error_message: Option<String> = None;
        let mut connected_stream: Option<tokio_tungstenite::WebSocketStream<MaybeTlsStream>> = None;
        while Instant::now() < deadline {
            attempts = attempts.saturating_add(1);
            let remaining = deadline.saturating_duration_since(Instant::now());
            let attempt_timeout = remaining.min(attempt_timeout_cap);
            match timeout(attempt_timeout, net_runtime.connect_websocket(&relay_url)).await {
                Ok(Ok(stream)) => {
                    connected_stream = Some(stream);
                    last_error_message = None;
                    break;
                }
                Ok(Err(err)) => {
                    let error_message = format_ws_connect_error(&err);
                    println!(
                        "[NativeRelay] Tor connect attempt {} failed: {}",
                        attempts, error_message
                    );
                    last_error_message = Some(error_message);
                }
                Err(_) => {
                    let error_message =
                        format!("attempt timed out after {}ms", attempt_timeout.as_millis());
                    println!(
                        "[NativeRelay] Tor connect attempt {} failed: {}",
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
                last_error_message.unwrap_or_else(|| "Unknown Tor connect error".to_string());
            let final_error = format!(
                "Tor proxy connect failed after {} attempt(s) within {}ms: {}",
                attempts, CONNECT_COMMAND_BUDGET_MS, message
            );
            if let Some(window) = app.get_webview_window(&window_label) {
                let _ = window.emit(
                    "relay-status",
                    serde_json::json!({
                        "url": url,
                        "status": "error",
                        "error": final_error
                    }),
                );
            }
            return Err(final_error);
        }
    } else {
        let connect_timeout = Duration::from_millis(CONNECT_COMMAND_BUDGET_MS);
        match timeout(connect_timeout, connect_async(relay_url.as_str())).await {
            Ok(Ok((stream, _response))) => stream,
            Ok(Err(e)) => {
                let message = format_ws_connect_error(&e);
                if let Some(window) = app.get_webview_window(&window_label) {
                    let _ = window.emit(
                        "relay-status",
                        serde_json::json!({
                            "url": url,
                            "status": "error",
                            "error": message
                        }),
                    );
                }
                return Err(message);
            }
            Err(_) => {
                let message = format!("Connect timed out after {}ms", CONNECT_COMMAND_BUDGET_MS);
                if let Some(window) = app.get_webview_window(&window_label) {
                    let _ = window.emit(
                        "relay-status",
                        serde_json::json!({
                            "url": url,
                            "status": "error",
                            "error": message
                        }),
                    );
                }
                return Err(message);
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
        while let Some(msg) = read_stream.next().await {
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
                        if let Some(window) = app_handle.get_webview_window(&win_label_loop) {
                            let _ = window.emit(
                                "relay-event",
                                RelayMessage {
                                    relay_url: read_url.clone(),
                                    payload: json,
                                },
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

        // Cleanup on disconnect
        fail_pending_acks_for_scope_relay(
            &pending_acks_clone,
            &win_label_loop,
            &read_url,
            "Relay disconnected before OK response",
        );

        if let Some(window) = app_handle.get_webview_window(&win_label_loop) {
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
    });

    // Add to pool
    {
        let mut connections = state.connections.lock().unwrap();
        connections.insert(
            (window_label.clone(), url.clone()),
            RelayConnection { tx: tx.clone() },
        );
    }

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
    url: String,
) -> Result<String, String> {
    connect_relay_internal(app, window.label().to_string(), url, state, net_runtime).await
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
        // Sending Close message will terminate the read loop eventually
        let _ = tx.send(Message::Close(None)).await;
        if let Some(window) = app.get_webview_window(&window_label) {
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
        )
        .await;
    }

    Ok("Recycled profile relay connections".to_string())
}

// Command: Publish Event
#[tauri::command]
pub async fn publish_event(
    window: WebviewWindow,
    state: State<'_, RelayPool>,
    url: String,
    event_json: Value,
) -> Result<String, String> {
    // Wrap event in ["EVENT", event_json] as per NIP-01
    let msg_json = serde_json::json!(["EVENT", event_json]);
    let msg_str = msg_json.to_string();
    let key = (window.label().to_string(), url);

    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&key).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        enqueue_relay_message(&tx, Message::Text(msg_str.into()))?;
        Ok("Published".to_string())
    } else {
        Err("Not connected".to_string())
    }
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
