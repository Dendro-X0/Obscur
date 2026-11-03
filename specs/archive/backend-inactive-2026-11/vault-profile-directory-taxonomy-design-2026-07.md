# Vault profile directory taxonomy + multi-profile object isolation

**Status:** Design + T1/T2 path/write/scan/migrate landed (L1 green) · T3 isolation gates in path/write · G8 pending  
**Date:** 2026-07-15  
**Parent:** [v1.9.13-scope.md](../../docs/program/v1.9.13-scope.md) · Strategy **A** (finish designed vault)  
**Depends on:** Phase 5 `profiles/{profileId}/vault/` ([vault-encryption-sandbox-plan-2026-07.md](./vault-encryption-sandbox-plan-2026-07.md) §Phase 5)  
**Owners:** `local-media-vault-path.ts`, `local-media-store.ts`, `vault-disk-inventory.ts`, `data_root.rs`  
**Non-goals:** Cloud sync · WASM viewer · browser PWA vault writes · chat→vault flag flip (still G8 + Phase 6b)

---

## 1. Problem

Phase 5 moved ciphertext under `profiles/{profileId}/vault/` but **blobs remain a single flat directory** (`{24hex}.obscurvault`). Operators and multi-profile soaks still experience:

| Gap | Effect |
|-----|--------|
| No on-disk categories | Explorer / USB inspection looks like one pile; UI kind filters are index-only |
| Category ≠ path | Aggregator/`typeFilter` cannot be regenerated from disk alone after index wipe |
| Multi-profile object confusion | Shared hash URL shape, module caches, and scan targets can leak **wrong-profile** rows or blob URLs across switch |

User mandate (2026-07-15): **each profile has a dedicated local vault tree with category subfolders**, and the system must correctly handle **multi-profile object identity / isolation**.

---

## 2. Current layout (truth)

```text
{dataRoot}/
  profiles/{profileId}/vault/{24hex}.obscurvault   ← Phase 5 (flat)
  vault-media/…                                    ← legacy (migrated on unlock)
```

| Object | Identity today | Profile scoped? |
|--------|----------------|-----------------|
| Ciphertext file | path + opaque name | Yes (under profile vault dir) |
| Index key | `obscur://vault/local/{sha256}` or remote URL / `obscur://vault/blob/{24hex}` | Via **per-profile** SQLite / localStorage key + in-memory cache keyed by `vaultIndexCacheProfileId` |
| Display kind | `attachment.kind` in index / messages | In index only — **not** on disk path |
| Blob preview URL | `blob:` via lifecycle map | Revoked on `resetVaultMediaIndexCache`; must stay profile-bound |

`data_root.rs` still creates `profiles/{id}/vault/` and reports legacy `vault_media_path` for diagnostics — accept, do not revive flat writes.

---

## 3. Target directory taxonomy

Canonical **relative** root (unchanged):

```text
profiles/{sanitizedProfileId}/vault/
```

**New category subdirs** (stable English slugs; UI labels elsewhere):

| Subdir | Attachment kinds mapped in |
|--------|----------------------------|
| `images/` | `image` |
| `videos/` | `video` |
| `audio/` | `audio`, `voice_note` |
| `files/` | `file` and unknown / other |

Full path example:

```text
profiles/alice/vault/images/a1b2c3d4e5f6789012345678.obscurvault
```

### 3.1 Invariants

1. **Write owner:** only `local-media-store` builds relative paths via `buildProfileVaultRelativePath(profileId, category, fileName)` (extended signature).
2. **Path must contain** `profiles/{thisProfile}/vault/{category}/` — reject writes/reads that escape or target another profile id.
3. **Filename remains opaque** `{24hex}.obscurvault` (encryption sandbox G1–G3) — categories organize, they do **not** restore plaintext names on disk.
4. **Index remains source of display metadata**; disk category is a **recovery hint** + operator taxonomy, not a second owner of kind.
5. **Same content, two profiles** → two ciphertext files (per-profile vault key) under each profile tree; URL **keys may collide in shape** but must never share memory/index/blob without profile gate.

### 3.2 Scan order (disk inventory)

`vault-disk-inventory` must recurse (or enumerate fixed category list + legacy flat) under:

1. `profiles/{id}/vault/{category}/` for each known category  
2. `profiles/{id}/vault/` (legacy flat Phase 5)  
3. Legacy `vault-media/` (read/migrate only)

Do not invent unbounded recursive discovery outside the profile vault root.

---

## 4. Multi-profile object issues (must close)

| ID | Risk | Required behavior |
|----|------|-------------------|
| **P1** | Module caches (`vaultIndexCache`, `vaultDiskInventoryCache`, blob URLs) survive profile switch | On every profile change / unlock for profile B: reset index cache, disk inventory profile id, **revoke all** vault blob URLs before hydrate B |
| **P2** | Index key = content hash URL without profile prefix | Keys are valid **only inside** profile-scoped store; never merge A+B indexes in one map; tests must assert switch clears stale keys |
| **P3** | Disk scan of wrong profile dir | `scanVaultDiskBlobInventory(profileId)` must only list dirs under that profile’s vault root |
| **P4** | Stale `relativePath` points at profile A while active is B | Resolvers: if path’s profile segment ≠ active `profileId`, treat as miss / refuse open (fail closed) |
| **P5** | Concurrent writes while switching | Writes snapshot `resolveVaultProfileId()` at start; refuse commit if profile changed mid-flight |
| **P6** | UI event bus ignores profile on refresh | Keep `detail.profileId` filters in `use-vault-media` (already present) — extend to taxonomy migration events |
| **P7** | Custom / absolute legacy roots | Stay read-only migrate path; new writes never land outside profile taxonomy under unified data root |

---

## 5. Migration (layout Phase 5 → taxonomy)

| Step | Behavior |
|------|----------|
| M1 | On vault unlock / first write after upgrade: scan flat `profiles/{id}/vault/*.obscurvault` |
| M2 | For each file with index entry → move into `vault/{category}/` from **indexed** `kind` (fallback: `files/`) |
| M3 | Orphan flat blobs (index miss) → `files/` |
| M4 | Update SQLite/localStorage `relativePath`; rewrite only after successful rename |
| M5 | Idempotent — entries already under a category dir are skipped |

Proof: L1 unit tests for path builders + migration placement; L3 two-profile USB soak sees separate trees + subfolders.

---

## 6. Implementation slices (ordered)

| Slice | Deliverable | Code? |
|-------|-------------|-------|
| **T0** | This design + handoff/scope update | **Done** |
| **T1** | Path API: categories, `buildProfileVaultCategoryRelativePath`, validators, L1 tests | **Done** |
| **T2** | Write path + disk inventory recurse/category list + migration M1–M5 | **Done** (L1) |
| **T3** | Multi-profile isolation L1 (P1–P4) + contract tests | **Done** — 7 isolation tests in gate |
| **T4** | G8 runbook updates (expect category dirs); then G8 soak / Phase 6b | Runbook **done** · disk probe added · soak pending |

Chat→vault flag stays **false** until T3 green + G8 + existing Phase 6 L3 chain ([phase6 design](./vault-chat-save-phase6-design-2026-07.md)).

---

## 7. Proof matrix

| Layer | Command / action |
|-------|------------------|
| **L1** | `pnpm verify:vault-sandbox-l1` (+ new path/migration/isolation tests) |
| **L2** | `pnpm verify:storage-encryption-v1.9.8` (desktop stopped) |
| **L3** | Two profiles A/B: upload image vs video; confirm dirs; switch profile → no cross rows / no stale blob preview |
| **L4** | USB data-root: category trees intact after remount |

---

## 8. Mental simulation

1. User on **Profile A** Secure-Uploads a PNG → file lands at `profiles/A/vault/images/{hex}.obscurvault`; index kind `image`.  
2. Switch to **Profile B** → caches revoked; hydrate B empty or B-only; opening A’s path fails closed.  
3. Same PNG bytes uploaded on B → different ciphertext under `profiles/B/vault/images/…`; indexes never merge.  
4. Chat save (after Phase 6b) uses **same** write owner + category mapping — no second path.

---

## 9. Decision log

| Decision | Choice | Why |
|----------|--------|-----|
| Strategy | **A** + taxonomy | Finish sandbox; folder UX is additive Phase 5b, not redesign |
| Categories | kind → fixed subdirs | Matches Vault UI filters; recoverable from disk |
| Opaque filenames | Keep | Encryption sandbox non-negotiable |
| Flag flip | After T3 + G8 + Phase 6 L3 | Un-pause condition: automated proof, not dogfood loops |
