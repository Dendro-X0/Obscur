# Identity Data Isolation — Investigation (2026-07)

## Symptom

New account **DemoUser** appeared as the sole member of **NewTest 2** (`ws://localhost:7000`) without creating groups or adding contacts. Blocks demo/GIF recording.

## Model

| Layer | ID | Owns |
|-------|-----|------|
| Profile slot | `profileId` | SQLite partition, scoped localStorage suffix `::profileId`, WebView data dir |
| Account | `publicKeyHex` | Cryptographic identity; bound to slot via `obscur.profile_window.last_bound_account::profileId` |

**Contract:** One active account per profile window slot. Local durable data for a slot must not surface under a different account.

## Root causes (confirmed)

### RC-1 — Orphan slot data on greenfield create (P0, fixed)

`createIdentity` did not wipe SQLite/chat state when binding a new account to an empty slot. Prior R1/GIF sessions left **NewTest 2** in `default` SQLite.

**Fix:** `clearOrphanProfileSlotWorkspace` before create/import in `auth-kernel-bound-profile-auth.ts`.

### RC-2 — SQLite group hydrate invents membership (P0)

`sqliteGroupRecordToPersistedGroup` set `memberPubkeys: [localPublicKeyHex]` for every `groups` row. Orphan metadata looked like real sole membership.

**Fix:** Metadata-only sqlite rows (`memberPubkeys: []`). Repair/materialize requires membership or message evidence.

### RC-3 — Cross-slot SQLite scan included all registry profiles (P0)

`listAccountSharedSqliteProfileIds` unioned **every** registered profile slot, not only slots bound to the active account. Repair and group hydrate could read another account's SQLite.

**Fix:** Scan `primaryProfileId`, `default`, and `listProfileIdsWithBoundAccountPublicKeyHex(account)` only.

### RC-4 — Repair materialized orphan sqlite groups (P0)

`repairGroupMetadataFromSqliteIfSparse` promoted sqlite rows into chat-state + **joined** ledger entries without account evidence.

**Fix:** Require `memberPubkeys` includes account OR native group-message evidence for that slot/group.

## Remaining (tracked, not in this slice)

| ID | Priority | Issue |
|----|----------|-------|
| ISO-P1-1 | P1 | `forgetIdentity` clears identity only; workspace/SQLite may remain |
| ISO-P1-2 | P1 | Web `migrateScopedStorageForAccount` can merge cross-slot without explicit consent |
| ISO-P1-3 | P1 | `profiles.public_key` UNIQUE in Rust schema vs multi-slot same account |
| ISO-P2-1 | P2 | Legacy unscoped localStorage fallbacks (`dweb.nostr.pwa.chatState`, tombstones) |
| ISO-P2-2 | P2 | Persist group roster in SQLite or always hydrate from ledger |

## Canonical owners

- Profile slot lifecycle: `apps/pwa/app/features/profiles/services/`
- Auth greenfield: `apps/pwa/app/features/auth-kernel/auth-kernel-bound-profile-auth.ts`
- Native SQLite API: `packages/db/src/client.ts`
- Group list repair: `apps/pwa/app/features/profiles/services/data-root-group-metadata-repair.ts`

## Proof (this slice)

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/profiles/services/account-shared-sqlite-profile-ids.test.ts app/features/profiles/services/profile-slot-greenfield-workspace-prep.test.ts app/features/groups/services/community-group-sqlite-store.test.ts app/features/profiles/services/data-root-group-metadata-repair.test.ts app/features/messaging/services/thread-history/group-thread-sqlite-store.test.ts` |
| L3 | Fresh install → create account in Default slot → Groups empty with docker relay up |

## Does not prove

- Multi-window same account cross-slot message recovery after narrowing scan (requires bound slots on both windows)
- Packaged NSIS cold path

## RC-5 — Greenfield export blocked (P0, fixed 2026-07-05)

`hasPortablePrivateStateEvidence` only counted social/chat artifacts (contacts, groups, messages). Fresh **DemoUser** accounts with identity + profile + relays but zero conversations failed export with “private account state is empty”, blocking GIF 4.

**Fix:** Treat `identityUnlock` (encrypted private key) and profile username as portable evidence in `restore-merge-policy.ts`.
