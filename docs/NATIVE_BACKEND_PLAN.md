# Native Backend Capability Layer (Rust) – Plan & Spec

This document defines the plan and technical spec for making Obscur’s Desktop/Mobile builds production-grade by moving critical capabilities out of the WebView/browser environment and into a native Rust backend, while keeping the existing UI/UX (Next/PWA) unchanged.

## Decisions (Locked)

- **Tor mode:** opt-in.
- **Uploads:** multiple providers with fallback.
- **Priority after uploads:** move **relay networking** to Rust (WebSocket client in native layer).

## Objectives

- Make Desktop/Mobile builds reliable and debuggable without depending on browser semantics (CORS/FormData/WebSocket quirks).
- Keep UI/UX, localization, and animations unchanged.
- Provide stable, versioned IPC contracts between UI and native backend.

## Non-Goals (for now)

- Rewriting UI in native toolkits.
- Perfectly matching browser networking behavior.

## Architecture Overview

### Components

- **UI renderer:** Next.js (PWA) in a WebView.
- **Native backend:** Rust inside Tauri.

### Principle

The UI should not directly perform security-critical or reliability-critical operations over browser APIs. Instead, it calls the native backend via IPC.

### IPC Transport

- **Current:** Tauri `invoke()` commands.
- **Future optional:** local HTTP API (only if needed for streaming or cross-process features).

### Versioned Contracts

All native commands use a common error and versioning model.

- **`apiVersion`:** `"v1"`
- **Errors:** structured, stable codes
  - `code: string`
  - `message: string`
  - `retryable: boolean`
  - `details?: Record<string, unknown>`

## Capability Layer – v1 Scope

### 1) Uploads (NIP-96) – Native

#### Goals

- Always send **multipart/form-data** with `file` field.
- Support **multiple providers** with fallback.
- Support optional NIP-98 `Authorization` header.

#### Commands

- `nip96_upload_file(params)`
  - Upload one file to one provider.
- `nip96_upload_with_fallback(params)`
  - Try providers sequentially until one succeeds.

#### Request (proposed)

- `apiVersion: "v1"`
- `providers: string[]` (ordered)
- `fileName: string`
- `contentType: string`
- `fileBytes: number[]`
- `authorization: string | null`

#### Response (proposed)

- `providerUrl: string`
- `responseBody: string` (raw JSON)
- `parsedUrl: string` (extracted media URL)

### 2) Relay Networking – Native (Priority)

#### Goals

- Remove dependency on WebView `WebSocket` reliability.
- Enable consistent behavior with Tor/proxy.
- Preserve existing semantics:
  - multi-relay publishing
  - health monitoring
  - reconnection/backoff
  - subscription management

#### Commands (incremental)

Phase A (bridge mode):
- `relay_connect({ url })`
- `relay_disconnect({ url })`
- `relay_send({ url, payload })`
- `relay_set_relays({ urls })`
- Events emitted from Rust:
  - `relay-message` with `{ url, message }`
  - `relay-status` with `{ url, status, error? }`

Phase B (native subscription manager):
- `relay_subscribe({ filters }) -> subscriptionId`
- `relay_unsubscribe({ subscriptionId })`

#### Notes

- UI will progressively switch from `createRelayWebSocket()` to native commands.
- Keep current TypeScript pool logic initially; only transport changes.

### 3) Tor (Opt-in)

#### Goals

- Provide verifiable status.
- Ensure native networking uses proxy when Tor mode enabled.

#### Commands

- `tor_start()` / `tor_stop()` / `tor_status()`
- `net_set_proxy_mode({ mode })` where mode is `direct | tor | custom`

### 4) Diagnostics & Observability

#### Goals

- Make debugging possible without WebView devtools.
- Provide a single place for users/devs to export logs.

#### Commands

- `diag_get_state()` – returns snapshot (versions, proxy mode, Tor state)
- `diag_export_logs()` – writes a zip or directory bundle and returns path
- `diag_tail_logs({ lines })` – returns last N lines

#### Logging

- Structured logs written to `AppLog` directory.

## Implementation Plan (Milestones)

### Milestone 0 – Unblock (Immediate)

- Stabilize native NIP-96 upload command(s).
- Implement provider fallback.
- Add basic diagnostic logging for upload failures.

**Exit criteria**

- Desktop can upload avatar/media.
- Errors are actionable (status + response body).

### Milestone 1 – Native Relay Transport (Priority)

- Implement native relay WebSocket client (Rust).
- Emit relay events to UI.
- Replace WebView WebSocket usage with native transport.

**Exit criteria**

- UI can connect/receive/publish via native layer.
- Works with Tor mode opt-in.

### Milestone 2 – Tor Verification + Enforcement

- Add health check and explicit test endpoint.
- Ensure all native HTTP and relay traffic routes through proxy in Tor mode.

**Exit criteria**

- App can prove Tor routing is enabled.

### Milestone 3 – Media Cache (after networking)

- Native download to cache, content-type validation.
- UI reads from cache.

### Milestone 4 – Storage & Crypto Boundaries (later)

- Key storage strategy (OS keychain or encrypted file).
- Reduce exposure of private keys to UI.

## Risks

- IPC payload size: large files via `fileBytes` can be slow; later replace with `filePath` (native file picker) or chunked streaming.
- Relay compatibility: some relays behave differently; health metrics must be tuned.
- Tor usability: Tor exits may be blocked by some providers.

## Acceptance Criteria (Production-grade)

- Upload works across Desktop and Mobile shells without WebView CORS dependencies.
- Relay connectivity is reliable and debuggable.
- Tor opt-in is verifiable in-app.
- Logs can be exported for support.
