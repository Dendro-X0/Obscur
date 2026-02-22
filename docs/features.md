# Implemented Features & Roadmap

## Implemented Features (Current State: v0.7.8-alpha)

Obscur has rapidly evolved into a feature-rich, local-first messenger capable of cross-platform execution. 

### Core Messaging & Communities
- **Sealed Communities (Protocol Overhaul)**: Radically decentralized "Kind 10105" group protocol. Replaces legacy admin roles with egalitarian, consensus-based privacy. Communities are natively obscured and do not rely on registry relays.
- **Consensus Moderation**: Member expulsion and group management require a strictly enforced >50% client-side "Vote to Kick" consensus. Room keys automatically rotate upon expulsion to maintain forward secrecy.
- **Metadata-Private Messaging**: NIP-17 wrapped messages preventing relays from identifying the sender/recipient in both DMs and Private Groups.
- **End-to-End Encryption**: Fully encrypted payloads powered by NIP-04/NIP-44 standards and shared Room Keys.
- **Reactions**: NIP-25 based emoji reactions to messages, with optimistic UI updates.
- **Sidebar Categorization**: Implemented segmented tabs to easily filter between Direct Messages and Communities.
- **Chat Management**: Users can manually pin prioritizing chats to the top, and soft-delete/hide conversations to keep inboxes clean.
- **Modern UI Patterns (Midnight Slate)**: Shifted to a premium "Midnight Slate / Indigo" color system. Custom hover-based seamless scrollbars, dynamic status bars, subtle gradient systems, and responsive layouts spanning desktop, tablet, and mobile (100dvh).
- **Dynamic Member Registry**: Automated discovery and persistence of group members through live chat history, ensuring accurate presence and registry syncing across sessions.

### Authentication & Connections
- **Unified Auth Flow**: An interactive, high-fidelity `AuthScreen` combining login and account creation utilizing `framer-motion` for a frictionless onboarding experience.
- **Smart Invite System**: Comprehensive system supporting QR code generation/scanning, NIP-17 secure key distribution, time-limited shareable links, and direct **Invite Code Search** (`OBSCUR-...`) entirely within the app.
- **Contact Handshake**: Automated connection requests when messaging unaccepted peers, complete with visual notifications and inbox filtering. Auto-discovery publishes codes quietly in the background upon registration.
- **Hardware-Backed Crypto Integration**: On Windows/macOS/Linux/Android/iOS, the app natively securely accesses the OS Keychain to retain private keys.
- **PIN/Password Unlock & "Remember Me"**: Implementation of logic to encrypt native keys locally, enabling rapid auto-unlocks on subsequent app launches.

### Networking & Storage
- **Native Dual Path Architecture**: Utilizes a robust Rust background runtime inside Tauri for pure, stable WebSocket relay connections, while allowing the PWA browser fallback to stand on its own.
- **Resilient Relays**: Auto-refresh mechanisms, latency tracking, connection debounce, fallback node configurations, and specific `probe_relay` diagnostics.
- **NIP-96 File Storage**: Rich media uploading (multiple files, images, videos) natively wired to OS file pickers or drag-and-drop. Employs NIP-98 native HTTP Authentication to bypass WebView CORS bottlenecks.
- **Tor Network Routing**: Fully integrates a SOCKS5 Tor sidecar for anonymizing relay and file upload traffic.

---

## 🚧 Known Issues & Active Priorities

Refer to the primary `ISSUES.md` manifest for in-depth details.
1. **Test Suite Stability**: Resolving Vitest dependency injection/module resolution blockers in the `enhanced-dm-controller.test.ts`.
2. **Contact Persistence Handshakes**: Ensuring deep permanence when completing NIP acceptance handshakes across app reloads.
3. **PWA Mobile Tuning**: Additional refinement on WebView focus events and virtual keyboard occlusion in Android Edge cases. 

## Roadmap

- **Integration Testing Overhaul**: Replace brittle unit mocks with confident integration paths spanning the native crypto layers.
- **Broader Decentralized Protocols**: Expand the `packages/dweb-*` boundaries to support specialized micro-apps natively inside the messenger.
- **Cross-Device Sync**: Safe synchronization of settings and historical message states out-of-band between a user's logged-in devices.
