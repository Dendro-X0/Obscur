# Developer Guide

Welcome to the **Obscur** developer documentation. This guide is designed to help you understand the project's architecture, setup your development environment, and contribute effectively.

## 📖 Project Overview

**Obscur** is a local-first, privacy-focused messenger built on the **Nostr** protocol. It aims to provide secure, censorship-resistant communication for small, invite-only communities.

**Key Principles:**

- **Privacy by Design**: End-to-end encryption (NIP-04/44), metadata privacy (NIP-17), and Tor network integration.
- **Local-First**: Data resides on the user's device, encrypted at rest. No central servers store your messages.
- **Decentralization**: Relies on a distributed network of relays, not a single point of failure.

---

## 🛠️ Technology Stack

Obscur is a monorepo managed with **PNPM Workspaces**.

### **Frontend & PWA (`apps/pwa`)**

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: React Hooks + Context (e.g., `EnhancedDMController`, `RelayProvider`)
- **Protocol**: `nostr-tools` + Custom native bindings
- **Testing**: `Playwright` (E2E), `Vitest` (Unit), `fast-check` (Property-based)

### **Desktop & Mobile Applications (`apps/desktop`)**

- **Framework**: [Tauri v2](https://v2.tauri.app/) for building cross-platform native binaries (Windows, macOS, Linux, iOS, Android).
- **Backend / Core**: Unified Rust core (`libobscur`) powering business logic across operating systems.
- **Networking**: Native Rust networking stack (reqwest, tokio-tungstenite) to bypass WebView limitations, support Tor (Desktop), and manage mobile background data sync.
- **Security**: OS-level hardware-backed keystore integration (Android Keystore, iOS Secure Enclave, Windows Credential Manager) for secure private key storage.

### **Core Libraries (`packages/`)**

Modular packages used across the apps:

- **`@dweb/core`**: Common utilities and types.
- **`@dweb/crypto`**: Cryptographic primitives (hashing, signing, encryption).
- **`@dweb/nostr`**: Nostr protocol implementation, event building, and parsing.
- **`@dweb/storage`**: Storage abstractions (IndexedDB wrappers, file system interfaces).

---

## 🏗️ Architecture Explained

### 1. Hybrid Networking (Desktop)

On the desktop app, network traffic is handled by a **Native Rust Runtime**:

- **Why?** WebViews have CORS restrictions and lack native SOCKS5 (Tor) support.
- **How?** The frontend sends commands (e.g., `connect_relay`, `publish_event`, `nip96_upload`) to the Rust backend via Tauri IPC. The Rust backend executes the request using `reqwest` or `tungstenite` and returns the result.
- **Tor Integration**: When enabled, all Rust networking calls are routed through a bundled Tor sidecar proxy.

### 2. Smart Invite System

A secure way to connect users without exposing public keys globally:

- **Flow**: User A generates an Invite (QR/Link) -> User B scans it -> Keys are exchanged securely.
- **Security**: Invites are signed and encrypted. They contain temporal properties (expiration) to prevent replay attacks.
- **Services**: `InviteService`, `ContactService`, `ProfileService` (located in `apps/pwa/app/lib/invites`).

### 3. Local-First Data

- **Storage**: IndexedDB (using `idb` or similar wrappers) stores messages, contacts, and profiles locally.
- **Encryption**: The local database is encrypted at rest using a key derived from the user's passphrase (AES-GCM).
- **Sync**: The app syncs with relays on startup and periodically, pulling only new events.

---

## 📂 File Structure

```
obscur/
├── apps/
│   ├── pwa/                 # Next.js Web App (The UI & Logic Core)
│   │   ├── app/             # App Router: Pages, Layouts, Components
│   │   │   ├── features/    # Feature-based organization (auth, messaging, contacts, etc.)
│   │   │   └── lib/         # Shared utilities and core business logic
│   │   └── public/          # Static assets
│   ├── desktop/             # Tauri Wrapper
│   │   ├── src-tauri/       # Rust Backend Code
│   │   │   ├── src/
│   │   │   │   ├── lib.rs   # Tauri commands & plugin registration
│   │   │   │   ├── net.rs   # Native networking logic
│   │   │   │   └── ...
│   ├── api/                 # (Optional) Dev API server
├── packages/                # Shared internal libraries
│   ├── dweb-core/
│   ├── dweb-crypto/
│   ├── dweb-nostr/
│   └── dweb-storage/
├── docs/                    # Documentation
└── scripts/                 # Build and maintenance scripts
```

---

## 🚀 Setting Up Development Environment

### Prerequisites

- **Node.js**: v20.11.0 or higher
- **PNPM**: v9+ (`npm install -g pnpm`)
- **Rust**: Latest stable (`rustup update`)
- **Build Tools**:
  - Windows: C++ Build Tools (Visual Studio)
  - Linux: `build-essential`, `libwebkit2gtk-4.0-dev`, `libssl-dev`, etc. (See Tauri docs)

### Installation

```bash
git clone <repo-url>
cd obscur
pnpm install
```

### Running Locally

**1. Progressive Web App (Browser Mode)**
Best for UI development.

```bash
pnpm dev:pwa
# Runs at http://localhost:3000
```

**2. Desktop App (Tauri Mode)**
Needed for testing native features (Tor, System Tray, Native Notifications).

```bash
pnpm dev:desktop
# Note: This will automatically run `scripts/setup-tor.mjs` first to download the appropriate Tor binary for your platform, then starts the PWA dev server and wraps it.
```

---

## 🧪 Testing

- **Unit Tests**: `pnpm test` (Runs Vitest)
- **E2E Tests**: `pnpm test:e2e` (Runs Playwright)
- **Linting**: `pnpm lint`

---

## 🤝 Contribution Guidelines

1.  **Conventions**:
    - Use `PascalCase` for component filenames (e.g., `ChatBox.tsx`).
    - Use `kebab-case` for utility files (e.g., `date-utils.ts`).
    - Commits should follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: add new sidebar`, `fix: resolve login bug`).

2.  **State Management**:
    - Prefer local state (`useState`) for UI-only logic.
    - Use Context (`useContext`) for global features (Auth, Settings).
    - Avoid heavy external state libraries (Redux, Zustand) unless strictly necessary; distinct Controllers are preferred.

3.  **Security**:
    - **Never** log private keys or sensitive payloads.
    - Always use the provided crypto wrappers in `@dweb/crypto`.

---

## 📚 Useful References

- [Nostr Protocol Specs (NIPs)](https://github.com/nostr-protocol/nips)
- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Next.js Documentation](https://nextjs.org/docs)
