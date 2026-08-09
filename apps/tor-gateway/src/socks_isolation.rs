//! T5-1: shared SOCKS5 auth tokens for Tor stream isolation.
//!
//! Tor's IsolateSOCKSAuth keeps streams with the same username/password on
//! compatible circuits. Mesh WS dials share one identity so parallel relay
//! opens warm the same circuit family instead of N cold builds.

/// NativeRelay / tunnel WS dials (all URLs in one session).
pub const MESH_WS_SOCKS_USER: &str = "obscur-mesh-ws";
pub const MESH_WS_SOCKS_PASS: &str = "v1";

/// Gateway HTTP fetch dials (`/v1/http/fetch`).
pub const HTTP_SOCKS_USER: &str = "obscur-http";
pub const HTTP_SOCKS_PASS: &str = "v1";

/// Build `socks5h://user:pass@host:port` from a base socks URL (no auth).
pub fn socks_url_with_auth(base_socks_url: &str, username: &str, password: &str) -> Result<String, String> {
    let parsed = url::Url::parse(base_socks_url).map_err(|e| format!("invalid socks url: {e}"))?;
    let scheme = parsed.scheme();
    if scheme != "socks5" && scheme != "socks5h" {
        return Err(format!("unsupported socks scheme: {scheme}"));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "socks url missing host".to_string())?;
    let port = parsed.port().unwrap_or(9050);
    // Username/password are fixed constants — no encoding edge cases.
    Ok(format!("{scheme}://{username}:{password}@{host}:{port}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mesh_and_http_identities_differ() {
        assert_ne!(MESH_WS_SOCKS_USER, HTTP_SOCKS_USER);
        assert_eq!(MESH_WS_SOCKS_PASS, "v1");
        assert_eq!(HTTP_SOCKS_PASS, "v1");
    }

    #[test]
    fn injects_auth_into_socks5h_url() {
        let out = socks_url_with_auth("socks5h://127.0.0.1:9050", MESH_WS_SOCKS_USER, MESH_WS_SOCKS_PASS)
            .unwrap();
        assert_eq!(out, "socks5h://obscur-mesh-ws:v1@127.0.0.1:9050");
    }

    #[test]
    fn rejects_non_socks_scheme() {
        assert!(socks_url_with_auth("http://127.0.0.1:9050", "u", "p").is_err());
    }
}
