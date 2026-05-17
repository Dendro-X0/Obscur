use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_socks::tcp::Socks5Stream;
use url::Url;
use tracing::info;

#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

#[derive(Debug, Clone)]
pub struct RelayConfig {
    pub url: String,
    pub proxy_url: Option<String>, // e.g., "127.0.0.1:9050"
}

pub struct RelayClient {
    config: RelayConfig,
    state: Arc<Mutex<ConnectionState>>,
}

impl RelayClient {
    pub fn new(config: RelayConfig) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(ConnectionState::Disconnected)),
        }
    }

    pub async fn get_state(&self) -> ConnectionState {
        self.state.lock().await.clone()
    }

    pub async fn connect(&self) -> Result<(), String> {
        let mut state = self.state.lock().await;
        *state = ConnectionState::Connecting;
        drop(state);

        let url = Url::parse(&self.config.url).map_err(|e| e.to_string())?;

        // Handle Tor Proxy if configured
        if let Some(proxy) = &self.config.proxy_url {
            info!("Connecting to {} via Tor proxy {}", url, proxy);
            let host = url.host_str().ok_or("Invalid host")?.to_string();
            let port = url.port_or_known_default().ok_or("Invalid port")?;

            let _stream = Socks5Stream::connect(proxy.as_str(), (host.as_str(), port))
                .await
                .map_err(|e| format!("SOCKS5 connection failed: {}", e))?;

            info!("SOCKS5 stream established for {}", url);
        }

        // Mocking the actual WebSocket loop for now in the scaffold
        let state_clone = self.state.clone();
        tokio::spawn(async move {
            info!("Relay connection logic spawned (placeholder)");
            let mut s = state_clone.lock().await;
            *s = ConnectionState::Connected;
        });

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_relay_state_transitions() {
        let config = RelayConfig {
            url: "wss://relay.damus.io".to_string(),
            proxy_url: None,
        };
        let client = RelayClient::new(config);
        
        assert_eq!(client.get_state().await, ConnectionState::Disconnected);
        
        client.connect().await.unwrap();
        // Wait a bit for the spawn
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        
        assert_eq!(client.get_state().await, ConnectionState::Connected);
    }
}
