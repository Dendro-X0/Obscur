# Design — R5 O-4 ingest room-key owner alignment

**Status:** Approved · **implemented** (2026-07-04) · t4 pending  
**Investigation:** [o4-ingest-chrome-r5-investigation-2026-07.md](./o4-ingest-chrome-r5-investigation-2026-07.md)  
**Chain:** `chain-r5-o4-ingest-chrome-2026-07-04` (or append `chain-o4-group-ingest-2026-07-02`)

---

## Problem (post R1 + R3)

| Path | Room-key lookup | Result |
|------|-----------------|--------|
| **Send** (`group-service`) | `resolveRoomKeyForCommunityAction` — local → coordination materialize | **Works** on NewTest 2 fixture |
| **Health** (R1) | `resolveRoomKeyHexForMembershipHealthPanel` — same cascade | **Works** · no false `room_key_missing` when chat enabled |
| **Sidebar preview** (R3) | SQLite list-time hydrate | **t4 PASS** `csess-264849283e3c` |
| **Relay ingest decrypt** (`group-thread-relay-ingest.ts`) | `roomKeyStore.getRoomKeyRecord(groupId)` **only** | **`decrypt_failed`** when key exists only via coordination wrap |

Ingest hooks swallow errors (`catch(() => {})`). Thread and sidebar stay stale while send/health look healthy — **ingest chrome split-brain**.

Second-profile receive (Tester2 on `:9231`) is the primary t4 gap: background ingest runs without visiting community home, so coordination materialize never runs before decrypt.

---

## Design decision

**Option B — ingest-time room-key resolution via coordination owner** (subtraction; mirrors R1):

Before decrypting a sealed relay chat event, resolve room key through the **same owner** as send/health (`resolveRoomKeyHexForMembershipHealthPanel` or thin wrapper `resolveRoomKeyHexForGroupRelayIngest`).

Do **not** add a parallel coordination fetch inside `group-thread-relay-ingest.ts`. Call the existing owner in `community-coordination-room-key-owner.ts`.

**Not chosen:**

| Option | Why not |
|--------|---------|
| A — Materialize on community home only | Leaves background ingest broken for joined groups |
| C — UI banner when ingest fails | Symptom patch; ingest still silent |
| D — Dual read model in thread hook | Duplicates SQLite authority |

**Dev ergonomics (H5, parallel slice):** Add `apps/pwa/app/features/groups` to `static-shell-stale.mjs` watch roots so `dev:desktop` rebuilds after group-band edits without manual `--rebuild`.

---

## Owner map

| Concern | Owner |
|---------|--------|
| Room-key resolve (local → coordination) | `community-coordination-room-key-owner.ts` |
| Ingest decrypt choke | `group-thread-relay-ingest.ts` — call owner; remove direct `getRoomKeyRecord` |
| Hook context (pubkey + **private key**) | `use-group-thread-relay-ingest.ts` · `use-workspace-kernel-joined-groups-relay-ingest.ts` |
| Wire private key from identity | `main-shell.tsx` · `group-home-page-client.tsx` · `workspace-kernel-group-relay-ingest-owner.tsx` |
| Thread refresh after persist | `appendGroupThreadMessage` → `group-thread-messages-changed` (existing) |
| Sidebar preview after ingest | R3 `group-sidebar-preview-sqlite-hydrate.ts` (existing) |

**Subtraction rule:** Delete `decryptSealedInnerPayload`'s standalone `getRoomKeyRecord` path once owner call lands. One decrypt entrypoint.

---

## Context contract extension

Extend `GroupThreadRelayIngestContext` and hook params:

```typescript
localPrivateKeyHex?: PrivateKeyHex | null;
```

Wire from `useIdentity().state.privateKeyHex` at each ingest mount point. Ingest without private key may still attempt local `getRoomKey` only (honest degrade); coordination materialize requires key.

Optional: pass `groupIdCandidates` + `activeMemberPubkeys` when available from coordination directory (group-home already has these for health).

---

## Implementation slice

1. Add `resolveRoomKeyHexForGroupRelayIngest` in `community-coordination-room-key-owner.ts` — delegates to `resolveRoomKeyHexForMembershipHealthPanel` with ingest-shaped params (document as ingest owner alias).
2. Refactor `decryptSealedInnerPayload` → accept resolved `roomKeyHex` from caller; caller invokes owner with `context.groupId`, `context.communityId`, `context.myPublicKeyHex`, `context.localPrivateKeyHex`.
3. Extend `UseGroupThreadRelayIngestParams` + workspace-kernel joined-groups ingest with `localPrivateKeyHex`.
4. Wire `myPrivateKeyHex` / `privateKeyHex` from identity in `main-shell.tsx`, `group-home-page-client.tsx`, `workspace-kernel-group-relay-ingest-owner.tsx`.
5. L1: `group-thread-relay-ingest.test.ts` — mock owner; assert materialize path used when local store empty.
6. L1: `community-coordination-room-key-owner.test.ts` — ingest alias delegates correctly.
7. (Optional) `static-shell-stale.mjs` — add `apps/pwa/app/features/groups` watch root.

---

## Mental simulation

1. **Tester1 sends** on NewTest 2 — publish succeeds (unchanged).
2. **Tester2 background ingest** — `WorkspaceKernelGroupRelayIngestOwner` receives relay event.
3. **Before:** `getRoomKeyRecord` miss → `decrypt_failed` → silent catch → thread empty.
4. **After:** owner materializes wrap → decrypt succeeds → `appendGroupThreadMessage` → thread hook + R3 sidebar hydrate update.
5. **Failure:** no private key on ingest context → local-only lookup → same as today (honest miss).

---

## Proof plan

| Layer | Command / action |
|-------|------------------|
| **L1** | `pnpm -C apps/pwa exec vitest run app/features/groups/services/group-thread-relay-ingest.test.ts app/features/groups/services/community-coordination-room-key-owner.test.ts` |
| **L3** | Full stack · Tester1 send `R5-o4-ingest-t4-*` · digest shows ingest persist (not `decrypt_failed`) |
| **L4** | Tester2 profile window (`:9231` or second attach) · message visible without opening community home first |
| **Surface** | `client_surface_probe` on group thread — `mainThreadMessageCount` increases · no false health blockers |

### CodaCtrl capture

1. `pnpm dev:desktop -- --online --rebuild` (post implementation)
2. `client_session_connect` `:9230` → Tester1 unlock
3. Open **NewTest 2** group thread · send `R5-o4-ingest-t4-*`
4. Attach Tester2 (`:9231` or `alwaysNewSession`) · verify ingest without community-home visit
5. `client_surface_probe` · chain `chain-r5-o4-ingest-chrome-2026-07-04`

**Does not prove:** COM-RUN-01 roster · packaged NSIS · ingest without coordination `:8787`

---

## Out of scope

- Membership health banner copy changes (R1 closed send/health split)
- COM-RUN-01 roster divergence (accepted)
- Relay transport / subscription filter changes
- Persisting ingest failure UI toasts (future UX band)

---

## Register / handoff exit

**VERIFIED t4** when Tester2 (or cold same-profile) receives group message via background ingest without false `decrypt_failed` in digest, and group thread count increases without opening community home first.
