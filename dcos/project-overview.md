# Project Overview

## Product goals

- Invite-only and no-registration: reduce spam and preserve small-community trust.
- Local-first identity: identity, trust, and social state live on-device and are scoped per identity.
- Nostr interoperability: use Nostr relays for transport and NIP standards where possible.
- Safe-by-default inbound interactions: unknown senders and join flows require explicit user intent.

## Non-goals (v1)

- Centralized accounts (email/phone registration).
- Global discovery (trending, recommended users/groups).
- Automatic cross-device syncing of personas.

## Tech stack

- **PWA frontend:**
  - Next.js 16+ (App Router)
  - React 19
  - TypeScript
  - Tailwind CSS 4
  - Property-based testing with fast-check
  - Playwright for E2E testing
- **Desktop:**
  - Tauri v2 (desktop wrapper)
  - Rust (Tauri runtime/backend)
- **Transport:**
  - Nostr relays (WebSocket connections)
  - Encrypted messaging (NIP-04)
- **UI/UX:**
  - CSS custom properties for theming
  - Gradient system with OKLCH color space
  - Smooth animations with reduced motion support
  - Progressive Web App features (service worker, manifest)

## Feature map (current)

- **Identity**
  - Locked/unlocked identity UX with smooth transitions
  - Local storage boundaries keyed by identity public key
  - Theme preferences and UI state persistence
- **Messaging**
  - Message composition UX with enhanced interactions
  - Message status indicators (sending, delivered, read, failed)
  - Basic content rendering and link preview support
  - Enhanced empty states for conversations
- **User Interface**
  - Gradient system with theme-aware backgrounds
  - Smooth animations and micro-interactions
  - Toast notifications for user feedback
  - Skeleton loading states for better perceived performance
  - Responsive design for desktop, tablet, and mobile
  - Accessibility support with reduced motion preferences
- **Invites**
  - Deep link parsing and review
  - Save/open flows scoped to identity
  - Enhanced empty states with helpful guidance
- **Requests**
  - Inbox model for unknown inbound interactions (foundation for safety model)
  - Visual indicators and improved empty states
- **Settings**
  - Card-based layout with visual hierarchy
  - Relay management with connection status indicators
  - Profile customization and preferences
  - Health diagnostics and system status

## Architecture notes

### Boundaries

- PWA UI lives in `apps/pwa/app`.
- Desktop wrapper lives in `apps/desktop/src-tauri`.
- Public brand assets live in `apps/pwa/public`.

### Identity scoping

A core invariant is that any user-facing state that affects safety or privacy is keyed by identity public key.

Examples:

- Requests inbox is scoped per identity.
- Invites inbox is scoped per identity.
- Relay list is scoped per identity.
- Block/mute state is scoped per identity.

## Known challenges / risks

- Privacy metadata leakage:
  - Relay choice affects who can observe group membership and message routing metadata.
- UI state leakage between personas:
  - Cross-persona caches or global stores can accidentally mix state.
- Safety model consistency:
  - Unknown inbound DMs, group joins, and invite flows must share a consistent trust vocabulary.
- Desktop/PWA parity:
  - Desktop wrapper should remain a thin shell over the PWA without diverging logic.

## Roadmap

See ./community-roadmap.md
