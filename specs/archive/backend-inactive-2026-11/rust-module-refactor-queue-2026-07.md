# Design — Rust feature-module refactor queue (dev ≡ production · single backend)

**Status:** Charter active · Slices 1–3 L1 + RC1 green · dual-owner relay **Done** · R-ACCOUNT L3b keychain **Pass** · Slice 6–23 non-PAUSED `db_*` → engine **Done** · Slice 24 remaining ACL pin **Done** · ACC-03 sole engine path **Done**  
**Date:** 2026-07-30  
**Maintainer intent:** One backend for parity-desktop and packaged production; subtract dual owners; no Dev Lab / no parallel stacks  
**Related:** [dm-persist-dual-owner-integration-study-2026-07.md](./dm-persist-dual-owner-integration-study-2026-07.md) · [relay-publish-dual-owner-integration-study-2026-07.md](./relay-publish-dual-owner-integration-study-2026-07.md) · [production-rewrite-and-devlab-tombstone-2026-07.md](./production-rewrite-and-devlab-tombstone-2026-07.md) · [r-auth-slice1-design-2026-07.md](./r-auth-slice1-design-2026-07.md) · [r-scope-slice2-design-2026-07.md](./r-scope-slice2-design-2026-07.md) · [r-rust-boundary-slice3-design-2026-07.md](./r-rust-boundary-slice3-design-2026-07.md) · [r-dm-read-slice6-design-2026-07.md](./r-dm-read-slice6-design-2026-07.md) · [r-dm-sidebar-host-slice7-design-2026-07.md](./r-dm-sidebar-host-slice7-design-2026-07.md) · [r-transport-checkpoint-read-slice8-design-2026-07.md](./r-transport-checkpoint-read-slice8-design-2026-07.md) · [r-transport-checkpoint-upsert-slice9-design-2026-07.md](./r-transport-checkpoint-upsert-slice9-design-2026-07.md) · [r-transport-checkpoint-acl-slice10-design-2026-07.md](./r-transport-checkpoint-acl-slice10-design-2026-07.md) · [r-transport-checkpoint-tombstone-slice11-design-2026-07.md](./r-transport-checkpoint-tombstone-slice11-design-2026-07.md) · [r-dm-integrity-read-slice12-design-2026-07.md](./r-dm-integrity-read-slice12-design-2026-07.md) · [r-backup-dm-read-slice13-design-2026-07.md](./r-backup-dm-read-slice13-design-2026-07.md) · [r-hydrate-dm-read-slice14-design-2026-07.md](./r-hydrate-dm-read-slice14-design-2026-07.md) · [r-dm-read-tombstone-slice15-design-2026-07.md](./r-dm-read-tombstone-slice15-design-2026-07.md) · [r-vault-persistence-slice16-design-2026-07.md](./r-vault-persistence-slice16-design-2026-07.md) · [r-vault-ipc-tombstone-slice17-design-2026-07.md](./r-vault-ipc-tombstone-slice17-design-2026-07.md) · [r-db-ipc-inventory-slice18-investigation-2026-07.md](./r-db-ipc-inventory-slice18-investigation-2026-07.md) · [r-call-persistence-slice18-design-2026-07.md](./r-call-persistence-slice18-design-2026-07.md) · [r-call-ipc-tombstone-slice19-design-2026-07.md](./r-call-ipc-tombstone-slice19-design-2026-07.md) · [r-dm-tombstone-delete-slice20-investigation-2026-07.md](./r-dm-tombstone-delete-slice20-investigation-2026-07.md) · [r-dm-tombstone-delete-slice20-design-2026-07.md](./r-dm-tombstone-delete-slice20-design-2026-07.md) · [r-dm-delete-tombstone-ipc-slice21-design-2026-07.md](./r-dm-delete-tombstone-ipc-slice21-design-2026-07.md) · [r-search-wipe-persistence-slice22-investigation-2026-07.md](./r-search-wipe-persistence-slice22-investigation-2026-07.md) · [r-search-wipe-persistence-slice22-design-2026-07.md](./r-search-wipe-persistence-slice22-design-2026-07.md) · [r-search-wipe-ipc-tombstone-slice23-design-2026-07.md](./r-search-wipe-ipc-tombstone-slice23-design-2026-07.md) · [r-db-ipc-remaining-slice24-investigation-2026-07.md](./r-db-ipc-remaining-slice24-investigation-2026-07.md) · [r-db-ipc-remaining-slice24-design-2026-07.md](./r-db-ipc-remaining-slice24-design-2026-07.md) · [rc1-cargo-catalog-wiring-design-2026-07.md](./rc1-cargo-catalog-wiring-design-2026-07.md) · [codactrl-prerefactor-upgrade-requirements-2026-07.md](./codactrl-prerefactor-upgrade-requirements-2026-07.md) · [obscur-backend-engine-roadmap.md](../../docs/program/obscur-backend-engine-roadmap.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Maintainer: P2 unlock→shell UI soak · or community un-pause charter for group/invite db_*
PAUSED / CANCELLED:   community · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION-1 · Dev Lab · blind full rewrite
CANONICAL OWNERS:     all non-PAUSED product db_* via engine_invoke (Slices 6–23)
PROOF BEFORE DONE:    P2 = release L3 soak evidence · group = un-pause + migrate
OUT OF SCOPE:         Agent-declared P2 UI fixed · patching PAUSED group/community
```

---

## Non-negotiables

| Rule | Meaning |
|------|---------|
| Truth surface | `parity-desktop` / release exe only (`pnpm dev:desktop` + rebuild) |
| Keep-set only | Mutate: `libobscur`, `obscur_desktop_lib`, `@dweb/auth`, `@obscur/auth-engine`, `@obscur/engine-host`, `@obscur/transport-engine`, `@obscur/dm-engine`, transport packages, `pwa` adapters |
| Freeze | `@dweb/ui-kit`, `@obscur/conduit-mesh*`, `@obscur/relay-gateway`, `@obscur/workspace-engine`, crypto/core/db, website |
| One owner | Add a writer only after subtracting another; refuse dual-owner patches on PAUSED lifecycles |
| Specs first | Investigation → design → smallest slice → L1/RC1 → L3 |

---

## Already landed (do not reopen)

| Slice | Outcome |
|-------|---------|
| **Phase 0** Dev Lab tombstone | Lab scripts exit 1; truth ≠ lab |
| **R-AUTH Slice 1** | F5 session restore · H2 `missing_stored_identity` + self-wait · agent L3 `auth.kernel_boot_restore_succeeded` |
| **session-hydrate** | Single writer: `auth-kernel-boot-owner.ts` |
| **R-SCOPE Slice 2** | Heuristic “7 writers” → 1 override + 2 sync-inject · L1 `profile-scope-owner.contract.test.ts` |
| **R-RUST-BOUNDARY Slice 3** | 159 cmds catalogued · L1 `r-rust-boundary-slice3.contract.test.ts` · no deletes |
| **RC1 cargo ops** | Root workspace `packages/libobscur` · `auth-boot-snapshot` + `session-scope-isolation` pass |

---

## Dual-owner register (act by subtraction)

| Lifecycle | Dual? | Slice policy |
|-----------|-------|----------------|
| `session-hydrate` | No | Done — protect |
| **`profile-scope`** | Clarified | **Slice 2 done** — CI allowlist; do not add writers |
| `relay-publish` | Native single path + lab shims tombstoned | **#1–3 done** — [shim](./relay-publish-lab-shim-tombstone-design-2026-07.md) · R1–R3 after B1 |
| `dm-persist` | Clarified + sole insert port | **#1–3 + B1/B2 done** · [boundary](./engine-invoke-boundary-subtract-design-2026-07.md) · next = B3/L3 |

---

## Queue (ordered)

### Slice 2 — R-SCOPE (profile / window bind · done)

**Goal:** One canonical profile-scope owner for desktop window bind + identity storage keys so Rust `auth_boot` / session hydrate never see ambiguous `profileId`.

| Field | Value |
|-------|--------|
| Outcome | Override = `desktop-profile-runtime` only · sync inject = boot-payload + `layout.tsx` · no subtract needed |
| Specs | [investigation](./r-scope-slice2-investigation-2026-07.md) · [design](./r-scope-slice2-design-2026-07.md) |
| Proof | L1 `profile-scope-owner.contract.test.ts` (+ profile-scope / desktop-window-boot) |

### Slice 3 — R-RUST-BOUNDARY (Tauri command surface · L1 guards)

**Goal:** Same backend path for all product shells — shrink scattered `#[tauri::command]` toward `engine_invoke` + `libobscur` modules; document inventory.

| Field | Value |
|-------|--------|
| Investigation | [r-rust-boundary-slice3-investigation-2026-07.md](./r-rust-boundary-slice3-investigation-2026-07.md) — 159 commands · buckets A–G |
| Design | [r-rust-boundary-slice3-design-2026-07.md](./r-rust-boundary-slice3-design-2026-07.md) |
| Implement now | L1 guards only — **no** `db_*` / relay deletes (PAUSED) |
| Proof | `app/engine-lab/r-rust-boundary-slice3.contract.test.ts` · RC1 later |

### Slice 4 — R-RELAY / R-RELAY-RUST (transport)

**Goal:** Rust conduit mesh owns connect/publish/failover; dialects pluggable; **public Nostr not boot-default**.

| Field | Value |
|-------|--------|
| Primary charter | [r-relay-rust-mesh-charter-2026-07.md](./r-relay-rust-mesh-charter-2026-07.md) |
| Stopgap | [r-relay-transport-refactor-charter-2026-07.md](./r-relay-transport-refactor-charter-2026-07.md) · R-RELAY-1 pool pad L1 Pass |
| Concept | [obscur-conduit-mesh-concept-2026-06.md](../../docs/program/obscur-conduit-mesh-concept-2026-06.md) |
| Next | **RUST-2 L1 Pass** · optional L3-product / mesh configure wiring · [r-relay-rust-2-defaults-design-2026-07.md](./r-relay-rust-2-defaults-design-2026-07.md) |
| Still frozen | community · AUTH-SESSION-1 · Dev Lab |

### Slice 5 — R-ACCOUNT (package bootstrap)

**Goal:** Create/unlock works on release exe same as parity (P2).

| Field | Value |
|-------|--------|
| Status | L3b keychain **Pass** · P2 full unlock→shell UI soak optional follow-up |
| Investigation | [r-account-slice5-investigation-2026-07.md](./r-account-slice5-investigation-2026-07.md) · [keychain](./r-account-l3b-keychain-investigation-2026-07.md) |
| Design | [r-account-slice5-design-2026-07.md](./r-account-slice5-design-2026-07.md) · [keyring platform](./r-account-l3b-keyring-platform-design-2026-07.md) |
| L3a | Pass — parity Tester1 unlock→shell |
| L3b | **Pass** — release cold restart `keychainPresent: true` + Wincred · [evidence](../../docs/handoffs/r-account-l3b-keyring-fix-2026-07-30.md) |

### Slice 6 — R-DM-READ (DM kernel sole engine reads)

**Goal:** DM thread/sidebar/write-probe use only `engine_invoke` — subtract legacy `dbGet*` forks.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) — sole engine reads on dm-kernel ports |
| Specs | [investigation](./r-dm-read-slice6-investigation-2026-07.md) · [design](./r-dm-read-slice6-design-2026-07.md) |
| Proof | vitest dm-kernel + dm-engine-b3/w0 |

### Slice 7 — R-DM-SIDEBAR-HOST (messaging-provider sole sidebar)

**Goal:** Host sidebar never calls bare `dbGetConversations`.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-dm-sidebar-host-slice7-investigation-2026-07.md) · [design](./r-dm-sidebar-host-slice7-design-2026-07.md) |
| Proof | vitest messaging providers + p3-runtime-data-path — 50/50 |

### Slice 8 — R-TRANSPORT-CHECKPOINT-READ (ACC-03 frontier via engine)

**Goal:** Checkpoint frontier load uses `transport.listRelayCheckpoints` only.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-transport-checkpoint-read-slice8-investigation-2026-07.md) · [design](./r-transport-checkpoint-read-slice8-design-2026-07.md) |
| Proof | vitest relay-checkpoint-sqlite-store + sync-checkpoints.native + transport-engine-w1 |

### Slice 9 — R-TRANSPORT-CHECKPOINT-UPSERT (ACC-03 mirror via engine)

**Goal:** Checkpoint mirror writes use `transport.upsertRelayCheckpoint` only.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) — bare `db_upsert_relay_checkpoint` IPC still registered (tombstone later) |
| Specs | [design](./r-transport-checkpoint-upsert-slice9-design-2026-07.md) |
| Proof | `cargo test --lib transport_upsert_relay_checkpoint` 2/2 · vitest relay-checkpoint + transport-engine-w1 + sync-checkpoints.native |

### Slice 10 — R-TRANSPORT-CHECKPOINT-ACL (quarantine bare checkpoint db_*)

**Goal:** ACL omit unused checkpoint `db_*` so reintroduced invokes fail closed.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [design](./r-transport-checkpoint-acl-slice10-design-2026-07.md) |
| Proof | vitest `engine-invoke-boundary-catalog.contract.test.ts` |

### Slice 11 — R-TRANSPORT-CHECKPOINT-TOMBSTONE (remove checkpoint db_* handlers)

**Goal:** Unregister/delete bare checkpoint IPC; sole path = transport engine.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) · `cargo check -p obscur_desktop_lib` |
| Specs | [design](./r-transport-checkpoint-tombstone-slice11-design-2026-07.md) |
| Proof | vitest boundary catalog + relay-checkpoint — 17/17 · cargo check |

### Slice 12 — R-DM-INTEGRITY-READ (integrity/repair → dm-engine)

**Goal:** Diagnostic integrity + repair scans use `fetchDmThreadRows` / `listDmConversations` only.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-dm-integrity-read-slice12-investigation-2026-07.md) · [design](./r-dm-integrity-read-slice12-design-2026-07.md) |
| Proof | vitest integrity + repair + durability contract — 22/22 |

### Slice 13 — R-BACKUP-DM-READ (backup collect DM → dm-engine)

**Goal:** `collectNativeSqliteBackupEvidence` DM list/thread via engine; groups remain bare IPC (PAUSED).

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-backup-dm-read-slice13-investigation-2026-07.md) · [design](./r-backup-dm-read-slice13-design-2026-07.md) |
| Proof | vitest backup-evidence + path-b-b4-exit — 10/10 |

### Slice 14 — R-HYDRATE-DM-READ (hydrate window → dm-engine)

**Goal:** `loadLegacyConversationWindow` uses `fetchDmThreadRows` (incl. `beforeReceivedAt`).

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-hydrate-dm-read-slice14-investigation-2026-07.md) · [design](./r-hydrate-dm-read-slice14-design-2026-07.md) |
| Proof | vitest hydrate-indexed-scan + durability + monotonic — 21/21 |

### Slice 15 — R-DM-READ-TOMBSTONE (remove db_get_messages / db_get_conversations IPC)

**Goal:** Unregister bare DM read IPC; sole path = `engine_invoke` dm methods.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) · `cargo check` desktop |
| Specs | [investigation](./r-dm-read-tombstone-slice15-investigation-2026-07.md) · [design](./r-dm-read-tombstone-slice15-design-2026-07.md) |
| Proof | vitest boundary catalog (+ probe/bootstrap cleanups) — 23/23 · cargo check |

### Slice 16 — R-VAULT-PERSISTENCE (vault media index → persistence engine)

**Goal:** Product vault index via `persistence.*` engine methods; bare vault `db_*` IPC deferred tombstone.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-vault-persistence-slice16-investigation-2026-07.md) · [design](./r-vault-persistence-slice16-design-2026-07.md) |
| Proof | `cargo test persistence_vault_media_index_round_trip` · vitest vault + boundary — 13/13 |

### Slice 17 — R-VAULT-IPC-TOMBSTONE

**Goal:** Unregister vault media `db_*` Tauri commands; sole product IPC = `persistence.*`.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [design](./r-vault-ipc-tombstone-slice17-design-2026-07.md) |
| Proof | cargo check desktop · vitest boundary catalog (Slice 16–17 asserts) |

### Slice 18 — R-DB-IPC-INVENTORY + R-CALL-PERSISTENCE

**Goal:** Rank remaining bare `db_*`; migrate ACC-04 call records onto `persistence.*`.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [inventory](./r-db-ipc-inventory-slice18-investigation-2026-07.md) · [call design](./r-call-persistence-slice18-design-2026-07.md) |
| Proof | `cargo test persistence_call_records_round_trip` · vitest call/p5/boundary — 29/29 |

### Slice 19 — R-CALL-IPC-TOMBSTONE

**Goal:** Unregister call-record `db_*` Tauri commands; sole product IPC = `persistence.*`.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [design](./r-call-ipc-tombstone-slice19-design-2026-07.md) |
| Proof | cargo check desktop · vitest boundary + ACC-04 |

### Slice 20 — R-DM-TOMBSTONE-DELETE

**Goal:** Product DM delete + tombstone paths via `dm.*` engine methods.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-dm-tombstone-delete-slice20-investigation-2026-07.md) · [design](./r-dm-tombstone-delete-slice20-design-2026-07.md) |
| Proof | `cargo test dm_tombstone_delete_round_trip` · vitest boundary + delete/tombstone owners — 50/50 |

### Slice 21 — R-DM-DELETE-TOMBSTONE-IPC

**Goal:** Unregister DM delete/tombstone `db_*` Tauri commands; sole product IPC = `dm.*`.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [design](./r-dm-delete-tombstone-ipc-slice21-design-2026-07.md) |
| Proof | cargo check desktop · vitest boundary + DM owner contracts — 33/33 |

### Slice 22 — R-SEARCH-WIPE-PERSISTENCE

**Goal:** `searchMessages` + `wipeProfileLocalData` on persistence engine; migrate profile wipe product path.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-search-wipe-persistence-slice22-investigation-2026-07.md) · [design](./r-search-wipe-persistence-slice22-design-2026-07.md) |
| Proof | `cargo test persistence_wipe_profile_local_data` · vitest profile-reset + boundary — 20/20 |

### Slice 23 — R-SEARCH-WIPE-IPC-TOMBSTONE

**Goal:** Unregister search/wipe `db_*` Tauri commands; sole product IPC = `persistence.*`.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [design](./r-search-wipe-ipc-tombstone-slice23-design-2026-07.md) |
| Proof | cargo check desktop · vitest boundary + profile-reset |

### Slice 24 — R-DB-IPC-REMAINING (queue close for non-PAUSED)

**Goal:** Pin remaining ACL to community/group PAUSED set; close non-PAUSED `db_*` subtract band.

| Field | Value |
|-------|--------|
| Status | **Done** (L1) |
| Specs | [investigation](./r-db-ipc-remaining-slice24-investigation-2026-07.md) · [design](./r-db-ipc-remaining-slice24-design-2026-07.md) |
| Proof | vitest boundary remaining ACL pin |

### Dual-owner subtract (relay path complete · community leftover PAUSED)

| Band | Spec | Status |
|------|------|--------|
| `dm-persist` #1–3 | [design](./dm-persist-dual-owner-design-2026-07.md) · [#3](./dm-persist-dual-owner-slice3-design-2026-07.md) | **Done** |
| Boundary B1–B3(backup) | [boundary](./engine-invoke-boundary-subtract-design-2026-07.md) · [B3](./engine-invoke-b3-backup-evidence-migrate-design-2026-07.md) | **Done** (community `dbInsertMessage` still allowlisted) |
| `relay-publish` #1–3 · R1–R3 | [shim](./relay-publish-lab-shim-tombstone-design-2026-07.md) · [R1](./relay-publish-r1-inventory-design-2026-07.md) · [R2](./relay-publish-r2-quarantine-design-2026-07.md) · [R3](./relay-publish-r3-tombstone-design-2026-07.md) | **Done** |
| L3 | [insert](../../docs/handoffs/dual-owner-b2-l3-engine-invoke-2026-07-30.md) · [publish](../../docs/handoffs/dual-owner-l3-publish-local-relay-2026-07-30.md) | **Done** (local ephemeral `:7000`; public WSS down) |
| Community invite `dbInsertMessage` | — | **Blocked** — community PAUSED |

**Next charter band:** Maintainer — P2 unlock→shell UI soak (release L3) · **or** community un-pause charter before group/invite `db_*` migrate. Non-PAUSED `db_*` queue closed.

---

## Dev ≡ production contract (reminder)

| Surface | Must match |
|---------|------------|
| Env | `EXPERIMENT_ONLINE=1`, `DEV_LAB` off |
| Shell | Rebuild when sources change (`--rebuild` / stale auto) |
| Proof | P2–P4 on **release exe** before ship claims |

---

## Claim language

| May say | When |
|---------|------|
| Queue chartered | This doc + handoff next step = Slice 2 investigation |
| Slice N designed | Investigation + design under `specs/backend/` |
| Implemented | Keep-set diff only · matches design |
| Fixed (runtime) | L3 on parity/release · named digest / op |

---

## Explicit non-goals

- Big-bang rewrite of all Rust crates in one PR  
- Un-pausing `relay-publish` / `dm-persist` / community without integration study  
- Treating `dev:desktop:live` as production proof  
- Adding a second session or relay owner “for compatibility”
