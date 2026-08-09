//! R4 Slice 4b-1: loopback TCP tunnel — SOCKS CONNECT runs in the gateway only.
//! UI speaks TLS+WS on the spliced stream and never dials Tor SocksPort.

use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::Semaphore;
use tokio::time::timeout;

use crate::socks_isolation::{MESH_WS_SOCKS_PASS, MESH_WS_SOCKS_USER};
use crate::tor_manager::TorLifecycle;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(12);
const HANDSHAKE_MAX_BYTES: usize = 4_096;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct TunnelOpenRequest {
    pub v: u32,
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Serialize)]
pub struct TunnelOpenReply {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

pub fn parse_tunnel_request_line(line: &str) -> Result<TunnelOpenRequest, String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Err("empty handshake".into());
    }
    let req: TunnelOpenRequest =
        serde_json::from_str(trimmed).map_err(|e| format!("bad handshake json: {e}"))?;
    validate_tunnel_request(&req)?;
    Ok(req)
}

pub fn validate_tunnel_request(req: &TunnelOpenRequest) -> Result<(), String> {
    if req.v != 1 {
        return Err(format!("unsupported tunnel version {}", req.v));
    }
    let host = req.host.trim();
    if host.is_empty() {
        return Err("host is empty".into());
    }
    if host.contains(['/', '\\', '\0', ' ', '\t', '\n', '\r']) {
        return Err("host contains illegal characters".into());
    }
    if req.port == 0 {
        return Err("port must be 1–65535".into());
    }
    Ok(())
}

pub fn parse_socks_endpoint(proxy_url: &str) -> Result<(String, u16), String> {
    let parsed = url::Url::parse(proxy_url).map_err(|e| format!("invalid socks url: {e}"))?;
    let scheme = parsed.scheme();
    if scheme != "socks5" && scheme != "socks5h" {
        return Err(format!("unsupported socks scheme: {scheme}"));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "socks url missing host".to_string())?
        .to_string();
    let port = parsed.port().unwrap_or(9050);
    Ok((host, port))
}

fn reply_line(ok: bool, error: Option<&str>, detail: Option<&str>) -> String {
    let body = TunnelOpenReply {
        ok,
        error: error.map(|s| s.to_string()),
        detail: detail.map(|s| s.to_string()),
    };
    let mut line = serde_json::to_string(&body).unwrap_or_else(|_| {
        r#"{"ok":false,"error":"encode"}"#.to_string()
    });
    line.push('\n');
    line
}

pub async fn handle_tunnel_connection(
    client: TcpStream,
    lifecycle: Arc<TorLifecycle>,
    dial_slots: Arc<Semaphore>,
) {
    let status = lifecycle.status().await;
    handle_tunnel_session(client, status.bootstrap_ready, &status.socks, &dial_slots).await;
}

/// Core tunnel session (testable without a live TorLifecycle spawn).
pub async fn handle_tunnel_session(
    mut client: TcpStream,
    bootstrap_ready: bool,
    socks_url: &str,
    dial_slots: &Semaphore,
) {
    let handshake = {
        let mut reader = BufReader::new(&mut client);
        let mut line = String::new();
        match timeout(CONNECT_TIMEOUT, reader.read_line(&mut line)).await {
            Ok(Ok(0)) => None,
            Ok(Ok(_)) if line.len() > HANDSHAKE_MAX_BYTES => Some(Err("handshake too large")),
            Ok(Ok(_)) => Some(Ok(line)),
            Ok(Err(_)) | Err(_) => Some(Err("handshake timeout")),
        }
    };
    let line = match handshake {
        None => return,
        Some(Err(detail)) => {
            let _ = client
                .write_all(reply_line(false, Some("bad_request"), Some(detail)).as_bytes())
                .await;
            return;
        }
        Some(Ok(line)) => line,
    };

    let req = match parse_tunnel_request_line(&line) {
        Ok(r) => r,
        Err(detail) => {
            let _ = client
                .write_all(reply_line(false, Some("bad_request"), Some(&detail)).as_bytes())
                .await;
            return;
        }
    };

    if !bootstrap_ready {
        let _ = client
            .write_all(
                reply_line(
                    false,
                    Some("tor_not_ready"),
                    Some("gateway Tor not Bootstrapped 100%"),
                )
                .as_bytes(),
            )
            .await;
        return;
    }

    let (proxy_host, proxy_port) = match parse_socks_endpoint(socks_url) {
        Ok(v) => v,
        Err(detail) => {
            let _ = client
                .write_all(reply_line(false, Some("bad_proxy"), Some(&detail)).as_bytes())
                .await;
            return;
        }
    };

    let host = req.host.trim().to_string();
    let port = req.port;
    // Cap concurrent SOCKS handshakes only — do not hold the slot for the full splice
    // (long-lived relays would starve new dials under MAX_CONCURRENT_DIALS=4).
    let mut upstream = {
        let Ok(_permit) = dial_slots.acquire().await else {
            let _ = client
                .write_all(reply_line(false, Some("dial_slots"), Some("semaphore closed")).as_bytes())
                .await;
            return;
        };
        // T5-1: shared mesh isolation so relay WS dials share warm circuits.
        match timeout(
            CONNECT_TIMEOUT,
            tokio_socks::tcp::Socks5Stream::connect_with_password(
                (proxy_host.as_str(), proxy_port),
                (host.as_str(), port),
                MESH_WS_SOCKS_USER,
                MESH_WS_SOCKS_PASS,
            ),
        )
        .await
        {
            Ok(Ok(stream)) => stream.into_inner(),
            Ok(Err(err)) => {
                let detail = err.to_string();
                let _ = client
                    .write_all(reply_line(false, Some("socks_connect"), Some(&detail)).as_bytes())
                    .await;
                return;
            }
            Err(_) => {
                let _ = client
                    .write_all(
                        reply_line(
                            false,
                            Some("socks_connect"),
                            Some("SOCKS connect timed out"),
                        )
                        .as_bytes(),
                    )
                    .await;
                return;
            }
        }
    };

    if client
        .write_all(reply_line(true, None, None).as_bytes())
        .await
        .is_err()
    {
        return;
    }

    let _ = tokio::io::copy_bidirectional(&mut client, &mut upstream).await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;
    use tokio::net::TcpListener;
    use tokio::sync::Semaphore;

    #[test]
    fn parses_valid_handshake() {
        let req = parse_tunnel_request_line(r#"{"v":1,"host":"nos.lol","port":443}"#).unwrap();
        assert_eq!(req.host, "nos.lol");
        assert_eq!(req.port, 443);
        assert_eq!(req.v, 1);
    }

    #[test]
    fn rejects_bad_handshake() {
        assert!(parse_tunnel_request_line("").is_err());
        assert!(parse_tunnel_request_line(r#"{"v":2,"host":"x","port":1}"#).is_err());
        assert!(parse_tunnel_request_line(r#"{"v":1,"host":"","port":443}"#).is_err());
        assert!(parse_tunnel_request_line(r#"{"v":1,"host":"a/b","port":443}"#).is_err());
        assert!(parse_tunnel_request_line(r#"{"v":1,"host":"x","port":0}"#).is_err());
    }

    #[test]
    fn parses_socks_endpoint() {
        assert_eq!(
            parse_socks_endpoint("socks5h://127.0.0.1:9050").unwrap(),
            ("127.0.0.1".into(), 9050)
        );
        assert!(parse_socks_endpoint("http://127.0.0.1:9050").is_err());
    }

    #[tokio::test]
    async fn refuses_when_tor_not_ready() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let slots = Semaphore::new(4);

        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            handle_tunnel_session(stream, false, "socks5h://127.0.0.1:9050", &slots).await;
        });

        let mut client = TcpStream::connect(addr).await.unwrap();
        client
            .write_all(br#"{"v":1,"host":"nos.lol","port":443}"#)
            .await
            .unwrap();
        client.write_all(b"\n").await.unwrap();

        let mut buf = vec![0u8; 256];
        let n = client.read(&mut buf).await.unwrap();
        let text = String::from_utf8_lossy(&buf[..n]);
        assert!(text.contains(r#""ok":false"#));
        assert!(text.contains("tor_not_ready"));
        let _ = server.await;
    }
}
