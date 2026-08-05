//! R-RELAY-RUST-5c L3 — SSH underlay → Docker `:7000` via bastion local-forward.
//! Skips unless product relay + SSH bastion are reachable (see `scripts/l3-mesh-ssh-underlay.mjs`).

use crate::mesh::descriptor::{
    ConduitCapability, ConduitDescriptor, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
    ConduitUnderlay, SshTunnelParams,
};
use crate::mesh::dialect::nostr_ws::NostrWsDialect;
use crate::mesh::publish::{build_publish_outcome, BuildPublishOutcomeParams};
use crate::mesh::runtime::{MeshConnectAttempt, MeshRuntimeState};
use crate::mesh::snapshot::MeshPhase;
use crate::mesh::tor_policy::MeshTorRuntimeState;
use futures_util::{SinkExt, StreamExt};
use std::env;
use std::path::PathBuf;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const PRODUCT_RELAY: &str = "ws://127.0.0.1:7000";
const DEFAULT_LOCAL_PORT: u16 = 19001;
const DEFAULT_BASTION_PORT: u16 = 2222;

fn env_u16(name: &str, default: u16) -> u16 {
    env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn ssh_descriptor(identity: PathBuf, local_port: u16, bastion_port: u16) -> ConduitDescriptor {
    let dial = format!("ws://127.0.0.1:{local_port}");
    ConduitDescriptor {
        conduit_id: "ssh-l3-bastion".into(),
        dialect: ConduitDialect::NostrWs,
        endpoints: vec![dial],
        capabilities: vec![ConduitCapability::Publish, ConduitCapability::Subscribe],
        network_policy: ConduitNetworkPolicy::Clearnet,
        trust_tier: ConduitTrustTier::UserConfigured,
        enabled: true,
        priority: 10,
        label: Some("L3 SSH underlay".into()),
        underlay: Some(ConduitUnderlay::SshTunnel),
        ssh_tunnel: Some(SshTunnelParams {
            bastion_host: "127.0.0.1".into(),
            bastion_port,
            bastion_user: env::var("OBSCUR_L3_SSH_USER").unwrap_or_else(|_| "ops".into()),
            // Evaluated on bastion (Docker) — reach host-mapped nostr relay.
            remote_host: env::var("OBSCUR_L3_SSH_REMOTE_HOST")
                .unwrap_or_else(|_| "host.docker.internal".into()),
            remote_port: env_u16("OBSCUR_L3_SSH_REMOTE_PORT", 7000),
            local_bind_host: "127.0.0.1".into(),
            local_bind_port: local_port,
            identity_file: Some(identity.to_string_lossy().into_owned()),
        }),
    }
}

async fn tcp_reachable(host: &str, port: u16) -> bool {
    tokio::time::timeout(
        std::time::Duration::from_secs(2),
        tokio::net::TcpStream::connect((host, port)),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false)
}

async fn relay_reachable(url: &str) -> bool {
    match tokio::time::timeout(std::time::Duration::from_secs(3), connect_async(url)).await {
        Ok(Ok((mut ws, _))) => {
            let _ = ws.close(None).await;
            true
        }
        _ => false,
    }
}

#[tokio::test]
async fn l3_ssh_underlay_forward_to_docker_7000() {
    if !relay_reachable(PRODUCT_RELAY).await {
        eprintln!("skip L3-SSH: {PRODUCT_RELAY} unreachable (start pnpm dev:relay:docker)");
        return;
    }

    let identity = match env::var("OBSCUR_L3_SSH_IDENTITY") {
        Ok(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => {
            eprintln!(
                "skip L3-SSH: set OBSCUR_L3_SSH_IDENTITY (run node scripts/l3-mesh-ssh-underlay.mjs)"
            );
            return;
        }
    };
    if !identity.is_file() {
        eprintln!("skip L3-SSH: identity missing at {}", identity.display());
        return;
    }

    let bastion_port = env_u16("OBSCUR_L3_SSH_BASTION_PORT", DEFAULT_BASTION_PORT);
    let local_port = env_u16("OBSCUR_L3_SSH_LOCAL_PORT", DEFAULT_LOCAL_PORT);
    if !tcp_reachable("127.0.0.1", bastion_port).await {
        eprintln!(
            "skip L3-SSH: bastion 127.0.0.1:{bastion_port} unreachable (run l3-mesh-ssh-underlay.mjs)"
        );
        return;
    }

    let dial_url = format!("ws://127.0.0.1:{local_port}");
    let runtime = MeshRuntimeState::new();
    let outcome = runtime.configure_and_select(
        "profile-l3-ssh",
        vec![ssh_descriptor(identity, local_port, bastion_port)],
        MeshTorRuntimeState::OFF,
        Some(1),
    );
    assert!(outcome.ok, "configure ok");
    assert!(
        outcome.active_endpoint_urls.contains(&dial_url),
        "expected forwarded dial URL in active set; got {:?}; skipped={:?}; accepted={:?}",
        outcome.active_endpoint_urls,
        outcome.skipped,
        outcome.accepted_conduit_ids
    );
    assert!(outcome.mesh_scheduler_owns_failover);

    let entries = runtime.registry_entries("profile-l3-ssh");
    let ssh_entry = entries
        .iter()
        .find(|e| e.descriptor.conduit_id == "ssh-l3-bastion")
        .expect("ssh entry");
    assert_ne!(
        ssh_entry.last_failure_reason.as_deref(),
        Some("ssh_binary_missing"),
        "OpenSSH client missing"
    );
    assert!(
        ssh_entry.last_failure_reason.is_none(),
        "underlay failed: {:?}",
        ssh_entry.last_failure_reason
    );

    // Dial through the forward (not direct :7000) — proves underlay path.
    let (mut socket, _) = connect_async(&dial_url)
        .await
        .expect("connect via SSH local-forward");
    runtime.apply_connect_attempts(
        "profile-l3-ssh",
        &[MeshConnectAttempt {
            endpoint_url: dial_url.clone(),
            success: true,
            error: None,
        }],
    );
    let snap = runtime.get_snapshot("profile-l3-ssh");
    assert_eq!(snap.phase, MeshPhase::Healthy);
    assert!(snap.writable_conduit_count >= 1);

    let ordered = NostrWsDialect::order_publish_urls(&outcome.active_endpoint_urls, &entries, None)
        .expect("order");
    assert_eq!(ordered, vec![dial_url.clone()]);
    let escape = NostrWsDialect::order_publish_urls(
        &outcome.active_endpoint_urls,
        &entries,
        Some(&["wss://relay.damus.io".to_string()]),
    )
    .expect_err("public escape must fail");
    assert!(escape.contains("not_in_mesh_active_set"));

    let req = serde_json::json!(["REQ", "l3-ssh", {"kinds": [1], "limit": 1}]);
    socket
        .send(Message::Text(req.to_string().into()))
        .await
        .expect("send REQ via tunnel");
    let reply = tokio::time::timeout(std::time::Duration::from_secs(8), socket.next())
        .await
        .expect("REQ timeout")
        .expect("stream")
        .expect("ws message");
    let Message::Text(text) = reply else {
        panic!("expected text from relay via SSH forward");
    };
    assert!(
        text.contains("EOSE") || text.contains("EVENT"),
        "unexpected relay reply via SSH: {text}"
    );
    let _ = socket.close(None).await;

    let publish = build_publish_outcome(BuildPublishOutcomeParams {
        envelope_id: "env-l3-ssh",
        at_unix_ms: 1,
        attempts: &[(dial_url, true, None)],
    });
    assert!(publish.accepted);
}
