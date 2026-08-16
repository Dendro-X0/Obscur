# CI investigation — Full Release Android openssl-sys (2026-08-16)

**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/31931861358  
**Job:** Build Android (APK + AAB)  
**Class:** Android / openssl cross-compile (one class)

## Evidence

- Desktop matrix (win/mac/linux) + Web/PWA + iOS: **success**
- Android: `openssl-sys v0.9.117` fails — `Could not find openssl via pkg-config` when `$TARGET = aarch64-linux-android`
- Trigger: `native-tls` (via `tokio-tungstenite` features including `native-tls`) pulls OpenSSL on Android

## Fix direction (iteration 2)

Vendored OpenSSL advanced past pkg-config but failed at `make install_dev` (exit 127).

**Applied:** drop `native-tls` / openssl from the desktop crate; keep `tokio-tungstenite` on **rustls only** (`connect` + `rustls-tls-native-roots`). Tor tunnel WSS uses default rustls connector. Tor CDN fingerprint quirks remain a known limit (Tor is not a release gate).

## Non-goals

- Redesign Full Release publish channel
- Skip Android permanently without charter
