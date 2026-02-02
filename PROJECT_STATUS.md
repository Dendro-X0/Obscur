# Project Status & Handover Report
**Date:** 2026-01-31
**Last Version:** v0.3.2

## 1. Recent Modifications (v0.3.1 - v0.3.2)
The following features were recently implemented to improve the core user experience and address critical usability gaps:

### Account & Data Management
- **Account Deletion (Danger Zone):** Added a feature in *Settings > Identity* to permanently delete the local account and wipe all data (IndexedDB, LocalStorage).
- **Onboarding Reliability:** Modified the profile publishing flow to wait for a healthy relay connection before attempting to save, reducing "User not found" errors for new accounts.
- **Robust Publishing:** Added retry logic and error feedback during the onboarding wizard.

### UI/UX Enhancements
- **Custom Feedback System:** Replaced native browser alerts/confirms with disjointed custom components:
  - **Toast Notifications:** Non-intrusive bottom-right notifications for success/info actions.
  - **Confirm Dialog:** A premium, centered, glassmorphic modal for dangerous actions (like account deletion).
- **Search Improvements:** Clarified the "New Chat" dialog to explicitly support searching by NIP-05 identifiers and Names, not just public keys.
- **Blocklist UI:** Implemented a visible interface for managing blocked users in *Settings > Moderation*.

---

## 2. Unusable / Broken Features (Critical)
According to recent testing and user feedback, the following core features are **not functional** or highly unstable:

### A. Real-Time Communication
- **Chat is Broken:** Despite the UI existing, real-time message delivery and reception are unreliable.
- **Relay Connectivity:** The connection to relays acts "connected" but often fails to actually persist or retrieve messages in real-time.
- **Interaction Dead-Ends:** Users can "send" messages, but they may disappear into the void or never reach the recipient.

### B. Data Persistence
- **Profile Saving:** While improvements were made, saving a new profile sometimes fails silently or doesn't propagate to other clients.
- **Account Logic:** The "Relay Server" doesn't seem to reliably save newly created accounts, leading to data loss upon refresh or re-login.

### C. Useful APIs
- **Missing Integrations:** The project has a lot of "shell" code. Many service calls (like `verifyRecipient` or `sendConnectionRequest`) mock success or fail interaction with actual Nostr relays.

---

## 3. Key Technical Debt & Problems
- **UI-First, Logic-Second:** The project suffers from "Frontend-itis." It looks beautiful (shadcn/ui, glassmorphism, animations) but lacks the robust backend/protocol logic to back it up.
- **Complex Monorepo Structure:** The codebase is split into many workspace packages (`@dweb/core`, `@dweb/nostr`, etc.), making it hard to debug where the data flow breaks.
- **Over-Engineering:** There are complex abstractions for "Decentralized Web Nodes" (DWeb) and "Signaler" that might be overkill or poorly integrated with standard Nostr protocols.
- **Experimental Nature:** The project attempts to mix standard Nostr with experimental "DWeb" concepts, leading to compatibility issues and a lack of standard tooling support.

---

## 4. Future Roadmap & recovery Plan
If this project is resumed, the following steps are recommended:

1.  **Halt UI Development:** Stop adding new UI features (like enhanced dialogs or animations).
2.  **Audit the Protocol Layer:**
    - Isolate the `RelayPool` and `NostrService`.
    - Write integration tests that *actually* send an event to a public relay (e.g., `wss://relay.damus.io`) and verify it can be fetched back.
    - If the "DWeb" layer is blocking standard Nostr usage, bypass it for core messaging features.
3.  **Fix the Happy Path:** Ensure 1 User can send 1 Message to another User and have it appear reliably. Do not move on until this basic primitive works.
4.  **Simplify:** Remove unused "experimental" features causing friction.

- `apps/pwa/app/settings/page.tsx`
- `apps/pwa/app/features/messaging/components/new-chat-dialog.tsx`

### 5. Desktop App Packaging (v0.3.2)
**Status:** SUCCESS
**Build:** `Obscur_0.3.2_x64-setup.exe`
**Notes:** 
- Synced with PWA v0.3.2 features (Messaging reliability fixes).
- Configured as a standalone offline-first app (Server-side API routes disabled for desktop build to ensure true local-only operation).
- Browser-independent execution via Tauri/WebView2.

---

**Status:** Archived / Experimental
**Maintainer:** [User / Antigravity]
