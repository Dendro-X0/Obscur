# Obscur

Obscur is a local-first Nostr messenger designed for small, invite-only micro-communities. Built with privacy, decentralization, and anti-censorship as core principles.

## ✨ Features

- **🔒 Privacy-First**: End-to-end encrypted messaging using NIP-04 encryption
- **🌐 Decentralized**: Built on the Nostr protocol with relay-based architecture
- **👥 Invite-Only**: Secure micro-communities with invitation-based access
- **🎨 Modern UI**: Subtle gradients, smooth animations, and polished user experience
- **🌙 Theme Support**: Beautiful light and dark themes with system preference detection
- **📱 Progressive Web App**: Installable with offline functionality and push notifications
- **🖥️ Cross-Platform**: Web app with planned desktop and mobile versions

## 🏗️ Architecture

This repository is a PNPM workspace with:

- **PWA**: `apps/pwa` (Next.js) - Main web application
- **API (optional, local dev)**: `apps/api` (Hono on Node) - Development API server
- **Desktop (planned)**: `apps/desktop` (Tauri v2 wrapper) - Native desktop app
- **Packages**: Shared libraries for crypto, storage, and Nostr functionality

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
- **Desktop**: Coming soon with Tauri v2 packaging

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

## 📁 Project Structure

```
obscur/
├── apps/
│   ├── pwa/                 # Next.js PWA application
│   │   ├── app/            # App router pages and components
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
- **Documentation**: See `dcos/` directory
- **Issues**: [GitHub Issues]
- **Discussions**: [GitHub Discussions]

## 🙏 Acknowledgments

- Built on the [Nostr protocol](https://nostr.com/)
- Powered by [Next.js](https://nextjs.org/) and [React](https://react.dev/)
- UI components with [Tailwind CSS](https://tailwindcss.com/)
- Desktop app with [Tauri](https://tauri.app/) (coming soon)

---

**Obscur** - Secure, private messaging for micro-communities. 🔒✨