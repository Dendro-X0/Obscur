use std::sync::Arc;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Semaphore;

use crate::dial::{self, HttpFetchRequest};
use crate::tor_manager::TorLifecycle;

const MAX_REQUEST_BYTES: usize = 512_000;

#[derive(Clone)]
pub struct GatewayConfig {
    pub bind: String,
}

pub async fn handle_connection(
    mut stream: TcpStream,
    lifecycle: Arc<TorLifecycle>,
    dial_slots: Arc<Semaphore>,
) {
    let Some(raw) = read_http_request(&mut stream).await else {
        return;
    };
    let (method, path, body) = match parse_http_request(&raw) {
        Some(v) => v,
        None => {
            let _ = write_response(&mut stream, 400, "text/plain", "bad request").await;
            return;
        }
    };

    match (method.as_str(), path.as_str()) {
        ("GET", "/v1/health") => {
            let body = r#"{"ok":true,"service":"obscur-tor-gateway"}"#;
            let _ = write_response(&mut stream, 200, "application/json", body).await;
        }
        ("GET", "/v1/tor/status") => {
            let status = lifecycle.status().await;
            let body = serde_json::to_string(&status).unwrap_or_else(|_| {
                r#"{"state":"error","bootstrapReady":false,"socks":""}"#.to_string()
            });
            let _ = write_response(&mut stream, 200, "application/json", &body).await;
        }
        ("POST", "/v1/tor/start") => match lifecycle.start().await {
            Ok(status) => {
                let body = serde_json::to_string(&status).unwrap_or_default();
                let _ = write_response(&mut stream, 200, "application/json", &body).await;
            }
            Err(err) => {
                let body = serde_json::json!({
                    "state": "error",
                    "bootstrapReady": false,
                    "socks": "",
                    "detail": err,
                })
                .to_string();
                let _ = write_response(&mut stream, 500, "application/json", &body).await;
            }
        },
        ("POST", "/v1/tor/stop") => {
            let status = lifecycle.stop().await;
            let body = serde_json::to_string(&status).unwrap_or_default();
            let _ = write_response(&mut stream, 200, "application/json", &body).await;
        }
        ("POST", "/v1/http/fetch") => {
            let req: HttpFetchRequest = match serde_json::from_str(body.as_deref().unwrap_or("")) {
                Ok(v) => v,
                Err(err) => {
                    let msg = format!(r#"{{"error":"bad_request","detail":"{err}"}}"#);
                    let _ = write_response(&mut stream, 400, "application/json", &msg).await;
                    return;
                }
            };
            match dial::http_fetch_via_socks(&lifecycle, &dial_slots, req).await {
                Ok(resp) => {
                    let body = serde_json::to_string(&resp).unwrap_or_default();
                    let _ = write_response(&mut stream, 200, "application/json", &body).await;
                }
                Err((code, body)) => {
                    let _ = write_response(&mut stream, code, "application/json", &body).await;
                }
            }
        }
        _ => {
            let _ = write_response(&mut stream, 404, "text/plain", "not found").await;
        }
    }
}

async fn read_http_request(stream: &mut TcpStream) -> Option<Vec<u8>> {
    let mut buf = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        let n = stream.read(&mut chunk).await.ok()?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.len() > MAX_REQUEST_BYTES {
            break;
        }
        if let Some(header_end) = find_header_end(&buf) {
            let body_start = header_end + 4;
            match content_length(&buf[..header_end]) {
                Some(cl) if buf.len() >= body_start + cl => break,
                Some(_) => {}
                None => break,
            }
        }
    }
    if buf.is_empty() {
        None
    } else {
        Some(buf)
    }
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n")
}

fn content_length(headers: &[u8]) -> Option<usize> {
    let text = String::from_utf8_lossy(headers);
    for line in text.lines() {
        let lower = line.to_ascii_lowercase();
        if let Some(rest) = lower.strip_prefix("content-length:") {
            return rest.trim().parse().ok();
        }
    }
    None
}

fn parse_http_request(raw: &[u8]) -> Option<(String, String, Option<String>)> {
    let text = String::from_utf8_lossy(raw);
    let (head, body) = text.split_once("\r\n\r\n")?;
    let line = head.lines().next()?;
    let mut parts = line.split_whitespace();
    let method = parts.next()?.to_string();
    let path = parts.next()?.split('?').next()?.to_string();
    let body = if body.is_empty() {
        None
    } else {
        Some(body.to_string())
    };
    Some((method, path, body))
}

async fn write_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &str,
) -> Result<(), std::io::Error> {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        502 => "Bad Gateway",
        503 => "Service Unavailable",
        500 => "Internal Server Error",
        _ => "OK",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\n\
Content-Type: {content_type}\r\n\
Content-Length: {}\r\n\
Connection: close\r\n\
\r\n",
        body.len()
    );
    stream.write_all(header.as_bytes()).await?;
    stream.write_all(body.as_bytes()).await?;
    stream.flush().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_get_and_post_paths() {
        assert_eq!(
            parse_http_request(b"GET /v1/health HTTP/1.1\r\nHost: x\r\n\r\n"),
            Some(("GET".into(), "/v1/health".into(), None))
        );
        let raw = b"POST /v1/http/fetch HTTP/1.1\r\nContent-Length: 2\r\n\r\n{}";
        let parsed = parse_http_request(raw).unwrap();
        assert_eq!(parsed.0, "POST");
        assert_eq!(parsed.1, "/v1/http/fetch");
        assert_eq!(parsed.2.as_deref(), Some("{}"));
    }

    #[test]
    fn content_length_parsed() {
        assert_eq!(
            content_length(b"POST /x HTTP/1.1\r\nContent-Length: 12\r\n"),
            Some(12)
        );
    }
}
