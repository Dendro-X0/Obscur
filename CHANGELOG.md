## [v0.8.1] - 2026-03-04

### Added

- **Runtime Log Classification Contract**:
  - Added shared runtime log policy utility with `expected | degraded | actionable` classes.
  - Standardized rate-limited runtime logging via `logRuntimeEvent(...)` for startup-noise paths.
- **Decrypt Failure Classification**:
  - Added explicit decrypt failure classifier to separate foreign/malformed noise from actionable regressions.
  - Added unit coverage for decrypt classification behavior.
- **Relay Runtime Status Model**:
  - Added normalized relay status model: `healthy | degraded | unavailable`.
  - Added unit coverage for relay runtime status derivation.

### Changed

- **Startup and Runtime Signal Hygiene**:
  - Downgraded expected migration-audit and decryption-miss startup noise to bounded lower-severity logs.
  - Hardened DM subscription lifecycle idempotency to suppress duplicate subscribe/close churn.
- **Media Error UX Contract**:
  - Introduced shared media error metadata (`recoverable`, `reasonCode`, `canRetry`, `canOpenExternal`).
  - Unified audio/video/image failure handling with retry + open-external actions.
- **Relay UX**:
  - Relay badge and settings now use normalized degraded-state messaging with actionable guidance.
- **Release Operations**:
  - Added required artifact matrix verification in release workflow before publishing GitHub release assets.
- **Perf Tooling Docs**:
  - Expanded synthetic-load runbook with standardized 10k seed + burst maintainer scenario and safety guardrails.
- **Media Timeline UX**:
  - Switched multi-image/video message rendering to an ordered visual-media carousel.
  - Added left/right navigation controls, keyboard arrow navigation on desktop, and swipe navigation on touch devices.
- **App Shell Footer Labeling**:
  - Replaced stale hardcoded version text in chat shell footers with a release label (`Obscur Preview`) to avoid version drift in UI chrome.

### Fixed

- **Attachment Cache Path Resilience**:
  - Cache permission/path failures now trigger one actionable warning per session and gracefully fall back to remote playback.
- **Message List Hotspot**:
  - Reduced repeated local index parsing in attachment rendering by snapshotting local media index per render cycle.
- **Image Lightbox Controls**:
  - Replaced text close action with an `X` icon.
  - Added wheel zoom (desktop), pinch zoom (mobile), and explicit `+` / `-` zoom controls.

## [v0.8.0] - 2026-03-04

### Added

- **Release Version Integrity Gate**:
  - Added `pnpm version:check` (`scripts/check-version-alignment.mjs`) to enforce release-tracked manifest alignment with root `package.json`.
  - Added `.github/workflows/version-check.yml` to run version-alignment checks in CI on relevant manifest/script changes.
  - Added release preflight checks in `.github/workflows/release.yml` to run `version:check` and `docs:check` before desktop/mobile build jobs.

### Changed

- **Version Sync Coverage**:
  - Hardened `scripts/sync-versions.mjs` with explicit coverage for `apps/pwa`, `apps/desktop`, desktop `tauri.conf.json`, `apps/website`, `apps/relay-gateway`, `packages/*`, and `version.json`.
  - Kept `apps/coordination/package.json` intentionally unversioned for this release cycle.

- **Release Runbook**:
  - Updated docs to require `pnpm version:sync` and `pnpm version:check` as pre-tag checklist steps.
  - Updated root `README.md` and docs index/runbooks with explicit `v0.8.0` release-preparation commands and references.

## [v0.7.3-alpha] - 2026-03-03

### Added

- **Phase 1 Chat Performance Mode (Feature-Flagged)**:
  - Added `chatPerformanceV2` to privacy settings with safe default `false`.
  - Added a Storage settings toggle: **Chat Performance Mode (Phase 1)** for controlled rollout.
- **Batching Test Coverage**:
  - Added persistence batching tests for dedupe, legacy parity, and grouped deletes.
  - Added reducer tests for buffered conversation events and soft live-window behavior.
  - Added group merge tests for dedupe/order/cap behavior.

### Changed

- **Message Persistence Throughput**:
  - Refactored message persistence to queue bus events and flush in batches (32ms cadence, immediate flush at 50 ops) when `chatPerformanceV2` is enabled.
  - Added dedupe-by-message-id per flush and lifecycle-triggered flushes on page hide/unload.
  - Grouped delete operations into a single IndexedDB bulk transaction.
- **Conversation UI Update Path**:
  - Refactored conversation message updates to apply buffered message-bus events once per animation frame in performance mode.
  - Added soft live window policy for active flow (target 120 newest messages), while preserving expanded history after explicit `loadEarlier`.
  - Tuned low-end pagination profile in perf mode (`INITIAL_BATCH_SIZE=60`, `LOAD_EARLIER_BATCH_SIZE=60`).
- **Message List Runtime Adaptation**:
  - Introduced high-load mode heuristics (message count, incoming backlog, fast scrolling).
  - Added adaptive virtualizer overscan (4 under load, 8 normal).
  - Disabled expensive gestures during high-load periods (pull-to-refresh drag and swipe-to-reply drag), while preserving non-drag reply paths.
  - Reduced render-path overhead by precomputing/memoizing per-message render metadata (JSON parse + attachment URL/content derivation).
- **Group Chat Current-Range Stabilization**:
  - Buffered incoming sealed community messages and applied batched state updates with dedupe by event id.
  - Optimized descending merge path with fast-path handling for common single-event inserts to avoid unnecessary full re-sorts.

### Fixed

- **Scroll/Render Jank Under Burst Traffic**:
  - Reduced UI churn from per-event updates in both DM and group flows by switching to batched reducers and batched persistence writes in perf mode.
- **Performance Observability Gaps**:
  - Extended performance monitor counters/metrics with:
    - message bus events per second
    - average batch size
    - average batch flush latency
    - merged/dropped event counts
    - UI update latency p95

## [v0.7.12-alpha] - 2026-03-01

### Fixed

- **NIP-04 Protocol Fix**: Resolved "Failed to decrypt message" errors by removing incorrect SHA256 hashing of the shared secret X-coordinate, ensuring full NIP-04 compliance and interoperability with other Nostr clients.
- **UI Interaction Stability**:
  - Replaced fragile Tailwind-only animations with robust `modal-transition` CSS to fix the "invisible mask" issue in the "Add Connection" and "Send Request" dialogs.
  - Fixed action button clipping in the Network Dashboard by increasing vertical padding in the action header.
  - Refined "Create New Group" UI by removing unnecessary shadows from footer buttons.
- **Messaging Responsiveness**: Optimized NIP-20 `OK` acknowledgment timeout (10s -> 4s) to improve UI snappy-ness after broadcasting events.
- **Multimedia Improvements**:
  - Enhanced `extractAttachmentsFromContent` to support native audio file detection and categorization.
  - Hardened NIP-96 upload service by downgrading intermediate provider failures to `warn` (avoiding blocking Next.js dev overlays) and optimizing retry logic.
  - **Build & Types Standardization**: Fixed a critical TypeScript build error in the PWA by standardizing terminology from `Contact` to `Connection` and `ContactGroup` to `ConnectionGroup` across the network components, aligning them with the core invite system types.
- **Store Refactoring**: Renamed internal `contactStore` references to `connectionStore` for architectural consistency.

### [Unreleased]

### Added

- **Multimedia Support (WP-6)**: Implemented full video and audio upload support in chat via NIP-96.
  - Client-side compression for videos using `@ffmpeg/ffmpeg` (WASM) to transcode to 720p/128k before upload.
  - Automatic logic for generating lightweight thumbnails for video previews directly in the browser.
  - Smart NIP-96 provider routing: images are routed to `nostr.build`, while larger video/audio files are routed to `void.cat` and `sovbit`.
  - Added custom, aesthetically pleasing `VideoPlayer` and `AudioPlayer` components for inline media playback within the chat UI.
  - Complete internationalization (i18n) for media statuses in Chinese, Spanish, and English.
  - Added an explicit **best-effort storage model** for OSS/no-cloud operation, including in-app guidance that uploads depend on public NIP-96 providers and external-link fallback for critical media.

### Changed

- **Media Upload Reliability Policy**:
  - Introduced shared upload limits tuned for public providers: image 8MB, audio 20MB, video 35MB.
  - Added final pre-upload validation in `Nip96UploadService` so all upload entrypoints (chat + group/avatar flows) enforce the same constraints.
  - Added policy-based image preprocessing before upload, plus stricter UX messaging for timeout/size failures.
  - Updated composer UI copy to explain why media delivery is best-effort without dedicated cloud infrastructure.

### Fixed

- **Tor Network Integration (WP-5)**: Fixed "os error 3" and "os error 193" when activating Tor by correcting Sidecar paths for Tauri v2.
  - Wrote a Node.js pre-script (`scripts/setup-tor.mjs`) to auto-download and extract the correct Tor Expert Bundle binary for the host OS/architecture.
  - Re-configured `tauri.conf.json` and capabilities to use the flattened `tor` executable path.
- **Media CORS Issues**: Removed overly restrictive COOP/COEP headers from `next.config.ts`, unlocking CORS capabilities for playing media from third-party storage providers inside the `VideoPlayer`.
- **UI/UX Enhancements**:
  - Implemented a unified animated `AuthScreen` with FlashMessages, replacing native toasts.
  - Reordered the Profile Settings page to center the user avatar above the username.
  - **Avatar Redirection**: Clicking own avatar in message history maps to Settings -> Profile, while other avatars map to their respective Connection Profiles.
  - **Message List Performance**: Migrated to IndexedDB, added message virtualization, anchored scrolling, and debounced filters for smoother chat interactions.

## [v0.7.11-alpha] - 2026-02-27

### Phase 4: Native Mobile Implementation Complete (WP-3 to WP-6)

- **WP-3: Background Sync**: Implemented background synchronization engines for Android (`WorkManager`) and iOS (`BGAppRefreshTask`) calling into `libobscur` to securely fetch and decrypt messages while the app is suspended.
- **WP-4: Secure Key Storage**: Integrated OS-level hardware-backed keystores (`AndroidKeyStore` and iOS `SecureEnclave`) for robust private key management. Added biometric authentication requirements.
- **WP-5: Mobile UX Adaptation**:
  - Overhauled layout with safe area insets (`env(safe-area-inset-bottom)`) and expanded `10rem` padding to prevent bottom navigation bar overlap.
  - Implemented a unified `MobileTabBar` to replace the desktop sidebar on small screens.
  - Added swipe-to-reply gestures and native keyboard adjustments.
  - Refined Settings and Network pages for a strict master-detail mobile flow, dropping redundant headers.
- **WP-6: CI/Release Pipeline**:
  - Configured GitHub Actions workflows (`build-android.yml`, `build-ios.yml`) for automated building and signing of Android (APK/AAB) and iOS (IPA) artifacts.
  - Added automated workspace version synchronization script (`sync-versions.mjs`).
  - Added a comprehensive `MOBILE_RELEASE_GUIDE.md`.

## [v0.7.10-alpha] - 2026-02-26

### Phase 4: Native Mobile Implementation (WP-1 & WP-2)

- **WP-1: Tauri V2 Mobile Scaffold**:
  - Initialized Android project scaffold in `apps/desktop/src-tauri/gen/android/`.
  - Configured `tauri.conf.json` with universal identifier `app.obscur.desktop` and correct mobile SDK target versions (Android 7.0+, iOS 16+).
  - Added target-specific Rust dependencies in `Cargo.toml` for Android and iOS platforms.
  - Successfully configured the build environment for cross-platform Rust targets (`aarch64-linux-android`, `aarch66-apple-ios`, etc.).
- **WP-2: Privacy-Preserving Push Notifications**:
  - Created detailed technical specification: `docs/PHASE_4_NATIVE_MOBILE_SPEC.md`.
  - Implemented `decrypt_push_payload` in `libobscur` (Rust) to handle local decryption of E2EE push notifications.
  - Enabled `tauri-plugin-notification` permissions in `desktop.json` and `mobile.json` capabilities.

### Changed

- **Messaging Controller Decomposition (WP-2)**: Continued extracting logic out of `EnhancedDMController` into focused service modules to improve testability and reduce controller size.
  - Extracted/extended outgoing send pipeline helpers (optimistic insert, publish, fallback, queueing).
  - Extracted relay `OK` handling into a dedicated handler.
  - Extracted recipient relay-hint application (nprofile + NIP-65 write relays).
- **Light Theme Polish**: Enhanced light theme color scheme for settings and chat area to improve contrast and "premium" feel.

### Added

- **Messaging controller service modules** (Phase 1 / WP-2):
  - `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
  - `apps/pwa/app/features/messaging/controllers/outgoing-dm-send-preparer.ts`
  - `apps/pwa/app/features/messaging/controllers/relay-ok-message-handler.ts`
  - `apps/pwa/app/features/messaging/controllers/recipient-relay-hints.ts`
- **WP-2 progress note**: `docs/WP-2_DM_CONTROLLER_DECOMPOSITION_PROGRESS.md`

## [v0.7.9-alpha] - 2026-02-23

### Major Refactor: Transition to "Connections"

- **Terminology Standardization**: Systematically renamed all "Contact" related terminology to "Connection" across the invite system, services, and UI components to better reflect the underlying cryptographic relationships.
- **Unified Invite Manager**: Completed the final implementation of the `InviteManager` as the central orchestrator for QR codes, shared links, and connection requests.
- **Enhanced Deep Link Handling**: Updated `DeepLinkHandler` and `URLSchemeHandler` to support `obscur://connection/` schemes and `connection` URL search parameters.
- **UI/UX Synchronization**: Refactored major components including `ConnectionRequestInbox`, `ConnectionList`, `ConnectionImportExport`, and `OutgoingConnectionRequests` to use the new connection-based APIs and terminology.

### Added

- **Messaging UI Avatars**: Implemented bottom-aligned, orientation-aware avatars in `MessageList`. Incoming avatars appear on the left, outgoing on the right.
- **Unified Invitation Cards**: Refactored `CommunityInviteCard` into a premium "rich card" layout that adapts its footer actions based on invite status and ownership.
- **Response Banner Styling**: Standardized `CommunityInviteResponseCard` with elegant status banners and icons (PartyPopper/Ban).

### Changed

- **Privacy Settings**: Renamed `allowContactRequests` to `allowConnectionRequests` in the profile privacy configuration for consistent terminology.
- **Search & Performance**: Updated `ConnectionSearchIndex` and internal caching mechanisms with improved terminology and optimized word indexing.
- **Accessibility & UX**: Standardized ARIA labels, keyboard hints, and error messages in `accessibility-ux.ts` to use "connection" terminology.

### Fixed

- **Store TypeError**: Resolved `TypeError: connectionStore.getContactByPublicKey is not a function` by implementing the missing method in `connection-store.ts` and updating the interface.
- **Render Safety**: Added robust null-checks for `.slice()` and string indexing in `UserAvatar`, `ChatHeader`, and `SenderName` to prevent crashes during profile resolution.
- **Template Literal Parsing**: Fixed multiple instances of broken or escaped template literals in `accessibility-ux.ts` that were causing rendering and linting issues.
- **Deep Link Routing**: Resolved an issue where contact-based deep links were not correctly resolved after the terminology shift.

## [v0.7.8-alpha] - 2026-02-21

### Major Overhaul: Sealed Communities Protocol

- **Egalitarian Privacy First**: Deprecated legacy NIP-29 administrative roles. Implemented the "Sealed Communities" (Kind 10105) protocol where all keyholders participate as equal members, ensuring maximum decentralization and privacy.
- **Invite & Key Distribution**: Implemented deterministic NIP-17 Gift-Wrapped DMs for secure, peer-to-peer distribution of Community Room Keys. Support for QR code scanning and `obscur://` deep link invite redemption.
- **Consensus Moderation**: Introduced "Vote to Kick" sealed events. Content moderation and member expulsion now rely on a strictly enforced >50% client-side consensus threshold, eliminating single points of administrative failure.
- **Secure Key Rotation**: Automated cryptographic Room Key rotation upon member expulsion to maintain community integrity.
- **Registry Independence**: Communities can now operate without centralized relay tracking, relying entirely on obscured identifiers and shared secrets.

### Added

- **Unified Auth Flow**: Completely redesigned the authentication and onboarding experience. Integrated account creation and login into a single, high-fidelity `AuthScreen` with smooth `framer-motion` animations.
- **"Remember Me" Persistence**: Implemented opt-in session persistence. Users can now choose to save their encrypted session, allowing for seamless auto-unlock on app restart.
- **Instant Discovery**: Account creation now automatically generates and publishes a unique invitation code in the background, making new users immediately discoverable.
- **Sidebar Categorization**: Introduced a unified Segmented Control to toggle between "Chat" (Direct Messages) and "Community" (Groups), replacing static buttons.
- **Chat Management**: Users can now pin, unpin, and soft-delete (hide) conversations directly from the sidebar via a new three-dot context menu. Pinned chats remain reliably at the top.
- **Request Inbox Management**: Added a "Clear All" button to instantly wipe the connection requests inbox history.
- **Community Invitation UI**: Introduced `CommunityInviteResponseCard` to display invitation acceptance/rejection status as an elegant notification pill instead of raw JSON.
- **Group Member Presence**: Implemented dynamic member discovery tracking. The app now persists members discovered through live chat history to the local database.

### Changed

- **Technical Protocols**: Standardized all internal persistence schemas and React hooks around the simplified egalitarian protocol, greatly reducing state fragmentation.
- **UI Architecture**: Extracted Radix-based components (Checkbox, Avatars) and completely redesigned interactive lists to eliminate nested `<button>` hydration errors and improve keyboard accessibility.
- **Streamlined Onboarding**: Removed the multi-step `OnboardingWizard` in favor of the new unified `AuthScreen`.
- **Global Esthetics (Midnight Slate)**: Shifted the primary color system from generic grays to a premium "Midnight Slate / Indigo" palette using OKLCH color spaces. Enhanced dark mode depth and light mode clarity across the entire PWA.

### Fixed

- **Strict Relay Clock Skew**: Fixed an "event too much in the future" error that occurred when publishing events to strict relays. A conservative negative offset has been applied to the timestamp generation logic natively.
- **Community Creation Resilience**: Fixed a critical issue where group creation failed on strict relays (like `groups.fiatjaf.com`) with a `group doesn't exist` error.
- **Test Suite Stability**: Resolved all failures in the `apps/pwa/app/features/invites/utils/__tests__` test suite (13 files, 154 tests now passing).
- **Localization Resilience**: Fixed missing and misconfigured English translation keys (e.g., `messaging.pin_chat`, `messaging.direct_messages`) that were causing raw function/key names to render in the UI.
- **Dependency Resolution**: Fixed a `Module not found` error for `@radix-ui/react-checkbox`.
- **Hydration & Semantics**: Fixed multiple DOM nesting errors where interactive elements were improperly wrapped inside buttons in the Sidebar and Search views.
- **Community Invite Crash**: Fixed a critical `TypeError: adminPubkeys is not iterable` that occurred when accepting group invitations.
- **Group Member Sync**: Resolved the "1 Member" bug by properly seeding both the inviter and invitee on group creation and syncing live-discovered members to persistence.
- **Persistence Resilience**: Hardened `toPersistedGroupConversation` to gracefully handle missing group metadata and prevent runtime crashes.
- **Message Parsing**: Improved JSON detection in `MessageList` to correctly route specialized community events to their respective UI cards.

## [v0.7.6-alpha] - 2026-02-13

### Added

- **Invite Code Search**: Integrated secure invite code resolution directly into the "New Chat" dialog. Users can now enter an `OBSCUR-...` code to instantly find and connect with peers, streamlining the "Add Contact" workflow.
- **Custom Scrollbars**: Implemented universal, seamless scrollbars that remain hidden by default and appear on hover, providing a more immersive and cleaner interface.

### Changed

- **Messaging Stability**: Optimized dependency tracking in `EnhancedDMController`, preventing unnecessary relay re-connections and ensuring consistent message delivery during network fluctuations.
- **Performance**: Prioritized critical LCP (Largest Contentful Paint) images in the authentication gateway, significantly improving the initial load experience and Core Web Vitals score.
- **Test Infrastructure**: Refactored `enhanced-dm-controller.test.ts` to use top-level imports and standard Vitest `vi.mocked()` patterns, replacing legacy `require()` calls to improve type safety and maintainability.

### Fixed

- **Chat Layout**: Resolved an issue in the web version where the input composer would disappear below the fold. The input box is now strictly pinned to the bottom of the viewport.
- **History Persistence**: Fixed a critical bug where chat history and contacts were not loading on startup/refresh.
- **UI Interactions**: Added click-outside listeners to predictably close message context menus and reaction pickers.
- **First Message Visibility**: Corrected race condition in message ingestion that prevented initial connection request messages from displaying in real-time.
- **Localization Polish**: Fixed broken translation keys (including `common.searching` and stranger warning titles) and localized hardcoded UI elements.
- **React Hooks**: Resolved internal dependency warnings in the messaging components, ensuring stable and predictable state updates.

## [v0.7.5-alpha] - 2026-02-10

### Changed

- **Profile Flow Optimization**: Reverted mandatory profile publishing enforcement to resolve infinite redirect loops on unstable connections. Users can now choose to skip the username step during onboarding if desired.
- **Onboarding UX**: Restored the "Skip" button in the onboarding wizard, allowing for a more flexible user journey when setting up a new identity.
- **Code Stability**: Refactored `AuthGateway` and hook dependencies to fix React strict mode violations and improve application stability during the authentication phase.

## [v0.7.4] - 2026-02-09

### Added

- **Mobile Native Crypto**: Implemented hardware-backed security on Android and iOS using native platform storage, replacing WASM fallbacks.
- **Deep Linking**: Added system-level support for `obscur://` and `nostr://` protocols for seamless invite redemption and peer-to-peer discovery.
- **Improved Background Handling**: Optimized relay connection persistence and notification handling for mobile environments.
- **Native Media Uploads**: Switched to native OS file pickers for smoother integration with system galleries and improved upload reliability on mobile.

### Changed

- **Group Chat Polish**: Refined member management UI, optimized touch targets, and enabled native avatar uploads for group metadata.
- **Security Persistence**: Optimized session hydration logic for mobile environments.

## [v0.7.2] - 2026-02-09

### Added

- **Dual-Path Upload Architecture**: Re-enabled direct browser uploads for the PWA while maintaining the high-performance Rust-native path for Desktop/Mobile.
- **Client-Side NIP-98 Signing**: Implemented secure, client-side NIP-98 authentication for browser uploads using the internal `@dweb/nostr` library.
- **Relay Stability**: Added a defined debounce (2s) to the initial message sync to prevent redundant network requests when multiple relays connect simultaneously on startup.

### Fixed

- **PWA Uploads**: Resolved the "NIP-96 upload requires desktop app" error by intelligently routing uploads based on the runtime environment.
- **Initial Sync Spam**: Fixed a race condition where the app would trigger a full message sync for _each_ relay that connected, instead of waiting for the connection pool to stabilize.
- **Relay Connection Hang**: Fixed a critical race condition where the desktop app would get stuck in a "connecting" state because the backend reported a relay as "already connected" without triggering the necessary frontend events.
- **Desktop Message Encryption**: Implemented native NIP-04 encryption/decryption in the Rust backend to fix message sending failures on Desktop, covering for the lack of raw key access in the frontend.

## [v0.7.1-alpha] - 2026-02-09

### Added

- **In-Memory Native Session**: Implemented a more robust session management pattern that keeps active keys in memory on the Rust backend, reducing reliance on the OS keychain for every operation.
- **Auto-Hydration**: The desktop backend now automatically loads keys from the OS keychain into the in-memory session on startup, ensuring a seamless experience after app restarts.

### Fixed

- **NIP-96 Response Parsing**: Added support for servers (like `nostr.build`) that wrap upload results in a `data` array.
- **Tauri Permissions**: Fixed a "Command not found" error by explicitly allowing `init_native_session` and `clear_native_session` in the app's capability configuration.
- **Session Sync**: Resolved "Missing native key" errors by making the frontend the source of truth for session initialization.

## [v0.7.0-alpha] - 2026-02-08

### Added

- **Native NIP-98 Signing**: Moved NIP-98 authentication event generation and SHA-256 payload hashing entirely into the Rust backend. This ensures a perfect match between uploaded bytes and the authentication tag, eliminating 401 Unauthorized errors.
- **Native Network Cutover**: Fully audited the Desktop networking stack to ensure 100% of relay and HTTP traffic is routed through the native Rust runtime (ignoring WebView browser fallbacks).

### Fixed

- **Upload Reliability**: Resolved persistent 401 errors during NIP-96 file uploads by delegating signing to the native layer, which bypasses WebView CORS and IPC overhead.
- **Relay Connectivity**: Patched adhoc WebSocket leaks in the invite flow to use the native transport.

### Changed

- **Stabilization Guardrails**: Hardcoded a stable set of default relays and storage providers for v0.7. Custom relay and provider editing has been disabled in the UI to ensure a reliable "golden path" for the release.

## [v0.6.6-alpha] - 2026-02-08

### Added

- **Native Networking Runtime**: Centralized native HTTP + WebSocket networking behind a single Rust runtime to ensure consistent proxy/Tor routing and improve diagnostics.
- **Relay Probe Diagnostics**: Added `probe_relay` to quickly distinguish DNS/TCP/WebSocket upgrade failures and surface actionable errors (including HTTP gateway responses).
- **Relay Resilience**: Native relay transport now tracks desired relays and automatically reconnects with exponential backoff after disconnects.
- **Fallback Relays (Desktop)**: When all configured relays fail to connect, the app adds a small transient fallback set to avoid hard offline state.

### Fixed

- **Tor UX**: Removed reliance on WebView proxy configuration at window creation time, enabling live Tor switching without requiring an app restart.
- **Upload Debugging**: Improved native upload diagnostics and strict-provider behavior (no redirects), with multipart field-name compatibility retry.

## [v0.6.5-alpha] - 2026-02-08

### Fixed

- **Android Build**: Isolated native keychain to desktop platforms only (Windows, macOS, Linux) using conditional compilation. Android builds now succeed without OpenSSL dependencies.
- **Mobile Crypto Fallback**: Android automatically uses WASM-based crypto with encrypted IndexedDB storage, maintaining security without native keychain.

## [v0.6.4-alpha] - 2026-02-08

### Fixed

- **Android Compilation**: Migrated `tokio-tungstenite` from `native-tls` to `rustls` to resolve OpenSSL dependency issues during Android cross-compilation.

### Added

- **Native Key Management**: Secure storage for Nostr private keys (nsec) using the operating system's native keychain (Windows Credential Manager, macOS Keychain) via `keyring`.
- **Native Signing**: Optimized cryptographic signing of Nostr events in Rust for improved performance and security.
- **Auto-Unlock**: Automatic detection and authentication using native keys on startup, providing a seamless login experience.
- **Improved Security Boundaries**: The private key is now isolated at the native layer, never touching the frontend/WebView memory once stored.

### Fixed

- **Relay Stability**: Fixed "Future is not Send" errors and deadlock issues in the native relay transport by ensuring MutexGuards are not held across await points.
- **Desktop Permissions**: Refactored capability management to use explicit permission identifiers, ensuring native features work correctly in production bundles.
- **Dependency Optimization**: Updated `nostr` and `tokio` dependencies for better cross-platform compatibility and performance.

## [v0.5.0-alpha] - 2026-02-06

### Added

- **Tor Network Integration**: Full Tor support for desktop, routing all application traffic through a bundled Tor sidecar for enhanced privacy and censorship resistance.
- **Native Mobile Support (Android)**: Initial alpha release for Android.
- **Mobile UI Polishing**: Implemented safe area insets for notches and dynamic islands, ensuring content isn't obscured.
- **Deep Linking**: Support for `obscur://` and `nostr:` links to open invites, profiles, and conversations directly in the app.
- **Native File Uploads**: Integrated NIP-96 file upload support using native file pickers and camera.
- **Native Notifications**: Implemented foreground polling and native system notifications for new messages.
- **Status Bar Sync**: The system status bar now automatically syncs with the app's theme (light/dark mode).
- **Core Feature Parity**: Validated WASM crypto fallback and essential features on mobile environment.
- **CI/CD**: Automated Android APK building via GitHub Actions (`mobile-release.yml`).

## [v0.4.0] - 2026-02-03

### Added

- **Mobile Experience Polish**: Added Swipe-to-Reply gestures, larger touch targets for better accessibility, and fixed virtual keyboard occlusion with `100dvh`.
- **Core Refinements**: Theme synchronization fix (FOUC), message deduplication, and v0.4.0 versioning.
- **Auto-Storage Configuration**: Automatically enables NIP-96 storage with `nostr.build` as default when hosted on Vercel to resolve "Local upload" errors out-of-the-box.
- **Improved Settings UI**: Recommended storage providers are now always visible with clear descriptions and one-tap selection.
- **Group Management Extensions**: Admins can now add members via public key, remove members from the settings sheet, and see role-based badges (Owner/Mod).
- **Group Chat Avatar Upload**: Support for uploading a group avatar during the creation process.
- **Group Metadata Editing**: Admins can now edit group name, description, and picture from the group settings sheet.
- **Group Invite ID**: Added "Copy Invite ID" functionality to easily share group joining information.
- **Native Avatar Upload**: Support for NIP-96 file uploads. Users can now upload profile pictures directly to Nostr storage providers or local storage.
- **NIP-05 Verification**: Built-in verification flow for NIP-05 identifiers (e.g., alice@domain.com). Displays verification status in settings.
- **DM Privacy Controls**: New granular privacy settings in "Privacy & Trust" tab. Users can now choose to Receive DMs from "Everyone" or "Contacts Only".
- **Enhanced DM Filtering**: Client-side filtering of direct messages from strangers when "Contacts Only" is enabled.

### Fixed

- **Theme Sync**: Resolved the "white flash" (FOUC) on initial load by implementing a blocking theme script in the root layout.
- **Message Deduplication**: Fixed a bug where duplicate group messages were rendered by implementing event ID filtering.
- **Profile Save Timeout**: Fixed an issue where saving the profile on Desktop would hang indefinitely.

### Changed

- **Profile Management**: Refactored profile settings with immediate local previews and NIP-05 integration.
- **Auto-Lock**: Changed default auto-lock timeout from `15m` to `Never` (0) for new accounts to improve initial user experience.

## [v0.3.7] - 2026-02-02

### Added

- **Message Reactions**: Support for NIP-25 reactions. Hover over a message to react with emojis. UI updates optimistically.
- **Multiple File Uploads**: Users can now select and upload multiple images/videos at once in the composer.
- **Automated Connection Requests**: Messaging an unaccepted peer now automatically triggers a formal connection request, improving the first-contact experience.
- **Request Notifications**: Visual feedback (Toasts and Sidebar Badges) for connection request status.

### Fixed

- **Desktop Uploads**: Fixed a 500 error in the desktop app by replacing `uuid` with `crypto.randomUUID()` to resolve bundling issues.
- **Inbox Deduplication**: Fixed a bug where the unread request count would increment infinitely by implementing event ID deduplication.
- **Sidebar Badges**: Fixed incorrect unread counts in the Sidebar "Requests" tab.

### Changed

- **Type Safety**: Refactored `ReactionsByEmoji` and `RequestsInboxItem` for better type safety and cleaner code.

## [v0.3.6] - 2026-02-01

### Fixed

- **SemVer Compliance**: Fixed build issue where version `0.3.5.1` was rejected by Tauri/Cargo. Bumping to `0.3.6` resolves this.

## [v0.3.5.1] - 2026-02-01

### Fixed

- **Build Error**: Fixed a TypeScript error in `lock-screen.tsx` where `onForget` was not destructured.
- **Identity Reset**: Added a "Forgot passphrase? Reset account" button to the Lock Screen and Locked Identity View. This allows users to manually clear their local data and start over.

## [v0.3.5] - 2026-02-01

### Added

- **Desktop/PWA Parity**: ensured feature parity between the Desktop app and PWA.

### Fixed

- **Profile Save Timeout**: Fixed an issue where saving the profile on Desktop would hang indefinitely due to a deadlock in the Crypto Worker.
- **Crypto Worker**: Forced the Crypto Service to use the main thread when running in Tauri context to avoid worker loading issues.
- **Connection Reliability**: Increased timeouts for Relay connection (5s -> 15s) and Publishing (5s -> 10s) to handle slower network conditions.
- **UI Popup Fixes**:
  - Removed the non-functional "Virtual Keyboard" help button from the Settings header.
  - Fixed the "Delete Account" dialog positioning by using React Portals to ensure it is always centered.

### Changed

- **Versioning**: Synchronized version across PWA, Desktop, and Tauri configuration.
