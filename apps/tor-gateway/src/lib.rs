//! Obscur Tor gateway (R4) — owns `tor.exe` + HTTP SOCKS dials outside the UI process.
//!
//! Bootstrap ready is true only after log line contains `Bootstrapped 100%`.
//! TCP SocksPort reachability alone must never mark ready (false-READY class).

pub mod dial;
pub mod http;
pub mod socks_isolation;
pub mod tor_manager;
pub mod tunnel;

pub use http::{handle_connection, GatewayConfig};
pub use socks_isolation::{
    socks_url_with_auth, HTTP_SOCKS_PASS, HTTP_SOCKS_USER, MESH_WS_SOCKS_PASS, MESH_WS_SOCKS_USER,
};
pub use tor_manager::{parse_socks_port, TorLifecycle, TorRuntimeState, TorStatusView};
pub use tunnel::handle_tunnel_connection;

pub const DEFAULT_BIND: &str = "127.0.0.1:17950";
pub const DEFAULT_TUNNEL_BIND: &str = "127.0.0.1:17951";
pub const CANONICAL_BIND_PORT: u16 = 17950;
pub const CANONICAL_TUNNEL_PORT: u16 = 17951;
pub const DEFAULT_SOCKS_URL: &str = "socks5h://127.0.0.1:9050";

fn resolve_loopback_bind(
    env_value: Option<&str>,
    allow_custom: bool,
    canonical: &str,
    env_name: &str,
) -> String {
    let Some(raw) = env_value.map(str::trim).filter(|s| !s.is_empty()) else {
        return canonical.to_string();
    };
    if raw == canonical || raw == canonical.replacen("127.0.0.1", "localhost", 1) {
        return canonical.to_string();
    }
    let loopback = raw.starts_with("127.0.0.1:") || raw.starts_with("localhost:");
    if allow_custom && loopback {
        return raw.to_string();
    }
    eprintln!(
        "[obscur-tor-gateway] ignoring {env_name}={raw} — using {canonical} (set OBSCUR_TOR_GATEWAY_ALLOW_CUSTOM=1 for loopback override)"
    );
    canonical.to_string()
}

/// T0: pin product bind to `127.0.0.1:17950` unless `OBSCUR_TOR_GATEWAY_ALLOW_CUSTOM=1`.
pub fn resolve_bind_addr(env_value: Option<&str>, allow_custom: bool) -> String {
    resolve_loopback_bind(
        env_value,
        allow_custom,
        DEFAULT_BIND,
        "OBSCUR_TOR_GATEWAY_BIND",
    )
}

/// 4b-1: pin tunnel bind to `127.0.0.1:17951` unless custom allowed.
pub fn resolve_tunnel_bind_addr(env_value: Option<&str>, allow_custom: bool) -> String {
    resolve_loopback_bind(
        env_value,
        allow_custom,
        DEFAULT_TUNNEL_BIND,
        "OBSCUR_TOR_GATEWAY_TUNNEL_BIND",
    )
}

/// True only for real bootstrap completion — not SOCKS TCP, not "address in use".
pub fn line_signals_bootstrap_ready(line: &str) -> bool {
    line.contains("Bootstrapped 100%")
}

/// Port conflict / foreign Tor — report error, never promote to ready.
pub fn line_signals_socks_conflict(line: &str) -> bool {
    line.contains("Address already in use")
}

/// Extract `Bootstrapped N%` progress for status detail (not ready until 100).
pub fn parse_bootstrap_percent(line: &str) -> Option<u8> {
    let idx = line.find("Bootstrapped ")?;
    let rest = &line[idx + "Bootstrapped ".len()..];
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_ready_only_on_100_percent() {
        assert!(line_signals_bootstrap_ready(
            "Apr 01 12:00:00.000 [notice] Bootstrapped 100% (done): Done"
        ));
        assert!(!line_signals_bootstrap_ready(
            "Apr 01 12:00:00.000 [notice] Bootstrapped 80% (ap_conn): Connecting"
        ));
        assert!(!line_signals_bootstrap_ready("Opening Socks listener on 127.0.0.1:9050"));
    }

    #[test]
    fn address_in_use_is_conflict_not_ready() {
        assert!(line_signals_socks_conflict(
            "Could not bind to 127.0.0.1:9050: Address already in use"
        ));
        assert!(!line_signals_bootstrap_ready(
            "Could not bind to 127.0.0.1:9050: Address already in use"
        ));
    }

    #[test]
    fn parse_bootstrap_percent_from_notice() {
        assert_eq!(
            parse_bootstrap_percent(
                "Aug 07 21:07:35.000 [notice] Bootstrapped 5% (conn): Connecting to a relay"
            ),
            Some(5)
        );
        assert_eq!(
            parse_bootstrap_percent("Bootstrapped 100% (done): Done"),
            Some(100)
        );
    }

    #[test]
    fn resolve_bind_pins_canonical_port() {
        assert_eq!(resolve_bind_addr(None, false), DEFAULT_BIND);
        assert_eq!(resolve_bind_addr(Some("127.0.0.1:11468"), false), DEFAULT_BIND);
        assert_eq!(resolve_bind_addr(Some("127.0.0.1:17950"), false), DEFAULT_BIND);
        assert_eq!(
            resolve_bind_addr(Some("127.0.0.1:11468"), true),
            "127.0.0.1:11468"
        );
        assert_eq!(CANONICAL_BIND_PORT, 17950);
        assert_eq!(resolve_tunnel_bind_addr(None, false), DEFAULT_TUNNEL_BIND);
        assert_eq!(
            resolve_tunnel_bind_addr(Some("127.0.0.1:19000"), false),
            DEFAULT_TUNNEL_BIND
        );
        assert_eq!(CANONICAL_TUNNEL_PORT, 17951);
    }
}
