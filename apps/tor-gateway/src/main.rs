//! obscur-tor-gateway — R4 loopback control plane + Slice 4a HTTP + Slice 4b-1 tunnels.
//!
//! Bind: `OBSCUR_TOR_GATEWAY_BIND` (default `127.0.0.1:17950`)
//! Tunnel: `OBSCUR_TOR_GATEWAY_TUNNEL_BIND` (default `127.0.0.1:17951`)
//! Tor binary: `OBSCUR_TOR_BIN` or packaged sidecar next to desktop src-tauri
//! Data: `OBSCUR_TOR_GATEWAY_DATA`

use std::sync::Arc;

use obscur_tor_gateway::dial::shared_dial_semaphore;
use obscur_tor_gateway::http::{handle_connection, GatewayConfig};
use obscur_tor_gateway::tor_manager::{
    resolve_data_dir, resolve_socks_url, resolve_tor_bin, TorLifecycle,
};
use obscur_tor_gateway::{
    handle_tunnel_connection, resolve_bind_addr, resolve_tunnel_bind_addr,
};
use tokio::net::TcpListener;

fn allow_custom_bind() -> bool {
    std::env::var("OBSCUR_TOR_GATEWAY_ALLOW_CUSTOM")
        .map(|v| v.trim() == "1")
        .unwrap_or(false)
}

fn refuse_non_loopback(bind: &str, label: &str) {
    if !bind.starts_with("127.0.0.1:") && !bind.starts_with("localhost:") {
        eprintln!(
            "[obscur-tor-gateway] refusing non-loopback {label} {bind} (R4: loopback IPC only)"
        );
        std::process::exit(2);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let allow_custom = allow_custom_bind();
    let bind = resolve_bind_addr(
        std::env::var("OBSCUR_TOR_GATEWAY_BIND").ok().as_deref(),
        allow_custom,
    );
    let tunnel_bind = resolve_tunnel_bind_addr(
        std::env::var("OBSCUR_TOR_GATEWAY_TUNNEL_BIND").ok().as_deref(),
        allow_custom,
    );
    refuse_non_loopback(&bind, "bind");
    refuse_non_loopback(&tunnel_bind, "tunnel bind");

    let tor_bin = resolve_tor_bin();
    let data_dir = resolve_data_dir();
    let socks = resolve_socks_url();
    std::fs::create_dir_all(&data_dir)?;

    eprintln!(
        "[obscur-tor-gateway] bind={bind} tunnel={tunnel_bind} tor_bin={} data={} socks={socks}",
        tor_bin.display(),
        data_dir.display()
    );

    let lifecycle = Arc::new(TorLifecycle::new(tor_bin, data_dir, socks));
    let dial_slots = shared_dial_semaphore();
    let _config = GatewayConfig { bind: bind.clone() };

    let http_listener = TcpListener::bind(&bind).await?;
    let tunnel_listener = TcpListener::bind(&tunnel_bind).await?;
    eprintln!("[obscur-tor-gateway] listening on http://{bind}");
    eprintln!("[obscur-tor-gateway] tunnel listening on tcp://{tunnel_bind}");

    let http_lifecycle = Arc::clone(&lifecycle);
    let http_slots = Arc::clone(&dial_slots);
    let http_task = tokio::spawn(async move {
        loop {
            let (stream, peer) = match http_listener.accept().await {
                Ok(v) => v,
                Err(err) => {
                    eprintln!("[obscur-tor-gateway] http accept error: {err}");
                    continue;
                }
            };
            if !peer.ip().is_loopback() {
                eprintln!("[obscur-tor-gateway] drop non-loopback http peer {peer}");
                continue;
            }
            let lifecycle = Arc::clone(&http_lifecycle);
            let dial_slots = Arc::clone(&http_slots);
            tokio::spawn(async move {
                handle_connection(stream, lifecycle, dial_slots).await;
            });
        }
    });

    let tunnel_lifecycle = Arc::clone(&lifecycle);
    let tunnel_slots = Arc::clone(&dial_slots);
    let tunnel_task = tokio::spawn(async move {
        loop {
            let (stream, peer) = match tunnel_listener.accept().await {
                Ok(v) => v,
                Err(err) => {
                    eprintln!("[obscur-tor-gateway] tunnel accept error: {err}");
                    continue;
                }
            };
            if !peer.ip().is_loopback() {
                eprintln!("[obscur-tor-gateway] drop non-loopback tunnel peer {peer}");
                continue;
            }
            let lifecycle = Arc::clone(&tunnel_lifecycle);
            let dial_slots = Arc::clone(&tunnel_slots);
            tokio::spawn(async move {
                handle_tunnel_connection(stream, lifecycle, dial_slots).await;
            });
        }
    });

    tokio::select! {
        _ = http_task => eprintln!("[obscur-tor-gateway] http accept loop exited"),
        _ = tunnel_task => eprintln!("[obscur-tor-gateway] tunnel accept loop exited"),
    }
    Ok(())
}
