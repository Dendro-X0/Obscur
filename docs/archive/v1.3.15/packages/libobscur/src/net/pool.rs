use crate::net::relay::{RelayClient, RelayConfig};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

pub struct RelayPool {
    relays: Arc<Mutex<Vec<RelayClient>>>,
}

impl RelayPool {
    pub fn new() -> Self {
        Self {
            relays: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn add_relay(&self, config: RelayConfig) -> Result<(), String> {
        let client = RelayClient::new(config);
        client.connect().await?;
        
        let mut relays = self.relays.lock().await;
        relays.push(client);
        
        info!("Relay added to pool. Total relays: {}", relays.len());
        Ok(())
    }

    pub async fn broadcast(&self, message: &str) -> Result<(), String> {
        let _relays = self.relays.lock().await;
        // In a real implementation, loop through relays and send message
        info!("Broadcasting message: {}", message);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pool_management() {
        let pool = RelayPool::new();
        let config = RelayConfig {
            url: "wss://nos.lol".to_string(),
            proxy_url: None,
        };
        
        pool.add_relay(config).await.unwrap();
        pool.broadcast("test message").await.unwrap();
    }
}
