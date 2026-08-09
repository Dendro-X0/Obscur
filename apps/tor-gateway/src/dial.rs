//! R4 Slice 4a: Tor HTTP dials execute only inside the gateway process.
//! Concurrency is capped so a mesh burst cannot wedge the C Tor event loop as hard.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::sync::Semaphore;

use crate::socks_isolation::{socks_url_with_auth, HTTP_SOCKS_PASS, HTTP_SOCKS_USER};
use crate::tor_manager::TorLifecycle;

/// Hard cap on concurrent SOCKS HTTP dials (research: C Tor single-loop saturation).
pub const MAX_CONCURRENT_DIALS: usize = 4;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(12);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(45);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpFetchRequest {
    pub url: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: Option<HashMap<String, String>>,
    #[serde(default)]
    pub body_text: Option<String>,
}

fn default_method() -> String {
    "GET".to_string()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpFetchResponse {
    pub status: u16,
    pub body_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpFetchErrorBody {
    pub error: String,
    pub detail: String,
}

pub async fn http_fetch_via_socks(
    lifecycle: &TorLifecycle,
    dial_slots: &Semaphore,
    req: HttpFetchRequest,
) -> Result<HttpFetchResponse, (u16, String)> {
    let status = lifecycle.status().await;
    if !status.bootstrap_ready {
        return Err((
            503,
            serde_json::to_string(&HttpFetchErrorBody {
                error: "tor_not_ready".into(),
                detail: "gateway Tor not Bootstrapped 100%".into(),
            })
            .unwrap_or_else(|_| "{\"error\":\"tor_not_ready\"}".into()),
        ));
    }

    let trimmed_url = req.url.trim();
    if trimmed_url.is_empty() {
        return Err((400, error_json("bad_request", "url is empty")));
    }
    if !(trimmed_url.starts_with("https://") || trimmed_url.starts_with("http://")) {
        return Err((
            400,
            error_json("bad_request", "only http:// and https:// URLs are allowed"),
        ));
    }

    let _permit = dial_slots
        .acquire()
        .await
        .map_err(|_| (503, error_json("dial_slots", "semaphore closed")))?;

    let socks_authed = socks_url_with_auth(&status.socks, HTTP_SOCKS_USER, HTTP_SOCKS_PASS)
        .map_err(|e| (500, error_json("bad_proxy", &e)))?;
    let proxy = reqwest::Proxy::all(&socks_authed).map_err(|e| {
        (
            500,
            error_json("bad_proxy", &format!("invalid socks url: {e}")),
        )
    })?;

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .proxy(proxy)
        .build()
        .map_err(|e| (500, error_json("client", &e.to_string())))?;

    let method_upper = req.method.trim().to_uppercase();
    let http_method = match method_upper.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        _ => {
            return Err((
                400,
                error_json("bad_request", &format!("unsupported method: {method_upper}")),
            ))
        }
    };

    let mut request = client.request(http_method, trimmed_url);
    if let Some(headers) = req.headers {
        for (key, value) in headers {
            request = request.header(key, value);
        }
    }
    if let Some(body) = req.body_text {
        request = request.body(body);
    }

    let response = request.send().await.map_err(|e| {
        (
            502,
            error_json("socks_fetch_failed", &e.to_string()),
        )
    })?;

    let status_code = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.to_string());
    let body_text = response
        .text()
        .await
        .map_err(|e| (502, error_json("read_body", &e.to_string())))?;

    Ok(HttpFetchResponse {
        status: status_code,
        body_text,
        content_type,
    })
}

fn error_json(error: &str, detail: &str) -> String {
    serde_json::to_string(&HttpFetchErrorBody {
        error: error.into(),
        detail: detail.into(),
    })
    .unwrap_or_else(|_| format!(r#"{{"error":"{error}"}}"#))
}

pub fn shared_dial_semaphore() -> Arc<Semaphore> {
    Arc::new(Semaphore::new(MAX_CONCURRENT_DIALS))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dial_cap_is_small() {
        assert!(MAX_CONCURRENT_DIALS <= 8);
        assert!(MAX_CONCURRENT_DIALS >= 1);
    }
}
