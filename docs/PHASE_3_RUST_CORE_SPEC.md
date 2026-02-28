# Phase 3: The `libobscur` Shared Core — Technical Specification

> **Parent Document:** [Native Architecture Roadmap](./NATIVE_ARCHITECTURE_ROADMAP.md)
> **Prerequisite:** [Phase 2: Monorepo Restructuring](./PHASE_2_MONOREPO_RESTRUCTURING_SPEC.md) ✅ Complete
> **Status:** Draft — Pending Review
> **Target:** Native Core Foundation

---

## 1. Executive Summary

Phase 3 represents the architectural leap for Obscur. The goal is to transition all heavy business logic, networking, database operations, and cryptography from the JavaScript/TypeScript layer to a pure Rust library (`libobscur`). This core will serve as the single source of truth for the Obscur protocol and will be bound to native UIs across Desktop, web, and future mobile applications.

## 2. Objectives

- **Performance & Reliability:** Eliminate JavaScript single-threaded bottlenecks and WebView performance limits.
- **Security:** Standardize memory-safe Rust cryptography and enforce native-level proxy routing (Tor).
- **Cross-Platform Reusability:** Write protocol logic once, deploy everywhere via FFI bindings (`uniffi-rs`).
- **Data Integrity:** Move from browser IndexedDB to a robust, encrypted native SQL database (SQLCipher).

---

## 3. Work Packages (WPs)

### 3.1 WP-1: Rust Cryptography Foundation
Port existing NIP-04, NIP-44, and NIP-17 (Sealed Communities) encryption/decryption algorithms from Web Crypto to Rust using established crates (e.g., `secp256k1`, `chacha20poly1305`, `aes-gcm`).

- [ ] Implement NIP-01 (Keys and Signatures) in Rust.
- [ ] Implement NIP-04 (Encrypted Direct Messages) in Rust.
- [ ] Implement NIP-44 (Versioned Encrypted Payloads) in Rust.
- [ ] Implement NIP-17 / NIP-29 (Private/Sealed Communities crypto primitives).
- [ ] Implement Secure Enclave / Keyring integrations for identity storage.

### 3.2 WP-2: Native SQLite / SQLCipher Storage
Replace the RxDB/IndexedDB implementation in the frontend with a highly robust native database.

- [ ] Select SQL engine (`rusqlite` + `sqlcipher`).
- [ ] Define Rust database schema and migrations for:
  - Identities and private keys (encrypted at rest).
  - Contacts, relays, and community metadata.
  - Chat history (Groups and DMs).
- [ ] Implement a repository pattern in Rust to expose CRUD operations to the FFI layer.

### 3.3 WP-3: Rust Network Layer & Tor Integration
Migrate Nostr WebSocket pooling, retry logic, and exponential backoff into Rust, ensuring all traffic can be strictly routed through a proxy.

- [ ] Setup `tokio-tungstenite` for WebSocket connections.
- [ ] Implement a Nostr relay connection pool manager in Rust.
- [ ] Implement automatic retry, exponential backoff, and health tracking.
- [ ] Enforce Tor SOCKS5 proxy routing options natively.
- [ ] Hook the Rust network layer into the Rust storage layer for automatic event ingestion.

### 3.4 WP-4: FFI Bindings (`uniffi-rs`)
Expose the Rust core via UniFFI so the Next.js PWA and Tauri Desktop apps can call it.

- [ ] Define the `.udl` interface or use Uniffi proc-macros for the exposed API.
- [ ] Generate TypeScript bindings (via WebAssembly for the browser, or Node-API for Tauri).
- [ ] Hook the UI in `apps/pwa` to the new bindings, gradually replacing local TS implementations.
- [ ] Implement an event dispatch system (Rust -> TS) for real-time updates (e.g., incoming messages).

---

## 4. Rollout Strategy

Because this is a massive undertaking, the rollout must be incremental:
1. **Side-by-side Development:** Build `libobscur` internally without disrupting the working TS app.
2. **Hybrid Testing:** Start by replacing pure crypto functions with WASM/Rust calls in the existing app to verify correctness.
3. **Storage Cutover:** Replace IndexedDB reads/writes with Tauri IPC calls to the Rust DB.
4. **Network Cutover:** Finally, replace the JavaScript relay pool with the Rust sync engine.

---

## 5. Next Steps

1. Review and approve this specification.
2. Begin **WP-1: Rust Cryptography Foundation** by setting up the internal crate structure for `crypto`, `db`, and `network` modules inside `packages/libobscur/src/`.
