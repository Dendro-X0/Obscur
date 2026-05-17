use std::sync::Mutex;
use std::time::Duration;

use tokio_tungstenite::tungstenite;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

pub struct NativeNetworkRuntime {
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
        if !self.is_tor_enabled() {
            return Ok(tokio_tungstenite::connect_async(relay_url.as_str())
                .await?
                .0);
        }
        let proxy_url = self.get_proxy_url();
        match relay_url.scheme() {
            "wss" => Self::connect_wss_via_socks5(relay_url, &proxy_url).await,
            "ws" => Self::connect_ws_via_socks5(relay_url, &proxy_url).await,
            _ => Err(tungstenite::Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Unsupported relay scheme",
            ))),
        }
    }

    async fn connect_tcp_via_socks5(
        relay_url: &url::Url,
        proxy_url: &str,
    ) -> Result<tokio::net::TcpStream, tungstenite::Error> {
        use tokio_tungstenite::tungstenite::error::UrlError;
        use tokio_tungstenite::tungstenite::Error;

        let parsed = url::Url::parse(proxy_url).map_err(|e| {
            Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                e.to_string(),
            ))
        })?;
        let scheme = parsed.scheme();
        if scheme != "socks5" && scheme != "socks5h" {
            return Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Invalid SOCKS5 proxy URL",
            )));
        }
        let proxy_host = parsed.host_str().ok_or_else(|| {
            Error::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Proxy URL missing host",
            ))
        })?;
        let proxy_port = parsed.port().unwrap_or(9050);

        let relay_host = relay_url.host_str().ok_or_else(|| {
            Error::Url(UrlError::UnableToConnect(
                "Relay URL missing host".to_string(),
            ))
        })?;
        let relay_port = relay_url.port_or_known_default().ok_or_else(|| {
            Error::Url(UrlError::UnableToConnect(
                "Relay URL missing port".to_string(),
            ))
        })?;

        let socks_stream = tokio_socks::tcp::Socks5Stream::connect(
            (proxy_host, proxy_port),
            (relay_host, relay_port),
        )
        .await
        .map_err(|e| {
            Error::Io(std::io::Error::other(e.to_string()))
        })?;
        Ok(socks_stream.into_inner())
    }

    async fn connect_ws_via_socks5(
        relay_url: &url::Url,
        proxy_url: &str,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        tungstenite::Error,
    > {
        let tcp_stream = Self::connect_tcp_via_socks5(relay_url, proxy_url).await?;
        let request = relay_url.as_str().into_client_request()?;
        let (ws_stream, _) = tokio_tungstenite::client_async(
            request,
            tokio_tungstenite::MaybeTlsStream::Plain(tcp_stream),
        )
        .await?;
        Ok(ws_stream)
    }

    async fn connect_wss_via_socks5(
        relay_url: &url::Url,
        proxy_url: &str,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        tungstenite::Error,
    > {
        use rustls::RootCertStore;
        let tcp_stream = Self::connect_tcp_via_socks5(relay_url, proxy_url).await?;

        let mut root_store = RootCertStore::empty();
        let certs_result = rustls_native_certs::load_native_certs();
        for cert in certs_result.certs {
            let _ = root_store.add(cert);
        }

        let tls_config = rustls::ClientConfig::builder()
            .with_root_certificates(root_store)
            .with_no_client_auth();
        let connector = tokio_tungstenite::Connector::Rustls(std::sync::Arc::new(tls_config));

        let request = relay_url.as_str().into_client_request()?;
        let (ws_stream, _) = tokio_tungstenite::client_async_tls_with_config(
            request,
            tcp_stream,
            None,
            Some(connector),
        )
        .await?;
        Ok(ws_stream)
    }
}
