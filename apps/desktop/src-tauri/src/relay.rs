use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc::{self, Sender};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use tokio::time::{sleep, Duration};
use tokio::time::timeout;

use crate::net::NativeNetworkRuntime;

type MaybeTlsStream = tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>;

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
    let proxy_url = if tor_enabled { Some(net_runtime.get_proxy_url()) } else { None };

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

    let dns_lookup = timeout(Duration::from_secs(5), tokio::net::lookup_host((host_value.as_str(), port_value))).await;
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

    let tcp_connect = timeout(Duration::from_secs(5), tokio::net::TcpStream::connect((host_value.as_str(), port_value))).await;
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

    let ws_connect = timeout(Duration::from_secs(10), net_runtime.connect_websocket(&parsed)).await;
    match ws_connect {
        Ok(Ok(mut ws)) => {
            report.ws_ok = true;
            let _ = ws.close(None).await;
        }
        Ok(Err(e)) => {
            report.error = Some(format!("WS connect failed: {}", format_ws_error_details(&e)));
        }
        Err(_) => {
            report.error = Some("WS connect timeout".to_string());
        }
    }

    Ok(report)
}

// Type alias for Relay URL
type RelayUrl = String;

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
    connections: Arc<Mutex<HashMap<RelayUrl, RelayConnection>>>,
    states: Arc<Mutex<HashMap<RelayUrl, RelayState>>>,
    desired: Arc<Mutex<HashSet<RelayUrl>>>,
    reconnect_backoff_exp: Arc<Mutex<HashMap<RelayUrl, u32>>>,
    reconnect_inflight: Arc<Mutex<HashSet<RelayUrl>>>,
}

impl RelayPool {
    pub fn new() -> Self {
        RelayPool {
            connections: Arc::new(Mutex::new(HashMap::new())),
            states: Arc::new(Mutex::new(HashMap::new())),
            desired: Arc::new(Mutex::new(HashSet::new())),
            reconnect_backoff_exp: Arc::new(Mutex::new(HashMap::new())),
            reconnect_inflight: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}

fn compute_backoff_delay(exp: u32) -> Duration {
    const BASE_MS: u64 = 1000;
    const MAX_MS: u64 = 60_000;
    let capped_exp = exp.min(6);
    let multiplier: u64 = 1u64.checked_shl(capped_exp).unwrap_or(u64::MAX);
    let delay_ms = (BASE_MS.saturating_mul(multiplier)).min(MAX_MS);
    Duration::from_millis(delay_ms)
}

fn schedule_reconnect(app: AppHandle, url: String) {
    let pool_state: State<'_, RelayPool> = app.state();

    let should_reconnect = {
        let desired = pool_state.desired.lock().unwrap();
        desired.contains(&url)
    };
    if !should_reconnect {
        return;
    }

    let mut inflight = pool_state.reconnect_inflight.lock().unwrap();
    if inflight.contains(&url) {
        return;
    }
    inflight.insert(url.clone());
    drop(inflight);

    let next_exp = {
        let mut backoff = pool_state.reconnect_backoff_exp.lock().unwrap();
        let current = backoff.get(&url).copied().unwrap_or(0);
        let next = current.saturating_add(1);
        backoff.insert(url.clone(), next);
        next
    };

    let delay = compute_backoff_delay(next_exp);
    println!("[NativeRelay] Scheduling reconnect url={} in {:?}", url, delay);

    tokio::spawn(async move {
        sleep(delay).await;

        let pool_state_inner: State<'_, RelayPool> = app.state();
        let still_desired = {
            let desired = pool_state_inner.desired.lock().unwrap();
            desired.contains(&url)
        };
        if !still_desired {
            let mut inflight2 = pool_state_inner.reconnect_inflight.lock().unwrap();
            inflight2.remove(&url);
            return;
        }

        let net_runtime: State<'_, NativeNetworkRuntime> = app.state();
        let connect_result = connect_relay(app.clone(), pool_state_inner, net_runtime, url.clone()).await;
        if connect_result.is_ok() {
            let pool_binding: State<'_, RelayPool> = app.state();
            let mut backoff = pool_binding.reconnect_backoff_exp.lock().unwrap();
            backoff.remove(&url);
        }

        let pool_binding: State<'_, RelayPool> = app.state();
        let mut inflight2 = pool_binding.reconnect_inflight.lock().unwrap();
        inflight2.remove(&url);
    });
}

// Command: Connect to a relay
#[tauri::command]
pub async fn connect_relay(
    app: AppHandle,
    state: State<'_, RelayPool>,
    net_runtime: State<'_, NativeNetworkRuntime>,
    url: String,
) -> Result<String, String> {
    {
        let mut desired = state.desired.lock().unwrap();
        desired.insert(url.clone());
    }

    // Check if already connected
    {
        let connections = state.connections.lock().unwrap();
        if connections.contains_key(&url) {
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
    let ws_stream: tokio_tungstenite::WebSocketStream<MaybeTlsStream> = if net_runtime.is_tor_enabled() {
        println!("[NativeRelay] Relay scheme={}", relay_url.scheme());
        let _ = app.emit("relay-status", serde_json::json!({
            "url": url,
            "status": "starting"
        }));
        let attempts: u32 = 30;
        let delay_ms: u64 = 1000;
        let mut last_error: Option<tokio_tungstenite::tungstenite::Error> = None;
        let mut connected_stream: Option<tokio_tungstenite::WebSocketStream<MaybeTlsStream>> = None;
        for attempt_index in 0..attempts {
            match net_runtime.connect_websocket(&relay_url).await {
                Ok(stream) => {
                    connected_stream = Some(stream);
                    last_error = None;
                    break;
                }
                Err(err) => {
                    println!(
                        "[NativeRelay] Tor connect attempt {}/{} failed: {}",
                        attempt_index + 1,
                        attempts,
                        format_ws_connect_error(&err)
                    );
                    last_error = Some(err);
                    sleep(Duration::from_millis(delay_ms)).await;
                }
            }
        }
        if let Some(stream) = connected_stream {
            stream
        } else {
            let message = last_error.as_ref().map(format_ws_connect_error).unwrap_or_else(|| "Unknown Tor connect error".to_string());
            let _ = app.emit("relay-status", serde_json::json!({
                "url": url,
                "status": "error",
                "error": format!("Tor proxy connect failed: {}", message)
            }));
            return Err(format!("Tor proxy connect failed: {}", message));
        }
    } else {
        connect_async(relay_url.as_str()).await.map_err(|e| {
            let message = format_ws_connect_error(&e);
            let _ = app.emit("relay-status", serde_json::json!({
                "url": url,
                "status": "error",
                "error": message
            }));
            message
        })?.0
    };

    let (mut write, read) = ws_stream.split();
    let (tx, mut rx) = mpsc::channel::<Message>(32);

    // Spawn write task (Messages from app -> Relay)
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Spawn read task (Messages from Relay -> App)
    let app_handle = app.clone();
    let connections_clone = state.connections.clone();
    
    // We need to keep rx alive or manage connection lifecycle
    // For now, if read fails, we drop the connection
    
    let read_url = url.clone();
    tokio::spawn(async move {
        let mut read_stream = read;
        while let Some(msg) = read_stream.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    // Try to parse JSON
                    if let Ok(json) = serde_json::from_str::<Value>(&text) {
                        let _ = app_handle.emit("relay-event", RelayMessage {
                            relay_url: read_url.clone(),
                            payload: json,
                        });
                    }
                }
                Ok(Message::Close(_)) => {
                    break;
                }
                Err(_) => {
                    break;
                }
                _ => {}
            }
        }
        
        // Cleanup on disconnect
        let _ = app_handle.emit("relay-status", serde_json::json!({
            "url": read_url,
            "status": "disconnected"
        }));
        
        // Remove from pool (requires locking)
        let mut connections = connections_clone.lock().unwrap();
        connections.remove(&read_url);

        schedule_reconnect(app_handle.clone(), read_url);
    });

    // Add to pool
    {
        let mut connections = state.connections.lock().unwrap();
        connections.insert(url.clone(), RelayConnection {
            tx: tx.clone(),
        });
    }

    // Auto-resubscribe from persistent state
    let subs_to_re = {
        let states = state.states.lock().unwrap();
        states.get(&url).map(|s| s.subscriptions.clone()).unwrap_or_default()
    };
    
    for (sub_id, filter) in subs_to_re {
        let msg_json = serde_json::json!(["REQ", sub_id, filter]);
        let _ = tx.send(Message::Text(msg_json.to_string().into())).await;
        println!("Auto-resubscribed to {} on {}", sub_id, url);
    }

    app.emit("relay-status", serde_json::json!({
        "url": url,
        "status": "connected"
    })).unwrap();

    Ok("Connected".to_string())
}

// Command: Disconnect from a relay
#[tauri::command]
pub async fn disconnect_relay(
    app: AppHandle,
    state: State<'_, RelayPool>,
    url: String,
) -> Result<String, String> {
    {
        let mut desired = state.desired.lock().unwrap();
        desired.remove(&url);
    }
    {
        let mut inflight = state.reconnect_inflight.lock().unwrap();
        inflight.remove(&url);
    }
    {
        let mut backoff = state.reconnect_backoff_exp.lock().unwrap();
        backoff.remove(&url);
    }

    let tx = {
        let mut connections = state.connections.lock().unwrap();
        connections.remove(&url).map(|c| c.tx)
    };

    if let Some(tx) = tx {
        // Sending Close message will terminate the read loop eventually
        let _ = tx.send(Message::Close(None)).await;
        app.emit("relay-status", serde_json::json!({
            "url": url,
            "status": "disconnected"
        })).unwrap();
        Ok("Disconnected".to_string())
    } else {
        Err("Not connected".to_string())
    }
}

// Command: Publish Event
#[tauri::command]
pub async fn publish_event(
    state: State<'_, RelayPool>,
    url: String,
    event_json: Value,
) -> Result<String, String> {
    // Wrap event in ["EVENT", event_json] as per NIP-01
    let msg_json = serde_json::json!(["EVENT", event_json]);
    let msg_str = msg_json.to_string();

    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&url).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        tx.send(Message::Text(msg_str.into())).await.map_err(|e| e.to_string())?;
        Ok("Published".to_string())
    } else {
        Err("Not connected".to_string())
    }
}

#[tauri::command]
pub async fn subscribe_relay(
    state: State<'_, RelayPool>,
    url: String,
    sub_id: String,
    filter: Value,
) -> Result<String, String> {
    // 1. Update persistent state
    {
        let mut states = state.states.lock().unwrap();
        let relay_state = states.entry(url.clone()).or_default();
        relay_state.subscriptions.insert(sub_id.clone(), filter.clone());
    }

    // 2. Send REQ if connected
    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&url).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        let msg_json = serde_json::json!(["REQ", sub_id, filter]);
        tx.send(Message::Text(msg_json.to_string().into())).await.map_err(|e| e.to_string())?;
        Ok("Subscribed (active)".to_string())
    } else {
        Ok("Subscribed (persistent, offline)".to_string())
    }
}

#[tauri::command]
pub async fn unsubscribe_relay(
    state: State<'_, RelayPool>,
    url: String,
    sub_id: String,
) -> Result<String, String> {
    // 1. Remove from persistent state
    {
        let mut states = state.states.lock().unwrap();
        if let Some(relay_state) = states.get_mut(&url) {
            relay_state.subscriptions.remove(&sub_id);
        }
    }

    // 2. Send CLOSE if connected
    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&url).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        let msg_json = serde_json::json!(["CLOSE", sub_id]);
        tx.send(Message::Text(msg_json.to_string().into())).await.map_err(|e| e.to_string())?;
        Ok("Unsubscribed (active)".to_string())
    } else {
        Ok("Unsubscribed (persistent, offline)".to_string())
    }
}

// Command: Send Raw Message
#[tauri::command]
pub async fn send_relay_message(
    state: State<'_, RelayPool>,
    url: String,
    message: String,
) -> Result<String, String> {
    let tx = {
        let connections = state.connections.lock().unwrap();
        connections.get(&url).map(|c| c.tx.clone())
    };

    if let Some(tx) = tx {
        tx.send(Message::Text(message.into())).await.map_err(|e| e.to_string())?;
        Ok("Sent".to_string())
    } else {
        Err("Not connected".to_string())
    }
}
