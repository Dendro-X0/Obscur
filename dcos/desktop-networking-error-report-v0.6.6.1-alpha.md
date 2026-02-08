# Desktop Networking Error Report (v0.6.6.1-alpha)

## Purpose
This document records recurring Desktop failures observed during the native networking refactor, with an emphasis on **root causes** and why progress became difficult in a “vibe-coded” architecture (inconsistent authority boundaries, unclear ownership of responsibilities, and insufficiently constrained interfaces).

This is not a post intended to blame individuals. It is a technical record meant to make future decisions (rewrite vs. refactor vs. de-scope) tractable.

## Observed Errors (User-Facing)

### Relay connectivity
- **Error code**: `RELAY_CONNECT_FAILED`
- **Message pattern**:
  - `Failed to connect to wss://relay.nostr.band: HTTP error: 502 Bad Gateway headers={...}`
  - Sometimes also includes: `Relay probe failed: Command probe_relay not allowed by ACL`

### Upload failures
- **Error code**: `UPLOAD_FAILED`
- **Message pattern**:
  - `Upload failed: HTTP 401 Unauthorized: {"status":"error","message":"Unauthorized, please provide a valid nip-98 token","data":{}}`

## Root Cause Summary

### A) Architectural split: two networking engines with different semantics
**Cause**: The Desktop app historically relied on both:
- WebView/browser networking semantics (proxy/caching behavior tied to WebView lifecycle)
- Native Rust networking (reqwest + tokio-tungstenite, optional Tor SOCKS routing)

**Why it matters**:
- Proxy/Tor routing semantics differ between WebView and native.
- Some WebView configuration (notably proxy) is effectively determined at window creation, making “toggle Tor without restart” unreliable.
- When failures occur, it is unclear which networking engine is responsible, so logs are noisy and corrective action is ambiguous.

**Impact**:
- Repeated “works after restart / fails after crash” patterns.
- Time spent debugging symptoms (reconnect loops, cache clears, restart triggers) rather than fixing a single authoritative network layer.

### B) Relay `502 Bad Gateway` is an upstream availability/proxy issue, not a local code defect
**Cause**: A `wss://` websocket connection begins with an HTTP request that must upgrade. A **502** indicates the request reached a gateway/proxy (often nginx) that could not route to the upstream relay.

**What this means**:
- DNS resolution and TCP connection are typically already successful.
- The relay endpoint (or its fronting proxy/WAF) is returning an HTTP error instead of upgrading.

**Impact**:
- No amount of local retry logic can “fix” a relay returning 502.
- A resilient client must treat this as a normal condition and:
  - rotate relays
  - degrade gracefully
  - surface clear diagnostics

### C) Diagnostics were blocked in production by Tauri ACL
**Symptom**:
- `Relay probe failed: Command probe_relay not allowed by ACL`

**Cause**:
- Tauri’s permission system (capabilities/ACL) correctly blocks commands not explicitly allowed.
- The Desktop capability includes relay permissions, but the specific command `probe_relay` was not included in the allowlist.

**Evidence (repo config)**:
- `apps/desktop/src-tauri/capabilities/desktop.json` includes `allow-relay-commands`.
- `apps/desktop/src-tauri/permissions/app.toml` lists relay commands, but **did not include** `probe_relay`.

**Impact**:
- The app fails to connect.
- The UI attempts to probe to determine whether the failure is DNS/TCP/TLS/upgrade.
- The probe command is blocked, so the app cannot produce the diagnosis that would identify the true failure mode.
- This creates a debugging dead-end where errors repeat without actionable data.

**Security note**:
- This is not a security vulnerability. It is the security boundary working as designed.
- The issue is *misconfiguration* of allowed commands for the production capability.

### D) Upload `401 Unauthorized` indicates NIP-98 mismatch (auth correctness)
**Symptom**:
- Storage provider returns `401 Unauthorized` with a message that the NIP-98 token is invalid.

**Likely causes** (common failure modes):
- Signing a URL that differs from the one actually requested (redirects, path normalization, query changes)
- Hashing bytes that differ from what was actually transmitted (multipart boundary differences, field naming differences)
- Method mismatch (`POST` vs. actual request method)
- Time window problems (clock drift, missing/incorrect expiration tags)

**Impact**:
- Repeated failures because the token validation is deterministic: “almost right” tokens are rejected.
- If signing/hashing responsibility is split between layers (frontend constructs some parts, backend sends others), correctness becomes difficult to guarantee.

## Why “Vibe Coding” Made This Hard to Debug

This class of project tends to accumulate the following failure accelerants:

### 1) No single authority per responsibility
Networking was not owned by a single, testable module. Instead, multiple layers could “do the network,” producing conflicting behavior.

### 2) Missing, unstable boundaries
When UI code can directly trigger deep networking behavior without a stable contract, debugging becomes “try things until it works,” which fails under nondeterministic conditions.

### 3) Diagnostics bolted on after the fact
When diagnostics are added late, they frequently violate production permissions (ACL) or rely on code paths not available in release builds.

### 4) Lack of production-like tests
Reliability issues (relay outages, proxies returning 502, strict NIP-98 providers) require repeatable integration tests and controlled probes. Without them, progress regresses into anecdotal debugging.

## What Can vs. Cannot Be Fixed

### Cannot be “fixed” locally
- A relay returning `HTTP 502` at the gateway/proxy layer.

### Can be fixed in-client
- Make relay connectivity resilient:
  - reconnect with backoff
  - do not treat one relay failure as total failure
  - add fallback relays
  - surface a structured diagnosis
- Ensure diagnostics are permitted in production capability configurations.
- Make uploads deterministic:
  - build multipart body in Rust
  - hash the exact bytes sent
  - sign the exact URL used
  - forbid redirects for signed requests

## Recommended Remediation Strategy (Decision Points)

### Option 1: Continue the native-only networking cutover (recommended if keeping project)
- Keep Rust as the **only** network engine for Desktop.
- Ensure Tauri ACL explicitly allows needed diagnostic commands (`probe_relay`) without expanding unrelated permissions.
- Move NIP-98 signing + payload hashing fully into Rust.

### Option 2: De-scope features until reliability is regained
- Ship a minimal relay set known to work.
- Disable optional relays/providers in UI until verified.

### Option 3: Rewrite with strict module boundaries
If the cost of untangling exceeds the cost of rewriting, enforce:
- single responsibility per module
- stable IPC contract
- mandatory production permission review
- integration tests that simulate relay outages + strict upload providers

## Appendix: Relevant Files
- `apps/desktop/src-tauri/permissions/app.toml`
- `apps/desktop/src-tauri/capabilities/desktop.json`
- `apps/desktop/src-tauri/src/relay.rs`
- `apps/desktop/src-tauri/src/net.rs`
- `apps/desktop/src-tauri/src/upload.rs`
- `apps/pwa/app/features/relays/hooks/native-relay.ts`
- `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
