//! OpenSSH local-forward underlay — R-RELAY-RUST-5b.
//! Dialect dials loopback `endpoints` only after `tunnel_up`.

use crate::mesh::descriptor::SshTunnelParams;
use std::io;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SshTunnelError {
    BinaryMissing,
    AuthFailed,
    #[allow(dead_code)] // reserved for live probe failures; matched in code()/Display
    TunnelDown,
    BindFailed,
    SpawnFailed(String),
}

impl SshTunnelError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::BinaryMissing => "ssh_binary_missing",
            Self::AuthFailed => "ssh_auth_failed",
            Self::TunnelDown => "tunnel_down",
            Self::BindFailed => "tunnel_down",
            Self::SpawnFailed(_) => "tunnel_down",
        }
    }
}

impl std::fmt::Display for SshTunnelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BinaryMissing => write!(f, "ssh_binary_missing"),
            Self::AuthFailed => write!(f, "ssh_auth_failed"),
            Self::TunnelDown => write!(f, "tunnel_down"),
            Self::BindFailed => write!(f, "tunnel_down"),
            Self::SpawnFailed(msg) => write!(f, "tunnel_down:{msg}"),
        }
    }
}

/// Build `ssh` argv (program path separate). Local-forward only.
pub fn build_ssh_argv(params: &SshTunnelParams) -> Vec<String> {
    let forward = format!(
        "{}:{}:{}:{}",
        params.local_bind_host.trim(),
        params.local_bind_port,
        params.remote_host.trim(),
        params.remote_port
    );
    let mut args = vec![
        "-N".into(),
        "-L".into(),
        forward,
        "-p".into(),
        params.bastion_port.to_string(),
        "-o".into(),
        "BatchMode=yes".into(),
        "-o".into(),
        "ExitOnForwardFailure=yes".into(),
        "-o".into(),
        "StrictHostKeyChecking=accept-new".into(),
        "-o".into(),
        "ServerAliveInterval=30".into(),
    ];
    if let Some(identity) = params
        .identity_file
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        args.push("-i".into());
        args.push(identity.to_string());
    }
    args.push(format!(
        "{}@{}",
        params.bastion_user.trim(),
        params.bastion_host.trim()
    ));
    args
}

/// Locate system OpenSSH client (`ssh` / `ssh.exe`).
pub fn resolve_ssh_binary() -> Result<PathBuf, SshTunnelError> {
    which_ssh().ok_or(SshTunnelError::BinaryMissing)
}

fn which_ssh() -> Option<PathBuf> {
    let candidates = if cfg!(windows) {
        vec!["ssh.exe", "ssh"]
    } else {
        vec!["ssh"]
    };
    for name in candidates {
        // Probe without the `which` crate — OpenSSH reports version on -V.
        if Command::new(name)
            .arg("-V")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return Some(PathBuf::from(name));
        }
    }
    None
}

/// Injectable process spawner for tests (mock) vs production OpenSSH.
pub trait SshTunnelSpawner: Send {
    fn spawn(&mut self, params: &SshTunnelParams) -> Result<Child, SshTunnelError>;
}

pub struct OpenSshSpawner;

impl SshTunnelSpawner for OpenSshSpawner {
    fn spawn(&mut self, params: &SshTunnelParams) -> Result<Child, SshTunnelError> {
        let binary = resolve_ssh_binary()?;
        let args = build_ssh_argv(params);
        Command::new(binary)
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                if e.kind() == io::ErrorKind::NotFound {
                    SshTunnelError::BinaryMissing
                } else {
                    SshTunnelError::SpawnFailed(e.to_string())
                }
            })
    }
}

pub struct SshTunnelSession {
    child: Option<Child>,
    #[allow(dead_code)] // read by is_up(); kept for session identity
    local_bind_host: String,
    #[allow(dead_code)] // read by is_up(); kept for session identity
    local_bind_port: u16,
}

impl SshTunnelSession {
    /// Spawn forward and wait until local bind accepts TCP (or fail).
    pub fn start(
        params: &SshTunnelParams,
        spawner: &mut dyn SshTunnelSpawner,
        listen_timeout: Duration,
    ) -> Result<Self, SshTunnelError> {
        if !params.is_valid() {
            return Err(SshTunnelError::SpawnFailed("ssh_params_invalid".into()));
        }
        let mut child = spawner.spawn(params)?;
        let host = params.local_bind_host.trim().to_string();
        let port = params.local_bind_port;

        match wait_for_local_listen(&host, port, listen_timeout) {
            Ok(()) => Ok(Self {
                child: Some(child),
                local_bind_host: host,
                local_bind_port: port,
            }),
            Err(err) => {
                // Only treat as auth failure if ssh exited on its own before listen timeout.
                let early_exit = child.try_wait().ok().flatten();
                let _ = child.kill();
                let _ = child.wait();
                if let Some(status) = early_exit {
                    if !status.success() {
                        return Err(SshTunnelError::AuthFailed);
                    }
                }
                Err(err)
            }
        }
    }

    #[allow(dead_code)] // used by underlay L3 tests; production path uses start/stop only
    pub fn is_up(&mut self) -> bool {
        let Some(child) = self.child.as_mut() else {
            return false;
        };
        match child.try_wait() {
            Ok(None) => local_port_open(&self.local_bind_host, self.local_bind_port),
            Ok(Some(_)) | Err(_) => false,
        }
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for SshTunnelSession {
    fn drop(&mut self) {
        self.stop();
    }
}

fn wait_for_local_listen(
    host: &str,
    port: u16,
    timeout: Duration,
) -> Result<(), SshTunnelError> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if local_port_open(host, port) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err(SshTunnelError::BindFailed)
}

fn local_port_open(host: &str, port: u16) -> bool {
    let addr = format!("{host}:{port}");
    let Ok(mut addrs) = addr.to_socket_addrs() else {
        return false;
    };
    let Some(sock): Option<SocketAddr> = addrs.next() else {
        return false;
    };
    TcpStream::connect_timeout(&sock, Duration::from_millis(100)).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::process::Stdio;

    fn sample_params(port: u16) -> SshTunnelParams {
        SshTunnelParams {
            bastion_host: "bastion.example".into(),
            bastion_port: 22,
            bastion_user: "ops".into(),
            remote_host: "127.0.0.1".into(),
            remote_port: 7000,
            local_bind_host: "127.0.0.1".into(),
            local_bind_port: port,
            identity_file: Some("/tmp/id_ed25519".into()),
        }
    }

    #[test]
    fn argv_is_local_forward_only() {
        let args = build_ssh_argv(&sample_params(19001));
        assert!(args.contains(&"-N".into()));
        assert!(args.contains(&"-L".into()));
        assert!(args.contains(&"127.0.0.1:19001:127.0.0.1:7000".into()));
        assert!(args.contains(&"ops@bastion.example".into()));
        assert!(args.contains(&"-i".into()));
        assert!(args.contains(&"/tmp/id_ed25519".into()));
        assert!(args.contains(&"BatchMode=yes".into()));
        assert!(args.contains(&"ExitOnForwardFailure=yes".into()));
        assert!(args.contains(&"StrictHostKeyChecking=accept-new".into()));
        assert!(!args.iter().any(|a| a == "-R"));
    }

    #[test]
    fn error_codes_match_design() {
        assert_eq!(SshTunnelError::BinaryMissing.code(), "ssh_binary_missing");
        assert_eq!(SshTunnelError::AuthFailed.code(), "ssh_auth_failed");
        assert_eq!(SshTunnelError::TunnelDown.code(), "tunnel_down");
    }

    /// Mock: bind local port ourselves (stand-in for `ssh -L`), then spawn a long-lived noop child.
    struct MockListenSpawner {
        listener: Option<TcpListener>,
    }

    impl SshTunnelSpawner for MockListenSpawner {
        fn spawn(&mut self, params: &SshTunnelParams) -> Result<Child, SshTunnelError> {
            let listener = TcpListener::bind(format!(
                "{}:{}",
                params.local_bind_host.trim(),
                params.local_bind_port
            ))
            .map_err(|_| SshTunnelError::BindFailed)?;
            // Keep listener alive so wait_for_local_listen succeeds
            self.listener = Some(listener);
            // Long-lived process that does nothing (Windows: timeout / ping; Unix: sleep)
            let child = if cfg!(windows) {
                Command::new("ping")
                    .args(["-n", "60", "127.0.0.1"])
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
            } else {
                Command::new("sleep")
                    .arg("60")
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
            }
            .map_err(|e| SshTunnelError::SpawnFailed(e.to_string()))?;
            Ok(child)
        }
    }

    #[test]
    fn mock_spawner_marks_tunnel_up_then_stop() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("ephemeral");
        let port = listener.local_addr().unwrap().port();
        drop(listener); // free port for mock bind

        let params = sample_params(port);
        let mut spawner = MockListenSpawner { listener: None };
        let mut session =
            SshTunnelSession::start(&params, &mut spawner, Duration::from_secs(2)).expect("up");
        assert!(session.is_up());
        session.stop();
        assert!(!session.is_up());
        let _hold = spawner.listener.take();
    }

    #[test]
    fn missing_listen_reports_bind_failed() {
        struct FailSpawner;
        impl SshTunnelSpawner for FailSpawner {
            fn spawn(&mut self, _params: &SshTunnelParams) -> Result<Child, SshTunnelError> {
                let child = if cfg!(windows) {
                    Command::new("ping")
                        .args(["-n", "5", "127.0.0.1"])
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .spawn()
                } else {
                    Command::new("sleep")
                        .arg("5")
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .spawn()
                }
                .map_err(|e| SshTunnelError::SpawnFailed(e.to_string()))?;
                Ok(child)
            }
        }
        let listener = TcpListener::bind("127.0.0.1:0").expect("ephemeral");
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        // nothing listens — expect BindFailed quickly
        let params = sample_params(port);
        let mut spawner = FailSpawner;
        let err = SshTunnelSession::start(&params, &mut spawner, Duration::from_millis(200));
        match err {
            Err(e) => {
                assert!(matches!(e, SshTunnelError::BindFailed | SshTunnelError::AuthFailed));
                assert_eq!(e.code(), "tunnel_down");
            }
            Ok(_) => panic!("expected listen failure"),
        }
    }

    #[test]
    fn binary_missing_spawner() {
        struct Missing;
        impl SshTunnelSpawner for Missing {
            fn spawn(&mut self, _params: &SshTunnelParams) -> Result<Child, SshTunnelError> {
                Err(SshTunnelError::BinaryMissing)
            }
        }
        let err = SshTunnelSession::start(
            &sample_params(19099),
            &mut Missing,
            Duration::from_millis(50),
        );
        match err {
            Err(SshTunnelError::BinaryMissing) => {}
            other => panic!("expected BinaryMissing, got success or other: {}", other.is_ok()),
        }
    }
}
