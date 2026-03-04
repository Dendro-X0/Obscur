# Technology Stack

Obscur is built as a highly modular `pnpm` workspace, heavily leveraging modern TypeScript and Rust for its different environments.

## Frontend
- **Framework**: Next.js (App Router) with React 19
- **Styling**: Tailwind CSS with custom gradient systems and responsive design
- **State/Data**: Local-first approach using specialized React hooks and native providers
- **Testing**: `vitest` for unit/property-based testing, `@testing-library/react` for components, Playwright for E2E.

## Backend / Native Runtimes
- **Desktop/Mobile Engine**: Tauri v2, providing the native OS integrations (Windows, macOS, Linux, Android, iOS).
- **Core Native Backend**: Rust (`src-tauri`). Handles intensive cryptographic signing, native relay connections (WebSocket via `tokio-tungstenite`), OS keychain management (`keyring`), and secure Tor sidecar routing.
- **API Server** (Optional/Coordination): Hono (Node.js/Cloudflare Workers) used in `apps/api` and `apps/coordination`.

## Languages & Core Tools
- **TypeScript**: Strict typing enforced across the `apps/pwa` and all shared `packages/dweb-*` libraries. Avoidance of monolithic files in favor of single-purpose utility functions.
- **Rust**: Provides memory-safe, high-performance cryptographic fallbacks and native networking.
- **Nostr Protocol**: Deep integration with modern NIPs (Nostr Implementation Possibilities):
  - **NIP-04 / NIP-44**: Direct message encryption
  - **NIP-17**: Metadata privacy (Gift Wrap -> Seal -> Rumor)
  - **NIP-96**: File storage/uploads
  - **NIP-98**: HTTP Auth for attachments
  - **NIP-25**: Reactions
- **Package Manager**: `pnpm` (Workspace configured).
