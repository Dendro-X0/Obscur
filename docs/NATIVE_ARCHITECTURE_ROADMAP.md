# Obscur Shared Core & Native Architecture Roadmap

This document outlines the strategic refactoring plan to transition Obscur from a web-heavy architecture to a highly performant, cross-platform native ecosystem powered by a shared Rust core.

## Executive Summary

To achieve the reliability and performance of mature secure messengers (like Signal or Telegram), Obscur must move away from relying on WebViews for heavy business logic, networking, and state management. 

This roadmap details the transition to a **"Shared Core Architecture"** organized within a unified monorepo. The core logic will be written once in Rust (`libobscur`) and bound to native UIs across Desktop, iOS, Android, and Web.

---

## Phase 1: Stabilization & Decoupling (Immediate Priority)

Before migrating logic to Rust, the current Alpha protocol implementation must be rock-solid. A native app will inherit any logic flaws present in the current TypeScript implementation.

**Goals:**
*   Eliminate data loss and state desynchronization bugs.
*   Decouple business logic from React functional components.

**Key Tasks:**
1.  **Resolve Critical Bugs:** Address all blocking issues in `ISSUES.md` (e.g., connection handshakes, contact persistence after restart).
2.  **State Decoupling:** Refactor complex hooks (like `EnhancedDMController`, `useDmSync`) so they act merely as "viewers" of state. The state machine should be entirely decoupled from the React rendering cycle.
3.  **Standardize Persistence:** Finalize the data schemas for IndexedDB to ensure a smooth future migration path to SQLite/SQLCipher.

---

## Phase 2: Monorepo Restructuring

Establish the definitive workspace structure to support the official website, web app, desktop app, and future mobile native apps without fragmenting the codebase.

**Goals:**
*   Create a scalable project structure.
*   Maximize code reuse across platforms (UI components, design tokens, TypeScript types).

**Proposed Workspace Structure:**
```text
obscur/
├── apps/
│   ├── website/         # Official marketing and download portal (Next.js - SSG)
│   ├── web-client/      # The current PWA (Next.js)
│   ├── desktop/         # Tauri V2 wrapper (Web UI + Rust Core)
│   └── mobile/          # Future React Native or purely Native (Swift/Kotlin) app
├── packages/
│   ├── libobscur/       # The pure Rust shared core (Crypto, Network, DB)
│   ├── bindings/        # uniffi-rs FFI bindings for Swift/Kotlin/Node
│   ├── ui-kit/          # Shared React UI components and Tailwind configurations
│   └── types/           # Shared TypeScript domain models
```

**Key Tasks:**
1.  Scaffold the `apps/website` project for the official launch page.
2.  Extract shared React components from `apps/pwa` into a reusable `packages/ui-kit`.
3.  Set up the `packages/libobscur` Rust crate.

---

## Phase 3: The `libobscur` Shared Core (The Heavy Lift)

This is the architectural leap. All cryptographic, networking, and database operations move from JavaScript to a pure Rust library.

**Goals:**
*   Implement a single source of truth for the Obscur protocol.
*   Eliminate performance bottlenecks associated with WebViews and JavaScript single-threaded execution.

**Key Tasks:**
1.  **Networking & Relays:** Migrate Nostr WebSocket pooling, retry logic, and exponential backoff into Rust.
2.  **Tor Integration:** Strictly enforce Tor SOCKS5 proxy routing at the native socket level within `libobscur`.
3.  **Cryptography:** Port NIP-04, NIP-44, and NIP-17 (Sealed Communities) encryption/decryption from Web Crypto to Rust cryptographic primitives.
4.  **Local Storage:** Replace browser IndexedDB with a native SQLCipher (encrypted SQLite) implementation for robust, queryable, and atomic local data storage.
5.  **FFI Bindings:** Generate multi-language bindings using `uniffi-rs` so the Rust core can be called effortlessly from Swift, Kotlin, and TypeScript.

---

## Phase 4: Native Mobile Implementation

**Status: IN PROGRESS (WP-1 & WP-2 underway)**

> **Full Specification:** [Phase 4: Native Mobile Implementation — Technical Specification](./PHASE_4_NATIVE_MOBILE_SPEC.md)


With `libobscur` handling the heavy lifting, the mobile apps can focus entirely on delivering a buttery-smooth, native user experience. Phase 4 uses **Tauri V2 Mobile** to extend the existing desktop project to iOS and Android, maximizing code reuse.

**Goals:**
*   Deliver a true native feel on iOS and Android.
*   Integrate deeply with mobile OS capabilities.

**Work Packages:**
1.  **WP-1: Tauri V2 Mobile Scaffold** — Initialize Android/iOS targets within the existing Tauri project.
2.  **WP-2: Privacy-Preserving Push Notifications** — Encrypted push payloads decrypted locally by `libobscur`.
3.  **WP-3: Background Sync** — Process incoming messages while the app is backgrounded.
4.  **WP-4: Secure Key Storage** — Secure Enclave (iOS) / Android Keystore with biometric gating.
5.  **WP-5: Mobile UX Adaptation** — Safe areas, touch targets, mobile navigation, gesture support.
6.  **WP-6: Build, CI & Release Pipeline** — Automated Android/iOS builds, signing, and beta distribution.

---

## Principles & Best Practices

1.  **Dumb UIs, Smart Core:** The React, Swift, or Kotlin UI layers should be as "dumb" as possible. They exist only to render data provided by `libobscur` and capture user input.
2.  **Atomic Protocol Updates:** By maintaining a monorepo, a change to the cryptography in `libobscur` can be instantly tested against the Desktop Tauri app, Web Client, and Mobile interfaces in a single pull request.
3.  **Security by Default:** All persistent storage must be encrypted at rest natively. Network requests must default strictly to internal implementations, completely bypassing browser/WebView fetching mechanisms to prevent DNS leaks and CORS issues.
