# Core Verification: Media and Vault Durability

_Last reviewed: 2026-06-27 (local vault save + chat attachment menu). Baseline commit a3f16b10 for restore lane._

This packet covers Lane 7 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that attachment metadata, restored media visibility,
Vault aggregation, and download/save behavior all converge on the correct
account and source-conversation truth.

## Scope

This lane verifies:

1. attachment compatibility parsing for legacy and sparse metadata,
2. fresh-device restore visibility for non-deleted attachments,
3. Vault aggregation and source-conversation ownership,
4. Vault active-identity refresh and same-account rebuild triggers,
5. deterministic download/save behavior in browser and desktop runtimes,
6. separation between local cache organization and remote durable media truth.
7. explicit **local encrypted vault** saves (desktop) remain profile-scoped and do not
   replace remote attachment URLs in message history unless separately uploaded.

## Canonical Owners

1. `apps/pwa/app/features/messaging/utils/logic.ts`
2. `apps/pwa/app/features/messaging/utils/persistence.ts`
3. `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
4. `apps/pwa/app/features/vault/hooks/use-vault-media.ts`
5. `apps/pwa/app/features/vault/components/vault-media-grid.tsx`
6. `apps/pwa/app/features/vault/services/local-media-store.ts`
7. `apps/pwa/app/features/vault/services/native-local-media-adapter.ts`
8. `apps/pwa/app/features/vault/services/save-chat-attachment-to-vault.ts`
9. `apps/pwa/app/features/messaging/components/attachment-context-menu.tsx`
10. `apps/pwa/app/features/messaging/components/attachment-context-menu-handlers.ts`

Reference incidents and guardrails:

1. `docs/encyclopedia/18-account-scope-and-discovery-guardrails.md`
2. fresh-device video-loss runtime notes recorded in
   `docs/handoffs/current-session.md`

## Required Invariants

1. Non-deleted attachments must remain visible after restore when canonical
   message history still contains them.
2. Sparse or legacy attachment metadata must be normalized deterministically so
   media kind, file name, and content type do not silently degrade.
3. Vault aggregation must follow the active identity only and must refresh when
   chat state is replaced or the derived message index is rebuilt.
4. Vault items must retain source conversation ownership so DM/community origin
   is explicit and routing back to source does not invent a detached media
   owner.
5. Removed-from-Vault or local-cache actions must not rewrite remote message
   truth.
6. Download/save flows must behave deterministically by runtime:
   browser download fallback on web,
   native save dialog and filesystem path on desktop.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/utils/persistence.attachments.test.ts \
  app/features/account-sync/services/encrypted-account-backup-service.attachments.test.ts \
  app/features/vault/hooks/use-vault-media.test.tsx \
  app/features/vault/components/vault-media-grid.test.tsx \
  app/features/vault/services/native-local-media-adapter.test.ts \
  app/features/vault/services/local-media-store.test.ts \
  app/features/vault/services/vault-media-aggregator.test.ts \
  app/features/messaging/components/attachment-context-menu.test.tsx \
  app/features/messaging/components/attachment-context-menu-handlers.test.ts \
  app/features/auth/components/app-lock-confirm-dialog.test.tsx
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm docs:check
```

Expected focus:

1. `persistence.attachments.test.ts`
   - legacy voice-note compatibility,
   - sparse video attachment inference.
2. `encrypted-account-backup-service.attachments.test.ts`
   - restored attachment metadata normalization,
   - backup attachment compatibility parsing.
3. `use-vault-media.test.tsx`
   - refresh on `CHAT_STATE_REPLACED_EVENT`,
   - refresh on derived message-index rebuild,
   - sign-out clear behavior,
   - account-switch media isolation.
4. `vault-media-grid.test.tsx`
   - Removed/Restore UX,
   - source-specific origin labels and routing,
   - browser download action path.
5. `native-local-media-adapter.test.ts`
   - native save dialog path,
   - filesystem write/open support,
   - web-runtime unsupported fallback behavior.
6. `local-media-store.test.ts` / `vault-media-aggregator.test.ts`
   - local-only vault URLs (`obscur://vault/local/…`),
   - display filename resolution (not `.obscurvault` blob names).
7. `attachment-context-menu*.test.ts`
   - save-to-vault as first menu action,
   - touch long-press opens attachment menu.
8. `app-lock-confirm-dialog.test.tsx`
   - lock confirmation copy from `en.json`.

## Manual Replay Set

Run with at least one media-bearing DM and one community media case where
possible:

1. send image, video, audio, and file attachments in normal messaging flows,
2. confirm they appear in chat and Vault with the correct DM/community source
   labeling,
3. perform a fresh-device login/restore and verify the same non-deleted media
   remains visible in:
   - chat history,
   - Vault,
   - source routing back to the originating conversation,
4. remove several items from Vault and verify they move to Removed without
   affecting source chat/community truth,
5. restore those items to Vault and verify they return normally,
6. on desktop, download image/video/audio/file items through the native save
   dialog and confirm the saved files open correctly from the chosen path,
7. on web, confirm browser download fallback still produces valid files,
8. on desktop, upload via **Obscur Local Vault** and via chat **Save to vault**
   (right-click or long-press); confirm **Local** filter, original filenames, and
   encrypted-at-rest access only when profile is unlocked.

## Evidence To Capture

Primary probes and artifacts:

1. `window.obscurAppEvents.findByName("messaging.chat_state_replaced", 30)`
2. `window.obscurAppEvents.findByName("messaging.legacy_migration_diagnostics", 30)`
3. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.mediaHydrationParity`
4. runtime artifacts already used in prior Vault replay:
   - `.artifacts/runtime-replay/vault-live-grid.png`
   - `.artifacts/runtime-replay/vault-live-removed-filter.png`
   - `.artifacts/runtime-replay/downloads/*`

Capture:

1. whether restored media appears in chat and Vault together,
2. whether any attachment kind or filename is degraded after restore,
3. whether the active account/public key matches the visible Vault set,
4. whether source routing points back to the correct DM/community conversation,
5. whether native save dialog output paths produce valid openable files.

## Pass Criteria

This lane passes only if:

1. automated suites are green,
2. fresh-device restore preserves non-deleted media visibility,
3. Vault follows active identity and source conversation truth only,
4. Removed/Restore actions stay local to Vault organization,
5. browser and desktop download/save paths behave deterministically for the
   tested file kinds,
6. runtime replay confirms the result, not just attachment parsing tests.
