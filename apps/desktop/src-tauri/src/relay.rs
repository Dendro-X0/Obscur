use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc::{self, Sender};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use tokio::time::{sleep, Duration};

use crate::net::NetState;

type MaybeTlsStream = tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>;

fn parse_socks5_host_port(proxy_url: &str) -> Option<(String, u16)> {
    let parsed = url::Url::parse(proxy_url).ok()?;
    let scheme = parsed.scheme();
    if scheme != "socks5" && scheme != "socks5h" {
        return None;
    }
    let host = parsed.host_str()?.to_string();
    let port = parsed.port().unwrap_or(9050);
    Some((host, port))
}

fn get_relay_host_port(relay_url: &url::Url) -> Option<(String, u16)> {
    let host = relay_url.host_str()?.to_string();
    let port = relay_url.port_or_known_default()?;
    Some((host, port))
}

async fn connect_relay_via_socks5_wss(
    relay_url: &url::Url,
    proxy_url: &str,
) -> Result<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, tokio_tungstenite::tungstenite::Error> {
    use rustls::RootCertStore;
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    use tokio_tungstenite::tungstenite::Error;
    use tokio_tungstenite::tungstenite::error::UrlError;

    let (proxy_host, proxy_port) = parse_socks5_host_port(proxy_url).ok_or_else(|| {
        Error::Io(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid SOCKS5 proxy URL"))
    })?;
    let (relay_host, relay_port) = get_relay_host_port(relay_url).ok_or_else(|| {
        Error::Url(UrlError::UnableToConnect("Relay URL missing host/port".to_string()))
    })?;

    let socks_stream = tokio_socks::tcp::Socks5Stream::connect((proxy_host.as_str(), proxy_port), (relay_host.as_str(), relay_port))
        .await
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    let tcp_stream = socks_stream.into_inner();

    let mut root_store = RootCertStore::empty();
    let certs_result = rustls_native_certs::load_native_certs();
    for err in certs_result.errors {
        let _ = err;
    }
    for cert in certs_result.certs {
        let _ = root_store.add(cert);
    }

    let tls_config = rustls::ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();
    let connector = tokio_tungstenite::Connector::Rustls(std::sync::Arc::new(tls_config));

    let request = relay_url.as_str().into_client_request()?;
    let (ws_stream, _) = tokio_tungstenite::client_async_tls_with_config(request, tcp_stream, None, Some(connector)).await?;
    Ok(ws_stream)
}

async fn connect_relay_via_socks5_wss_with_retry(
    relay_url: &url::Url,
    proxy_url: &str,
    attempts: u32,
    delay_ms: u64,
) -> Result<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, tokio_tungstenite::tungstenite::Error> {
    let mut last_error: Option<tokio_tungstenite::tungstenite::Error> = None;
    for attempt_index in 0..attempts {
        match connect_relay_via_socks5_wss(relay_url, proxy_url).await {
            Ok(stream) => return Ok(stream),
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
    Err(last_error.unwrap_or_else(|| tokio_tungstenite::tungstenite::Error::Io(
        std::io::Error::new(std::io::ErrorKind::Other, "Unknown Tor connect error")
    )))
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
}

impl RelayPool {
    pub fn new() -> Self {
        RelayPool {
            connections: Arc::new(Mutex::new(HashMap::new())),
            states: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// Command: Connect to a relay
#[tauri::command]
pub async fn connect_relay(
    app: AppHandle,
    state: State<'_, RelayPool>,
    net_state: State<'_, NetState>,
    url: String,
) -> Result<String, String> {
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
    println!("[NativeRelay] Tor enabled={}", net_state.is_tor_enabled());
    if net_state.is_tor_enabled() {
        println!("[NativeRelay] Tor proxy={}", net_state.get_proxy_url());
    }

    // Attempt connection
    let ws_stream: tokio_tungstenite::WebSocketStream<MaybeTlsStream> = if net_state.is_tor_enabled() {
        let proxy_url = net_state.get_proxy_url();
        println!("[NativeRelay] Relay scheme={}", relay_url.scheme());
        let _ = app.emit("relay-status", serde_json::json!({
            "url": url,
            "status": "starting"
        }));
        if relay_url.scheme() == "wss" {
            connect_relay_via_socks5_wss_with_retry(&relay_url, &proxy_url, 30, 1000).await.map_err(|e| {
                let message = format_ws_connect_error(&e);
                let _ = app.emit("relay-status", serde_json::json!({
                    "url": url,
                    "status": "error",
                    "error": format!("Tor proxy connect failed: {}", message)
                }));
                format!("Tor proxy connect failed: {}", message)
            })?
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
