# Obscur

Obscur is a local-first Nostr messenger designed for small, invite-only micro-communities. Built with privacy, decentralization, and anti-censorship as core principles.

## ✨ Features

### 🎥 Demo

<div align="center">
  <img src="docs\assets\obscur_short_1.gif" alt="Basic Functions & UI" width="600" />
  <p><em>Basic Functions & UI: Discover groups, manage settings, and explore the interface.</em></p>
  
  <br />

  <img src="https://placehold.co/600x400/1e1e1e/FFF?text=Secure+Messaging" alt="Secure Messaging" width="600" />
  <p><em>Secure Messaging: End-to-end encrypted chats with rich media support.</em></p>
</div>

- **🔒 Privacy-First**: End-to-end encrypted messaging using NIP-04 encryption
- **🌐 Decentralized**: Built on the Nostr protocol with relay-based architecture
- **👥 Invite-Only**: Secure micro-communities with invitation-based access
- **📱 Smart Invite System**: QR codes, shareable links, and intelligent contact management
- **🎨 Modern UI**: Subtle gradients, smooth animations, and polished user experience
- **🌙 Theme Support**: Beautiful light and dark themes with system preference detection
- **🌍 Localized**: Available in English, Chinese (Simplified), and Spanish
- **🖼️ Media Storage**: Native NIP-96 support for file uploads via external providers (nostr.build, etc.)
- **📱 Progressive Web App**: Installable with offline functionality and push notifications
- **🖥️ Cross-Platform**: Web app with experimental Desktop and Android versions

## 🛡️ Privacy & Security

Obscur is built with a "Privacy by Design" philosophy, ensuring that your communications remain secure and metadata-private.

- **Metadata Privacy (NIP-17)**: Messages are triple-wrapped (Rumor → Seal → Gift Wrap) to hide sender and recipient identities from relays.
- **End-to-End Encryption**: All direct messages are encrypted using NIP-04/NIP-44 standards.
- **At-Rest Encryption**: Your local message database is encrypted with AES-GCM using a key derived from your passphrase.
- **Network Anonymity**: Native support for Tor Network (SOCKS5 proxy) to mask your IP address.
- **Session Protection**: Configurable auto-lock timers and clipboard wiping to protect your session when you step away.
- **No Private Key Sharing**: Your private keys never leave your device.

## 🏗️ Architecture

This repository is a PNPM workspace with:

- **PWA**: `apps/pwa` (Next.js) - Main web application
- **API (optional, local dev)**: `apps/api` (Hono on Node) - Development API server
- **Desktop (Beta)**: `apps/desktop` (Tauri v2 wrapper) - Native desktop app with static PWA bundling and Tor sidecar
- **Packages**: Shared libraries for crypto, storage, and Nostr functionality

### Native Desktop Networking

On Desktop, core networking and identity are handled by the native Rust backend:

- **🔐 Robust Identity**: Active session keys are managed in an isolated, in-memory Rust state, synchronized with the OS Keychain (Windows Credential Manager / macOS Keychain) for persistence and security.
- **Relays (WebSocket)**: Connections are established and managed natively for maximum reliability and multi-relay stability.
- **Uploads (NIP-96)**: File uploads are performed natively via Rust `reqwest`, with cross-provider support (nostr.build, etc.) and native NIP-98 signing.
- **Tor Routing**: When enabled, all native networking (Relays & Uploads) routes via a bundled SOCKS5 proxy (Tor sidecar).

For debugging and recovery:

- **Relay Probe**: `probe_relay` returns stepwise DNS/TCP/WebSocket diagnostics.
- **Reset App Storage**: `reset_app_storage` clears local web storage and known WebView cache folders.

### Smart Invite System

## ⚠️ Known Issues

### Desktop Application (Windows/Linux/macOS)
- If relay connectivity fails, use the built-in relay probe diagnostics and/or reset app storage to clear stale WebView caches.

### Smart Invite System

The Smart Invite System provides secure, user-friendly methods for connecting with others:

- **QR Code Generation & Scanning**: Create and scan QR codes for instant connections
- **Shareable Invite Links**: Generate time-limited, secure invitation links
- **Contact Management**: Organize contacts with groups, trust levels, and search functionality
- **Profile Management**: Control what information you share with privacy settings
- **Cryptographic Security**: All invites are signed and encrypted for maximum security
- **Property-Based Testing**: Comprehensive validation with 100+ test iterations per property

## 🚀 Quick Start

### Prerequisites

- Node.js **>= 20.11**
- PNPM (see `packageManager` in `package.json`)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd obscur

# Install dependencies
pnpm install
```

### Development

#### PWA (Web App)

```bash
pnpm dev:pwa
```

Open `http://localhost:3000` to access the application.

#### API Server (Optional)

```bash
pnpm dev:api
```

The API dev server runs on `http://localhost:8787`.

### Environment Configuration

Create `apps/pwa/.env.local` for local development:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

Available environment variables:
- `NEXT_PUBLIC_API_BASE_URL` - API base URL (default: `http://localhost:8787`)

## 🏗️ Build & Deploy

### Building

```bash
# Build PWA
pnpm build:pwa

# Build API
pnpm build:api

# Build all
pnpm build
```

### Deployment

- **PWA**: Deploy `apps/pwa` to Vercel, Netlify, or any static hosting service
- **API**: Optional - the PWA can function without the API server
- **Desktop**: Built with Tauri v2. Releases managed via GitHub Actions.
- **Mobile**: Android (APK/AAB) built via GitHub Actions.

### Pre-deployment Checklist

- [ ] Set environment variables:
  - `NEXT_PUBLIC_API_BASE_URL` (PWA)
  - `CORS_ORIGIN` (API)
- [ ] Run quality checks:
  - `pnpm run lint:pwa`
  - `pnpm -C apps/pwa build`
  - `pnpm -C apps/pwa test:e2e`
- [ ] Verify functionality:
  - Settings → Health: API check returns OK
  - Relays show at least 1 open/connecting when enabled
  - Theme switching works correctly
  - Empty states display properly

## 📱 Smart Invite System

The Smart Invite System enables secure, intuitive connections between users through multiple methods:

### Core Services

- **Contact Store Service**: Full CRUD operations, group management, trust levels, and advanced search/filtering
- **Profile Manager Service**: User profile management with granular privacy controls and shareable profiles
- **QR Generator Service**: QR code generation, scanning, validation, and automatic expiration handling
- **Crypto Service Extensions**: Secure invite ID generation, data signing, and encryption/decryption

### Key Features

- **QR Code Invites**: Generate scannable QR codes with customizable expiration times
- **Shareable Links**: Create secure, time-limited invitation links
- **Contact Organization**: Group contacts, assign trust levels, and manage relationships
- **Privacy Controls**: Fine-grained control over what profile information to share
- **Cryptographic Security**: All invite data is signed and encrypted
- **Cross-Platform Compatibility**: Works with other Nostr clients and applications

### Testing & Quality

- **77+ Unit Tests**: Comprehensive test coverage for all core functionality
- **Property-Based Testing**: Uses `fast-check` with 100+ iterations per property test
- **Integration Testing**: End-to-end workflow validation
- **Error Handling**: Custom error classes for different failure scenarios
- **Performance Testing**: Optimized for large contact lists and frequent operations

### Implementation Status

✅ **Core Services Complete** (Tasks 1-6)
- All foundational services implemented and tested
- Property-based tests validate universal correctness properties
- Integration tests confirm services work together correctly

✅ **Mobile Parity (v0.7.4)**
- Native Android & iOS support (Tauri v2)
- Hardware-backed Crypto (`tauri-plugin-store`)
- Deep linking & Invite redemption (`obscur://`, `nostr:`)
- Background Keep-Alive for persistent connectivity
- Native Media Uploads & Gallery integration
- Automatic status bar theming
- **Download**: Get the latest builds from [GitHub Releases](../../releases)

🚧 **Next Phase**: UI Components and Integration (Tasks 7-15)
- Invite Manager Service for link and request workflows
- User interface components for all invite features
- Integration with existing Obscur messaging system

## 🎨 UI/UX Features

- **Gradient System**: Subtle, theme-aware gradients throughout the interface
- **Enhanced Empty States**: Engaging illustrations and helpful guidance
- **Loading States**: Skeleton screens, progress indicators, and status feedback
- **Toast Notifications**: Success, error, info, and warning notifications
- **Smooth Animations**: Micro-interactions with reduced motion support
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## 🔧 Technical Details

- **Frontend**: Next.js 16+ with React 19, TypeScript, and Tailwind CSS
- **Crypto**: NIP-04 encryption for secure messaging
- **Storage**: Local-first with localStorage and IndexedDB
- **Protocol**: Nostr with WebSocket relay connections
- **PWA**: Service worker, web manifest, and offline functionality
- **Testing**: Playwright for E2E testing, property-based testing for correctness
- **Smart Invites**: QR code generation, cryptographic signing, contact management
- **Data Persistence**: IndexedDB for contacts, profiles, and invite data

## 📁 Project Structure

```
obscur/
├── apps/
│   ├── pwa/                 # Next.js PWA application
│   │   ├── app/            # App router pages and components
│   │   │   └── lib/
│   │   │       └── invites/ # Smart Invite System core services
│   │   ├── public/         # Static assets and PWA files
│   │   └── package.json
│   ├── api/                # Optional Hono API server
│   └── desktop/            # Tauri desktop app (planned)
├── packages/               # Shared libraries
│   ├── dweb-core/         # Core utilities
│   ├── dweb-crypto/       # Cryptographic functions
│   ├── dweb-nostr/        # Nostr protocol implementation
│   └── dweb-storage/      # Storage abstractions
├── dcos/                  # Documentation
└── .kiro/                 # Kiro AI specifications
    └── specs/
        └── smart-invite-system/ # Smart Invite System design & tasks
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Ensure all quality checks pass before submitting

## 📄 License

This project is open source. See the LICENSE file for details.

## 🔗 Links

- **Live Demo**: [Deployed PWA URL]
- **Documentation**: See `docs/` directory.

## 🔐 Reusable Security & Decentralization Protocols

Obscur is built on a foundation of **modular, production-ready security protocols** designed for maximum privacy and censorship resistance. These core technologies are separated into reusable packages (`packages/`) that can power any high-security application—from healthcare to finance.

> **Read the full technical breakdown in [SECURITY_PROTOCOLS.md](docs/SECURITY_PROTOCOLS.md).**

Key innovations include:
- **NIP-17 Metadata Privacy**: Advanced "Rumor → Seal → Gift Wrap" encryption that hides sender/receiver identity from relays.
- **Local-First Architecture**: Your data lives on your device, encrypted at rest with AES-GCM.
- **Decentralized Identity**: Keys, not accounts. Portable and censorship-resistant.

*Future iterations will focus heavily on expanding these decentralized encryption capabilities for broader use cases.*

- **Issues**: [GitHub Issues]
- **Discussions**: [GitHub Discussions]

## 🙏 Acknowledgments

- Built on the [Nostr protocol](https://nostr.com/)
- Powered by [Next.js](https://nextjs.org/) and [React](https://react.dev/)
- UI components with [Tailwind CSS](https://tailwindcss.com/)
- Desktop app with [Tauri](https://tauri.app/) (coming soon)

---

**Obscur** - Secure, private messaging for micro-communities. 🔒✨