# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [0.3.2] - 2026-01-31

### Added

- **Custom UI Feedback System**:
  - **Toast Notifications**: Implemented a non-intrusive toast system in the bottom-right corner for success/info actions (save, delete, copy, block).
  - **Custom Confirmation Dialogs**: Replaced system `window.confirm` with a premium, theme-aware `ConfirmDialog` component.
- **Settings Enhancements**:
  - **Interactive Blocklist**: Finished the Blocklist tab implementation, allowing users to view and manage blocked public keys.
  - **Danger Zone Re-design**: Moved account deletion to a dedicated, high-visibility card in Identity Settings with a clear warning system.
- **Bug Fixes**:
  - Fixed a visibility issue where some settings tabs would appear empty or were missing from the navigation groups.

### Fixed

- **Connection Requests**:
  - Made `ConnectionRequestService` the canonical source of truth for connection request status/lifecycle.
  - Requests inbox now hydrates and persists request status through `ConnectionRequestService`.
  - Sending a connection request now persists an outgoing `pending` request record.
  - Request-first enforcement now blocks DM sends to unaccepted peers (must send a connection request first).

## [0.3.1] - 2026-01-31

### Added

- **Account Management**:
  - **Reset & Delete Data**: Added a "Danger Zone" to Identity Settings, allowing users to completely wipe their local account and data for testing or privacy purposes.
- **Onboarding UX**:
  - **Relay Connection Check**: The profile publishing step during onboarding now waits for a healthy relay connection before attempting to save, preventing "User not found" errors for new accounts.
  - **Publishing Error Feedback**: Users are now notified if their profile fails to save during onboarding.
- **Search UX**:
  - **Clearer Instructions**: Updated the "New Chat" dialog to explicitly mention support for Name and NIP-05 searches.

## [0.3.0] - 2026-01-31

### Added

- **User Search & Invitation System (Phases 1 & 2)**:
  - **Enhanced User Discovery**:
    - Supported **NIP-05 identifier verification** for trusted user discovery.
    - Implemented **Profile Metadata Search** to find users by display name or username across relays.
    - Added **QR Code Sharing and Scanning** for instant, in-person connections.
  - **Connection Request Flow**:
    - Implemented **ConnectionRequestService** for persistent invitation lifecycle management.
    - Created a **Personalized Connection Request** dialog, allowing users to introduce themselves before connecting.
    - Enhanced the **Requests Inbox** with clear connection labels, status indicators (`pending`, `accepted`), and peer avatars.
    - Updated the messaging controller to distinguish between regular DMs and connection requests using custom Nostr tags.
  - **Enhanced Trust & Privacy (Phase 3)**:
    - Added a **Stranger Message Warning** banner for non-accepted peers, ensuring safe first interactions.
    - Overhauled **Privacy & Trust Settings** with a unified view of accepted, muted, and blocked peers.
    - Implemented a **Privacy & Trust Guide** and internal search within the settings panel.
  - **Improved Search UX (Phase 4)**:
    - Implemented a **Unified Search Interface** that intelligently handles NIP-05, aliases, npubs, and hex pubkeys in a single input.
    - Enhanced **Search Results** with rich profile metadata, including user bios (`about`) and a **"Trusted"** badge for already accepted contacts.
    - Streamlined the search UX by combining separate "Verify" and "Search" actions into one seamless workflow.
  - **Web of Trust & Mutual Connections (Phase 5)**:
    - Implemented **Social Graph Service** to manage contact lists (Kind 3 events) and build a local social graph.
    - Added **Mutual Connection** calculation in search results to show shared contacts.
    - Introduced **Trust Score** algorithm (+20 for NIP-05, +20 per mutual connection) to highlight trusted users.
    - Added UI indicators for "Trusted" status and mutual count in profile cards.
  - **Relay Improvements & Discovery (Phase 6)**:
    - **Automatic Relay Hints**: Connection requests now include sender's write relays (NIP-65) to ensure reliable reply delivery.
    - **Relay Suggestions**: Empty search results now suggest popular relays to connect to, helping users find people on different networks.

### Fixed

- **Message Persistence**: Fixed a synchronization issue in the requests inbox where unread counts were not accurately tracked during state updates.
- **Type Safety**: Resolved multiple TypeScript errors related to message status variants and shorthand property initializers in hooks.

### [Unreleased]

### Added

- **Performance Optimization (Phase 8)**:
  - **Worker-Based Crypto Architecture**: Moved heavy cryptographic operations (event signing, NIP-04 encryption/decryption) to a Web Worker using `Comlink`. This ensures the main UI thread remains responsive during intensive tasks.
  - **Crypto Service Refactoring**: Decoupled core logic into `CryptoServiceImpl` and introduced `crypto-interfaces.ts` to break circular dependencies.
  - **Async Test Suite**: Updated `crypto-service.test.ts` to handle asynchronous worker communication (Work in Progress: some property-based tests are failing due to mock timing/determinism issues).

### Fixed

- **Internationalization (i18n)**: Restored missing English translation keys causing UI labels to display as "messaging.searchChats" etc.
  - Created dedicated `en.ts` locale file.
  - Updated i18n configuration to load translations correctly.
- **Relay Testing**: Resolved "stuck" testing state for relay features.
  - Fixed Vitest configuration alias issues (`@/` not resolving).
  - Updated integration tests to support NIP-17 "Gift Wrap" encryption (Kind 1059).
  - Verified multi-relay failover and real-time subscription logic.

### Changed

- **Codebase Refactoring (Pre-Phase 8)**:
  - **Feature-Based Architecture**: Migrated messaging controllers and hooks to `app/features/messaging` and `app/features/relays` for better modularity.
  - **Import Cleanup**: Updated codebase to use absolute `@/` imports consistently, eliminating fragile relative paths.
  - **Relay Hooks Standardization**: Consolidated relay connection logic into `useEnhancedRelayPool`, ensuring consistent behavior across the app.
  - **Testing Infrastructure**: Fixed integration tests for multi-relay failover to work with the new architecture.



## [0.2.9] - 2026-01-30

### Fixed

- **UI & Aesthetics**:
  - **Critical Rendering Fixes**: Resolved "Element type is invalid" error in `AppShell` and fixed invisible buttons by adding missing `.bg-gradient-primary` utility.
  - **Build Stability**: Fixed a TypeScript error in `useMainShellState` (duplicate property name) and a `Message` type mismatch (missing `kind` and `status` variants) that were blocking production builds.
  - **Premium Design System**: Implemented vibrant gradients and glassmorphism for Identity Cards, Empty States, and the Messaging Sidebar.
  - **Settings Page Polish**: Fixed visual bugs in Light Mode (white text on white background) and removed duplicate page titles in the header.
- **Internationalization (i18n)**:
  - **Complete Translations**: Added missing keys for Security, Health, and Appearance settings, replacing raw function names with human-readable labels.
  - **Desktop Updater**: Integrated translations for update notifications and buttons.
  - **Keyboard Shortcuts**: Localized the help modal and invite sharing components.

## [0.2.8] - 2026-01-24

### Added

- **Privacy & Security Hardening (Phase 7)**:
  - **Metadata Privacy (NIP-17)**: Implemented "Gift Wrap" messaging. Messages are now triple-layered (Rumor → Seal → Gift Wrap) to cryptographically hide sender and recipient identities from relays.
  - **Data-at-Rest Encryption**: Local message storage (IndexedDB) is now encrypted with AES-GCM using a key derived from your passphrase.
  - **Tor Network Support**: Native SOCKS5 proxy configuration for routing traffic through Tor (masked IP).
  - **Privacy Dashboard**: New "Privacy & Safety" settings panel to manage encryption, auto-lock, and anonymity settings.
  - **Clipboard Safety**: Optional setting to automatically clear the clipboard when the identity locks.

### Fixed

- **Relay Stability**: Switched default relay from `relay.nostr.band` (unstable) to `relay.primal.net` (stable) for improved connection reliability.
- **Hydration Mismatches**: Resolved React hydration errors in localized UI components (Sidebar search, tabs, buttons) caused by language switching.
- **Desktop UX**: Restored visibility of scrollbars in the Settings tab bar to fix accessibility issues on non-touch desktop devices.

## [0.2.7] - 2026-01-24

### Added

- **Auto-Lock Security System**: Comprehensive session protection for all users.
  - Automatic identity locking after a configurable period of inactivity.
  - Re-unlocking requires the user's passphrase, clearing private keys from memory while locked.
  - **Smart Restoration**: App automatically remembers and restores the last visited conversation or tab after unlocking.
  - **Premium UI**: New blurred-glass Lock Screen and a friendly "Welcome home" greeting for returning users.
  - **Configurability**: New "Security" tab in settings to customize lock behavior.

### Fixed

- **Vercel Deployment**: Completely resolved persistent 404 errors and `ChunkLoadError` on cold starts.
  - Fixed Turbopack path resolution for monorepo structure.
  - Optimized Vercel build to include only necessary dependencies while preserving required internal packages.
- **Version Management**: Unified the versioning system into a single source of truth (`version.json`) with automated synchronization.

## [0.2.6] - 2026-01-23

### Fixed

- **Vercel Deployment**: Fixed blank page issue on Vercel deployments
  - Implemented conditional static export based on build context
  - Vercel now uses dynamic rendering while desktop builds use static export
  - Added `TAURI_BUILD` environment variable to distinguish build contexts
  - Added `cross-env` dependency for cross-platform compatibility

### Technical

- Modified `next.config.ts` to conditionally enable `output: "export"`
- Updated Tauri build command to set `TAURI_BUILD=true`
- Updated GitHub Actions workflow to support both build modes

## [0.2.5] - 2026-01-23

### Added

- **Localization**: Full support for English, Chinese (Simplified), and Spanish.
  - Complete translation of Settings page (Identity, Relays, Notifications, Blocklist, etc.).
  - Language selector with persistent preference.
  - Dynamic app title localization.

### Improved

- **UI Polish**:
  - Enlarged globe icon in language selector.
  - Updated app title to "Obscur" consistently across the UI.
  - Enhanced loading states for Settings tabs to prevent layout shifts.
- **Stability**:
  - Fixed hydration mismatches in navigation links and page titles.
  - synchronized versioning across PWA and Desktop apps.

## [0.2.4] - 2026-01-20

### Added

- **Smart Invite System Core Services**: Complete implementation of foundational invite system
  - Contact Store Service with full CRUD operations, group management, trust levels, and search/filtering
  - Profile Manager Service with profile management, privacy settings, and shareable profiles
  - QR Generator Service with QR generation, scanning, validation, and expiration handling
  - Crypto Service Extensions with invite ID generation, data signing, and encryption/decryption
  - Core Services Integration with end-to-end workflow validation
  - Property-based testing framework with 100+ iterations per test for comprehensive validation
  - 77+ unit tests covering all core functionality with high coverage
  - IndexedDB integration for persistent contact and profile storage
  - Comprehensive error handling with custom error classes for different failure scenarios

## [0.2.3] - 2026-01-11

### Fixed

- **Desktop App Crash**: Fixed immediate crash on startup by resolving configuration conflicts
  - Removed conflicting window creation in main.rs
  - Updated Tauri configuration to properly load external PWA URL
  - Configured build settings for external URL loading

## [0.2.2] - 2026-01-11

### Fixed

- **GitHub Workflow**: Fixed pnpm version mismatch between workflow and package.json

## [0.2.1] - 2026-01-11

### Fixed

- **GitHub Workflow**: Fixed pnpm installation order in release workflow to resolve build failures

## [0.2.0] - 2026-01-11

### Added

- **Enhanced UI/UX System**: Complete visual overhaul with subtle gradients and smooth animations
  - Gradient system with theme-aware backgrounds for main areas, sidebar, cards, and buttons
  - Enhanced empty states with illustrations and engaging copy for chats, search, relays, and requests
  - Comprehensive loading states including skeleton screens, progress indicators, and message status
  - Toast notification system with success, error, info, and warning types
  - Smooth theme transitions with reduced motion support
  - Enhanced micro-interactions for buttons and inputs with hover animations
  - Page transition animations with fade-in effects
  - Navigation feedback animations with active state indicators
  - Toggle switch animations for settings controls
  - Cross-browser compatibility with CSS fallbacks
  - Consistent shadow and border system for visual hierarchy

- **Automated Release System**: GitHub workflow for creating desktop app releases
  - Automatic release creation when version tags are pushed
  - Cross-platform builds (Windows MSI, macOS DMG, Linux AppImage/DEB)
  - Comprehensive release notes with feature highlights
  - Proper Tauri bundle configuration with metadata

### Improved

- **Visual Polish**: Subtle warm gradients in light theme, deep rich gradients in dark theme
- **User Feedback**: Better visual feedback for all interactive elements and loading states
- **Accessibility**: Maintained WCAG contrast ratios and added reduced motion support
- **Component Library**: Enhanced Button, Input, Card, and other UI components with gradient backgrounds
- **Performance**: Optimized animations for mobile devices and reduced motion preferences
- **Code Quality**: Fixed all linting issues and improved component structure
- **Repository Structure**: Cleaned up large files and improved .gitignore for better maintainability

### Fixed

- **Large File Issues**: Removed Rust build artifacts from Git history to enable GitHub pushes
- **Missing Assets**: Recovered logos and UI enhancements that were lost during repository cleanup

## [0.1.0] - 2026-01-09

### Added

- Obscur branding (metadata + PWA manifest).
- Responsive mobile navigation for chat shell (hamburger / off-canvas sidebar).
- Settings mobile hamburger menu (quick navigation drawer).
- PWA assets and routes (manifest, icons, service worker endpoint).
- Delivery status UI, unread badges, and notification preference handling.
- `desktop/` placeholder for the future Tauri v2 wrapper.

### Fixed

- `useSyncExternalStore` snapshot caching to prevent infinite update loops.
- PWA icon route handlers to avoid JSX parsing issues.
