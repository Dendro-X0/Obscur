# Project suspension status (2026-01-29)

This document records the current state of the Obscur PWA (apps/pwa), the most visible user-facing issues, and the changes made in the most recent stabilization attempts. It is intended to support pausing the project with an accurate snapshot.

## Summary

- The PWA is currently in a fragile state in development mode.
- The UI is showing translation keys (e.g. `nav.chats`, `settings.tabs.notifications`, `messaging.newChat`) instead of human-readable labels.
- The console previously emitted an endless stream of logs related to DM subscriptions and React state updates.
- Messaging reliability remains unverified/unstable (can fail to send or to reach other users).
- Production build (`pnpm -C apps/pwa build`) is still blocked by TypeScript errors (see `dcos/pwa-build-stabilization.md`).

## Most visible current issues

### 1) UI shows translation keys instead of labels

Symptoms:

- Nav labels show keys like `nav.chats`, `nav.search`.
- Settings tabs show keys like `settings.tabs.notifications`.
- Messaging buttons show keys like `messaging.newChat`.

Interpretation:

- This usually means i18n is not properly resolving translations at runtime.
- Either:
  - translation resources are not being loaded, or
  - the translation function is returning the key (fallback), or
  - the wrong namespace/language resource is configured.

Impact:

- Severe usability regression.

### 2) React error: "Maximum update depth exceeded" + console log spam

Symptoms:

- Dev overlay reported: "Maximum update depth exceeded".
- Console spam showed repeated DM subscription logs (subscribe/close loops).

Interpretation:

- Indicates an effect is causing re-renders in a tight loop.
- The spam observed referenced `enhanced-dm-controller.ts` subscription lifecycle.

Impact:

- Extremely noisy console.
- Can destabilize the UI and make debugging other issues difficult.

### 3) Messaging cannot reliably reach real users

Symptoms:

- Users cannot consistently send/receive DMs.
- Search may find "ghost" accounts.

Interpretation:

- Likely a combination of relay selection/availability, subscription correctness, and identity/keys being locked or missing.
- Using public relays without a deterministic environment makes the system appear unreliable.

Impact:

- Core product functionality not verifiable.

### 4) Production build is still failing

Reference:

- See `dcos/pwa-build-stabilization.md`.
- Current top blocker noted there: duplicate key in `apps/pwa/app/features/main-shell/hooks/use-main-shell-state.ts`.

Impact:

- Cannot deploy reliably.
- E2E that depends on production build is blocked.

## Changes made recently (implementation changelog)

### A) Playwright: run E2E against dev server

- **File**: `apps/pwa/playwright.config.ts`
- **Change**:
  - Non-CI: `webServer.command` switched to `pnpm dev -p 3000`.
  - CI: remains `pnpm build && pnpm start -p 3000`.
  - `baseURL` and `webServer.url` use `PLAYWRIGHT_BASE_URL ?? http://localhost:3000`.

Rationale:

- Allow E2E to run without requiring a passing production build.

### B) E2E: added multi-user messaging flow (env-gated)

- **File**: `apps/pwa/tests/e2e/messaging-flow.spec.ts`
- **File**: `apps/pwa/tests/e2e/helpers/e2e-harness.ts`
- **Change**:
  - Added a two-context test (User A / User B) to create identities and attempt a DM send.
  - Gated behind `E2E_REAL_RELAY=true`.
  - Optional delivery assertion gated behind `E2E_ASSERT_DELIVERY=true`.

Rationale:

- Provide a framework for verifying messaging when a deterministic relay environment is available.

### C) Relay list override for E2E/dev determinism

- **File**: `apps/pwa/app/features/relays/hooks/use-relay-list.ts`
- **Change**:
  - Added `NEXT_PUBLIC_E2E_RELAYS` override (comma-separated URLs) that replaces the relay list used by the app.

Rationale:

- Make it possible to force both users onto the same relay set for testing without UI configuration steps.

### D) Local relay environment (Docker-based) + docs

- **File**: `docker-compose.nostr.yml`
- **File**: `infra/nostr/nostr-rs-relay.toml`
- **File**: `dcos/e2e-local-relay.md`

Rationale:

- Provide a deterministic relay for local testing.

Notes:

- This environment is not usable if Docker cannot be used.

### E) Non-Docker testing docs

- **File**: `dcos/e2e-no-docker.md`

Rationale:

- Provide an alternative process using public relays or WSL.

### F) Desktop notifications: attempted stabilization to stop subscription loop

- **File**: `apps/pwa/app/components/desktop-notification-handler.tsx`
- **Change**:
  - Adjusted subscription/unsubscription effect to avoid repeated subscribe/unsubscribe cycles.
  - Fixed a TypeScript parse error in a `useRef` function type.

Rationale:

- The dev overlay stack trace pointed at `DesktopNotificationHandler` being mounted in `app/layout.tsx`.
- The console spam suggested repeated subscription lifecycle activity.

## Current recommended next steps (if project resumes)

1) Fix i18n key rendering

- Identify why translation resources are not being loaded/resolved.
- Confirm `I18nProvider` loads resources and that `react-i18next` is configured correctly.

2) Stabilize DM subscription lifecycle

- Ensure `enhanced-dm-controller.ts` does not resubscribe in response to unstable dependencies (e.g. changing `connections` array identity).
- Reduce logging or gate debug logs behind a dev flag.

3) Restore production build

- Follow `dcos/pwa-build-stabilization.md`.
- Fix TypeScript errors until `pnpm -C apps/pwa build` succeeds.

4) Only then: strengthen E2E

- Run E2E against a deterministic relay list.
- Expand test scenarios (invites, messaging, upload).

## How to reproduce key failures

### i18n key labels

- Start dev server.
- Navigate to Settings / Messaging.
- Observe UI labels showing i18n keys.

### Subscription log spam / update depth

- Start dev server.
- Open the app and watch console.
- Observe repeated subscription lifecycle logs and potential React update-depth error.

## Related documents

- `dcos/pwa-build-stabilization.md`
- `dcos/e2e-local-relay.md`
- `dcos/e2e-no-docker.md`
