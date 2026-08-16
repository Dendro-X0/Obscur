# CI investigation — Full Release Android openssl-sys (2026-08-16)

**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/31931861358  
**Job:** Build Android (APK + AAB)  
**Class:** Android / openssl cross-compile (one class)

## Evidence

- Desktop matrix (win/mac/linux) + Web/PWA + iOS: **success**
- Android: `openssl-sys v0.9.117` fails — `Could not find openssl via pkg-config` when `$TARGET = aarch64-linux-android`
- Trigger: `native-tls` (via `tokio-tungstenite` features including `native-tls`) pulls OpenSSL on Android

## Fix direction

Add mobile-target `openssl` with `vendored` in [`apps/desktop/src-tauri/Cargo.toml`](../../apps/desktop/src-tauri/Cargo.toml) so `openssl-sys` builds from source under NDK (pkg-config cannot satisfy `aarch64-linux-android`).

Keep desktop `native-tls` path for Tor tunnel fingerprint behavior. Do **not** batch-fix desktop matrix.

## Non-goals

- Redesign Full Release publish channel
- Skip Android permanently without charter
