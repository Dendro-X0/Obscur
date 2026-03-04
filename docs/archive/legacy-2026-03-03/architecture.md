# Architecture & File Tree

## Architecture Overview

Obscur uses a local-first, dual-environment architecture providing a unified Progressive Web App (PWA) experience, backed by native OS capabilities when running inside Tauri (Desktop/Mobile).

### Core Components
1. **Frontend PWA (`apps/pwa`)**: The primary user interface. Handles local rendering, state, and user interactions. Interfaces seamlessly with the native backend when wrapped by Tauri, or falls back to WASM/browser capabilities when loaded purely on the web.
2. **Native Rust Backend (`apps/desktop/src-tauri` & `packages/libobscur`)**: Represents the native capability layer. Contains logic for:
   - Secure private key management via OS Keychain, Android Keystore, and iOS Secure Enclave.
   - Establishing and managing resilient Nostr WebSocket relay connections (including background sync).
   - Using native HTTP clients (`reqwest`) for multipart file uploads (NIP-96) and authentication (NIP-98).
   - Tor sidecar integration for masked routing on Desktop.
3. **Shared Packages (`packages/*`)**: Contains strictly typed, framework-agnostic utilities:
   - `libobscur`: Unified Rust core providing FFI bindings and business logic for all native targets.
   - `dweb-crypto`: Specialized cryptographic primitives (AES-GCM, private/public key derivations) for the web fallback.
   - `dweb-nostr`: Pure implementation of the Nostr protocol (events, relays, signatures).
   - `dweb-core`: Core primitives (user IDs, identity records).

### Data & Network Flow
- **Data Persistence**: Uses IndexedDB in the browser/WebView for persisting chat logs, contacts, and settings.
- **Networking**: In the native context, 100% of relay and HTTP traffic routes through the Rust backend. This bypasses WebView limitations (like CORS or restrictive proxies) and allows for native tor integration and exponential backoff strategies.
- **Cryptography**: Keys never leave the device. When running natively, private keys are guarded by the OS keychain and mapped to memory solely for immediate cryptographic operations.

---

## Complete File Tree

Below is the high-level representation of the `pnpm` workspace directory structure:

```text
|-- apps
|   |-- api                    # Optional Hono Dev API server
|   |-- coordination           # Cloudflare/Hono migrations and coordination Layer
|   |-- desktop                # Tauri v2 Desktop/Mobile App definitions
|   |   |-- src-tauri          # Core Rust backend (networking, keychain, crypto)
|   |   |   |-- src
|   |   |   |-- capabilities   # Tauri security capabilities
|   |   |   |-- Cargo.toml
|   |   |   |-- tauri.conf.json
|   |-- pwa                    # Next.js Web Application
|   |   |-- app                # App router pages, layouts, globals.css
|   |   |   |-- features       # Domain-driven features (messaging, settings, invites, profile, contacts)
|   |   |   |-- components     # Reusable UI components
|   |   |   |-- lib            # Business logic and smart invite services
|   |   |-- public             # PWA assets (manifests, service workers, icons)
|   |   |-- tests              # Playwright E2E and feature tests
|   |   |-- next.config.ts
|   |   |-- playwright.config.ts
|   |   |-- vitest.config.ts
|-- docs                       # Standardized Project Documentation
|   |-- assets
|   |-- DEVELOPER_GUIDE.md
|   |-- SECURITY_PROTOCOLS.md
|   |-- FILE_TREE.md
|   |-- PROJECT_CONTEXT.md
|   |-- architecture.md
|   |-- features.md
|   |-- stack.md
|-- packages                   # Shared Monorepo Packages
|   |-- dweb-core              # Core types and configuration (identity records, user-ids)
|   |-- dweb-crypto            # Cryptographic utils (encryption, keychain fallback)
|   |-- dweb-nostr             # Nostr implementations (events, NIP wrappers)
|   |-- dweb-storage           # Storage abstractions
|-- infra                      # Docker compose and relay infrastructure
|-- scripts                    # Assorted utility scripts
|-- pnpm-workspace.yaml
|-- package.json
|-- CHANGELOG.md
|-- ISSUES.md
```
