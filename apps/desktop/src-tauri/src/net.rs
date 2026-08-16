use std::sync::Mutex;
use std::time::Duration;

use tokio_tungstenite::tungstenite;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

use crate::commands::tor_gateway_client;

pub struct NativeNetworkRuntime {
    /// Legacy SOCKS arm flag — R4 keeps this **false**; Tor dials use gateway tunnel.
    enable_tor: Mutex<bool>,
    proxy_url: Mutex<String>,
}

impl NativeNetworkRuntime {
    pub fn new(enable_tor: bool, proxy_url: String) -> Self {
        Self {
            enable_tor: Mutex::new(enable_tor),
            proxy_url: Mutex::new(proxy_url),
        }
    }

    pub fn set(&self, enable_tor: bool, proxy_url: String) {
        let mut tor_guard = self.enable_tor.lock().unwrap();
        *tor_guard = enable_tor;
        let mut proxy_guard = self.proxy_url.lock().unwrap();
        *proxy_guard = proxy_url;
    }

    pub fn is_tor_enabled(&self) -> bool {
        *self.enable_tor.lock().unwrap()
    }

    pub fn get_proxy_url(&self) -> String {
        self.proxy_url.lock().unwrap().clone()
    }

    fn build_reqwest_client_base() -> reqwest::ClientBuilder {
        reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(12))
            .timeout(Duration::from_secs(45))
            .pool_idle_timeout(Duration::from_secs(30))
            .tcp_keepalive(Duration::from_secs(15))
    }

    pub fn build_reqwest_client(&self) -> Result<reqwest::Client, reqwest::Error> {
        let mut builder = Self::build_reqwest_client_base();
        if self.is_tor_enabled() {
            let proxy = reqwest::Proxy::all(self.get_proxy_url())?;
            builder = builder.proxy(proxy);
        }
        builder.build()
    }

    pub async fn connect_websocket(
        &self,
        relay_url: &url::Url,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        tungstenite::Error,
    > {
        // R4: SOCKS arm must stay false. Prefer explicit clearnet / tunnel helpers.
        if !self.is_tor_enabled() {
            return Ok(tokio_tungstenite::connect_async(relay_url.as_str())
                .await?
                .0);
        }
        // Forbidden freeze path — do not dial Tor SocksPort from UI.
        Err(tungstenite::Error::Io(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "UI Tor SOCKS dials disabled (R4); use gateway tunnel",
        )))
    }

    /// Slice 4b-2: TLS+WS over gateway loopback tunnel (SOCKS CONNECT in gateway only).
    pub async fn connect_websocket_via_gateway_tunnel(
        relay_url: &url::Url,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        tungstenite::Error,
    > {
        use tokio_tungstenite::tungstenite::error::UrlError;
        use tokio_tungstenite::tungstenite::Error;

        let host = relay_url.host_str().ok_or_else(|| {
            Error::Url(UrlError::UnableToConnect(
                "Relay URL missing host".to_string(),
            ))
        })?;
        let port = relay_url.port_or_known_default().ok_or_else(|| {
            Error::Url(UrlError::UnableToConnect(
                "Relay URL missing port".to_string(),
            ))
        })?;

        let tcp_stream = tor_gateway_client::open_tcp_tunnel(host, port)
            .await
            .map_err(|e| Error::Io(std::io::Error::other(e.to_string())))?;

        match relay_url.scheme() {
            "wss" => Self::client_async_wss(relay_url, tcp_stream).await,
            "ws" => {
                let request = relay_url.as_str().into_client_request()?;
                let (ws_stream, _) = tokio_tungstenite::client_async(
                    request,
                    tokio_tungstenite::MaybeTlsStream::Plain(tcp_stream),
                )
                .await?;
                Ok(ws_stream)
            }
            _ => Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Unsupported relay scheme",
            ))),
        }
    }

    async fn client_async_wss(
        relay_url: &url::Url,
        tcp_stream: tokio::net::TcpStream,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        tungstenite::Error,
    > {
        // rustls-only: native-tls/openssl-sys cannot cross-compile for Android CI
        // (pkg-config / vendored install_dev failures). Tor fingerprint quirks on
        // some CDNs remain a known limit — Tor is not a release gate.
        let request = relay_url.as_str().into_client_request()?;
        let (ws_stream, _) = tokio_tungstenite::client_async_tls_with_config(
            request,
            tcp_stream,
            None,
            None,
        )
        .await?;
        Ok(ws_stream)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "needs obscur-tor-gateway tunnel on :17951 with bootstrapReady"]
    async fn tunnel_wss_nos_lol_smoke() {
        let url = url::Url::parse("wss://nos.lol").expect("url");
        match NativeNetworkRuntime::connect_websocket_via_gateway_tunnel(&url).await {
            Ok(mut ws) => {
                println!("tunnel_wss_nos_lol_smoke: OK (holding 3s)");
                tokio::time::sleep(Duration::from_secs(3)).await;
                let _ = ws.close(None).await;
            }
            Err(err) => panic!("expected WS open via gateway tunnel: {err}"),
        }
    }
}
