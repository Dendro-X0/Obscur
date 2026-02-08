use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc::{self, Sender};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Serialize, Deserialize};
use serde_json::Value;

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

    // Attempt connection
    let (ws_stream, _) = connect_async(relay_url.as_str())
        .await
        .map_err(|e| e.to_string())?;

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
