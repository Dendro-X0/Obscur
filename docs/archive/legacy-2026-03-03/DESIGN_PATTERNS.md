# System Design Patterns & Architecture Workflows

This document outlines the core patterns and data relationships that govern the Obscur system's frontend (PWA) and native interaction layer.

## 1. Local-First Mutability & Optimistic UI

Obscur is highly asynchronous since network events via Nostr WebSockets can be delayed, dropped, or arrive out of order.

- **Optimistic Updates**: When a user performs an action (e.g., sending a message or reacting), the UI immediately reflects the state changes locally (e.g., adding a pending message to the Redux/Zustand-like state store) before the event is confirmed and published to the relay.
- **Single Source of Truth**: `IndexedDB` (via `dexie`) serves as the permanent source of truth for the local client. In-memory data structures (like maps of `messagesByConversationId`) act as reactive layers on top of `IndexedDB`.
- **Hydration on Startup**: Upon application startup, state is actively hydrated from the IndexedDB.

## 2. Egalitarian Community Design (Sealed Communities)
Legacy decentralization protocols (like NIP-29) rely on public "Relay Registries" tracking group states (e.g., roles like 'owner', 'mod'). Obscur pivots to an **Egalitarian** design model.

- **No Central Hierarchy**: Authorized keys holding a "Room Key" are considered equal members in a group.
- **Client-Side Consensus**: For moderation (kicking, updating metadata), we use mathematically enforced consensus models:
    - Example: `VoteToKick` checks the number of votes against the total member count. An action only triggers locally if the >50% threshold is met.
- **Symmetric Keys**: Community messages are secured using a single rotated symmetric Room Key distributed to authorized members via NIP-17 Gift-Wrapped messages, ensuring forward secrecy.

## 3. Provider-Based Injection & Hooks Layer

The PWA relies heavily on Context Providers and Custom Hooks to separate business logic from UI elements.

- `useIdentity`: Provides access to the unlocked cryptographic state (keys, preferences).
- `useEnhancedDmController`: Manages the flow of incoming NIP-04/NIP-44 and NIP-17 messages, dispatching them to the correct local `MessageQueue` instances.
- `useSealedCommunity`: Encapsulates the operations for interacting with a given community (fetching messages, sending consensus votes, checking key validity).

The pattern ensures components like `GroupHomePage` or `ChatView` remain strictly concerned with rendering, remaining completely agnostic of how the cryptography or relay networking happens.

## 4. Hardware-Backed Native Storage

Rather than storing the critical `nsec` (private key) in `localStorage` or `IndexedDB`, Obscur relies on the OS-level Native Keychain (Windows Credential Manager, macOS Keychain) when running under the Tauri Native runtime.

1. **Auth Redesign**: During the `/auth/components/auth-screen.tsx` flow, a master key is generated.
2. **Encrypted Persistence**: If the user selects "Remember Me", the key is sealed with a secondary PIN and handed off asynchronously to the Rust Desktop app via IPC (`@tauri-apps/api/core`).
3. **Rust Runtime Integrity**: The `src-tauri` side strictly isolates the memory for private keys, ensuring memory scrapers and browser extensions cannot inject extraction scripts into the frontend easily.

## 5. File & Component Relationships

- **UI Components** (`app/components/ui/`): Stateless, Radix-Primitive based components styled using `TailwindCSS` with standard variant configurations.
- **View Features** (`app/features/`): Domain-driven grouping of business logic.
    - `/auth`: User identity creation, login, PIN unlock dialogs.
    - `/messaging`: Direct communication, sidebars, controllers.
    - `/groups`: Sealed Community specific controllers, UI cards.
    - `/contacts`: Management of connections, requests, user scanning.
- **Shared Utils** (`app/lib/cn.ts`, `packages/dweb-crypto/`): Standard logic for time formats, class combinations, hex manipulations.

By maintaining strict boundaries, updating community logic (like moving from `useNip29Group` to `useSealedCommunity`) rarely breaks generic structural components.
