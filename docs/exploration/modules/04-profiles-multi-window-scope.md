# Module 4 — Profiles & multi-window scope

_Last reviewed: 2026-06-02 (baseline commit 7f84f813)._

**Status:** v1 complete (first-pass audit)  
**Last updated:** 2026-06-02  
**Scope:** `apps/pwa/app/features/profiles/` + desktop boot, runtime scope injection, account-scope boundary, cross-module hydrate coupling

---

## 1. Scope

**Primary path:** `apps/pwa/app/features/profiles/` — **128** TS/TSX files (**91** prod, **37** test), **~8.4k prod LOC**.

| Subfolder | ~Files | Owns |
|-----------|--------|------|
| `services/` | ~80 | Registry, boot, scope resolution, slot binding, portability/export, profile bus dual-subscribers, archive/wipe |
| `components/` | 27 | Bootstrap shell, switcher, auth-screen restore/portability UI, slot conflict dialogs |
| `providers/` | 2 | `ProfileRuntimeProvider` + storage-ports test |
| `hooks/` | 2 | `use-unified-import-flow` |
| `types/` | 1 | `StoragePorts` |

**Largest prod files:**

| File | ~LOC | Role |
|------|------|------|
| `services/portability-import-preflight.ts` | 434 | Import validation |
| `services/desktop-profile-runtime.ts` | 326 | Native snapshot store, scope apply, background refresh |
| `services/encrypted-workspace-bundle-service.ts` | 312 | Encrypted workspace bundles |
| `services/unified-account-export-service.ts` | 229 | Portable account export |
| `services/profile-registry-service.ts` | 223 | Web registry (localStorage) |
| `components/manual-portability-panel.tsx` | 296 | Manual export/import UI |
| `components/auth-screen-local-save-library.tsx` | 254 | Local save library on auth screen |

**Adjacent paths (outside feature root):**

| Path | Role |
|------|------|
| `apps/pwa/app/layout.tsx` | Pre-React init scripts: `__OBSCUR_WINDOW_BOOT__` → `__OBSCUR_SYNC_PROFILE_SCOPE__`, scoped theme/accessibility keys |
| `apps/pwa/app/components/providers.tsx` | Mounts `DesktopProfileBootstrap` at app root |
| `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx` | Auth stall recovery (truth map row 3) |
| `apps/pwa/app/features/runtime/components/account-scope-boundary-owner.tsx` | Profile+account cache purge on scope change (Enc. 18) |
| `apps/pwa/app/features/runtime/components/secondary-profile-post-login-refresh.tsx` | Secondary-window DM soft refresh |
| `apps/pwa/app/features/runtime/services/window-runtime-binding.ts` | Identity + desktop snapshot → supervisor |
| `apps/desktop/src-tauri/src/profiles.rs` | Native registry, window labels, init script, shared profile data dir |
| `apps/desktop/src-tauri/src/lib.rs` | Main window boot payload injection |
| `apps/desktop/src-tauri/src/commands/profile.rs` | Tauri IPC: snapshot, open/bind profile window |

**Scale vs other modules:**

| Module | Prod LOC | Note |
|--------|----------|------|
| Profiles (M4) | ~8.4k | Medium-small root; **high fan-out** — scope touches most hydrate paths |
| Messaging (M2) | ~56k | Primary consumer of `getResolvedProfileId`, multi-slot scan |
| Groups (M1) | ~36.5k | Sealed persistence uses `readActiveDesktopProfileId` + multi-slot scan |
| Account-sync (M3) | ~12k | Backup/restore keyed by resolved profile + account partition |

**Bridge pattern:** 15 `subscribe-*-dual.ts` files under `profiles/services/` — profile bus events scoped by `profileId`, bridged to legacy window events.

---

## 2. Stated contract (canonical docs)

| Claim | Source |
|-------|--------|
| Row 0 (R0) — `getResolvedClientGateway()` installed by `ProfileRuntimeProvider` | Truth map + `14-module-owner-index.md` |
| Row 2 — startup profile-binding owner: `desktop-profile-bootstrap.tsx` | Truth map |
| Row 3 — startup auth-shell recovery: `profile-bound-auth-shell.tsx` | Truth map |
| Invariant #1 — identity/profile scope resolves before account-scoped stores mount | Truth map § Critical Runtime Invariants |
| Invariant — explicit `profileId` and keys; no ambient "current user" in shared code | `design-goals-and-constraints.md` §4.2 |
| Enc. 18 — derived caches scope-derived; rebuild/clear on account/profile change; do not scope privacy-critical localStorage by `profileId` alone when account can change underneath | `encyclopedia/18-account-scope-and-discovery-guardrails.md` |
| Desktop multi-window boot — owner `desktop-window-boot.ts`; never block React on native IPC; sync scope from label/cache | `architecture/production-surfaces.md` § Desktop multi-window boot |
| P3b–P3d — manual two-profile soak (Tester1/Tester2 slots) pending | Design goals §4 |
| Shared profile storage (W0-1 lane) — per-profile data dir on native | Native policy / production surfaces |

---

## 3. As-built ownership

### 3.1 Profile registry / active profile selection

| Layer | Owner | Mechanism |
|-------|-------|-----------|
| **Web registry** | `ProfileRegistryService` (`profile-registry-service.ts`) | Key `obscur.profiles.registry.v1`; `getActiveProfileId()`, `switchProfile()`, `createProfile()`; emits `obscur-profile-changed` |
| **Desktop per-window active id** | `desktopProfileRuntime` (`desktop-profile-runtime.ts`) | `currentSnapshot.currentWindow.profileId`; updated from boot payload, label parse, cache, or native `desktop_get_profile_isolation_snapshot` |
| **Pre-React sync scope** | `layout.tsx` inline script + `mirrorDesktopWindowBootPayloadToSyncScope()` | Sets `window.__OBSCUR_SYNC_PROFILE_SCOPE__` and `obscur.desktop.window_profile.last_known.v1::{windowLabel}` |
| **Runtime resolution** | `getResolvedProfileId()` (`profile-runtime-scope.ts`) | Order: `getProfileScopeOverride()` (sync scope OR module override) → `injected?.profileId` → `readRegistryBackedActiveProfileId()` |
| **Pre-unlock desktop read** | `readActiveDesktopProfileId()` (`read-active-desktop-profile-id.ts`) | Sync scope → boot payload cache → legacy global last-known → registry `activeProfileId` → `"default"` |
| **React provider selection** | `ProfileRuntimeProvider` | Native: `desktopSnapshot.currentWindow.profileId`; else registry via `useSyncExternalStore` |

**Finding:** Two parallel "active profile" concepts coexist — global registry `activeProfileId` (web + fallback) vs per-window desktop snapshot (native secondary windows). Resolution order differs between pre-unlock and post-unlock paths.

### 3.2 Desktop window boot payload & profile scope injection

| Step | Function / location | Notes |
|------|---------------------|-------|
| Rust inject | `window_boot_init_script()` in `apps/desktop/src-tauri/src/profiles.rs` | `window.__OBSCUR_WINDOW_BOOT__={windowLabel,profileId}` before bundle load |
| Main window default | `apps/desktop/src-tauri/src/lib.rs` | `{windowLabel:"main",profileId:"default"}` |
| Layout mirror (earliest) | `apps/pwa/app/layout.tsx` ~L74–96 | Copies boot → `__OBSCUR_SYNC_PROFILE_SCOPE__` + per-window cache |
| Bootstrap entry | `DesktopProfileBootstrap` → `startDesktopWindowBoot()` (`desktop-window-boot.ts`) | Non-blocking; `markDesktopShellBootReady()` immediately |
| Payload apply | `applyDesktopWindowBootPayload()` (`desktop-profile-runtime.ts`) | `mirrorDesktopWindowBootPayloadToSyncScope()` → label/cache/override |
| Background reconcile | `desktopProfileRuntime.refresh()` | IPC `desktop_get_profile_isolation_snapshot` (25s timeout) |
| Secondary reveal | `invokeNativeCommand("window_reveal_current")` + Rust 45s failsafe | Only when `isSecondaryProfileWindowLabel()` |
| Window label format | `parseProfileIdFromWindowLabel()` (`desktop-profile-window-label.ts`) | `profile-{profileId}-{timestamp}` |

**Contract (observed):** Boot never blocks React on native IPC. Synchronous scope from init script / label / cache; native snapshot reconciles in background.

### 3.3 ProfileRuntimeProvider / gateway install

| Concern | Owner | Details |
|---------|-------|---------|
| **Provider mount point** | `UnlockedAppRuntimeShell` | After auth unlock — not during `ProfileBoundAuthShell` |
| **Scope injection** | `ProfileRuntimeProvider` `useEffect` | `setProfileRuntimeScope({ profileId, bus, storagePorts, clientGateway })` |
| **profileId source** | Provider `useMemo` | Override → native window profile → registry |
| **Gateway build** | `buildAppClientGateway({ profileId, storagePorts })` | Stored on scope as `clientGateway` |
| **Service accessor** | `getResolvedClientGateway()` (`resolve-client-gateway.ts`) | Scope gateway → fallback `buildAppClientGateway(getResolvedProfileId(), …)` |
| **Pre-unlock reads** | `getResolvedProfileId()` without provider | Works via `__OBSCUR_SYNC_PROFILE_SCOPE__` / `setProfileScopeOverride` from desktop runtime |
| **Side effects on profile change** | Provider | `messagePersistenceService.bindProfileScope(profileId)`; tombstone SQLite hydrate; retention sweep |

### 3.4 Multi-window account binding

| API | Storage | Purpose |
|-----|---------|---------|
| `setLastBoundAccountPublicKeyHex(profileId, pk)` | `obscur.profile_window.last_bound_account::{profileId}` | Records which account owns a profile slot |
| `getLastBoundAccountPublicKeyHex` / `clearLastBoundAccountPublicKeyHex` | Same | Slot occupancy read/clear |
| `listProfileIdsWithBoundAccountPublicKeyHex(accountPk)` | Scans all `::`-suffixed keys | Cross-slot discovery for hydrate |
| `evaluateProfileWindowAccountContinuity` | — | `initial_bind` / `same_account` / `account_changed` |

**Writers:** `recordProfileWindowAccountUnlock()` in `profile-session-lifecycle.ts` (post-unlock).  
**Readers:** `profile-slot-login-guard.ts`, `account-shared-sqlite-profile-ids.ts`, `auth-profile-local-evidence.ts`, archive/wipe flows.

**Pre-unlock guards:** `assertAccountUnlockAllowed()` chains `assertProfileSlotAllowsLogin` + `assertAccountNotActiveInOtherProfileWindow`; called from `window-runtime-supervisor.ts`.

**Account switch policy:** `clearProfileSlotForDifferentAccount()` / `openFreshProfileWindowForSignIn()` (`profile-slot-account-switch.ts`) — no silent post-unlock wipe.

### 3.5 `listAccountSharedSqliteProfileIds` (cross-module hydrate bridge)

**File:** `account-shared-sqlite-profile-ids.ts`

**Logic:**

- Web (`!requiresSqlitePersistence()`): `[primaryProfileId]` only — **no multi-slot scan**
- Native: union of `primaryProfileId`, `"default"`, all `ProfileRegistryService` profiles, all slots bound to account via `listProfileIdsWithBoundAccountPublicKeyHex`

**Consumers:**

| Module | Call site | Purpose |
|--------|-----------|---------|
| M2 DM | `dm-conversation-hydrate-indexed-scan.ts`, `dm-conversation-hydrate-pipeline.ts`, `use-conversation-messages.ts` | Parallel `dbGetMessages` per slot; filter by account downstream |
| M1 Groups | `sealed-group-message-persistence.ts` → `loadSqliteGroupMessages`, `loadGroupMessagesFromChatStateAliases` | Same cross-slot scan for group bodies |
| M3 | Indirect — restore writes into active resolved profile slot; scan compensates on read | |

**Code comment (authoritative intent):** Historical rows may have been written under the wrong slot before scope was corrected; hydrate scans every registered slot; callers must filter merged rows to the active account.

### 3.6 Storage ports / scoped localStorage keys

| Surface | Owner | Keys / pattern |
|---------|-------|----------------|
| **StoragePorts type** | `types/storage-ports.ts` | Currently only `messageDeleteTombstones` port |
| **Scoped keys helper** | `getScopedStorageKey(base, profileId)` (`profile-scope.ts`) | `{baseKey}::{profileId}` |
| **Identity DB key** | `getProfileIdentityDbKey(profileId)` | `identity::{profileId}` |
| **Registry** | Global (not profile-suffixed) | `obscur.profiles.registry.v1` |
| **Window profile cache** | Per window label | `obscur.desktop.window_profile.last_known.v1::{windowLabel}` |
| **Slot binding** | Per profile | `obscur.profile_window.last_bound_account::{profileId}` |
| **Cross-window leases** | Global by account pubkey | `obscur.cross_profile.active_session_leases.v1` |
| **UI theme/accessibility** | Per profile | `dweb.nostr.pwa.ui.theme::{profileId}` (also mirrored in layout init) |

### 3.7 Secondary profile window policies

| Policy | Owner | Behavior |
|--------|-------|----------|
| **Not default slot** | `isSecondaryProfileWindow()` (`secondary-profile-post-login-refresh-policy.ts`) | `profileId !== "default"` |
| **Post-login DM refresh** | `SecondaryProfilePostLoginRefresh` + `runSecondaryProfileDmSoftRefresh` | 8s delay; sqlite index rebuild + thread re-hydrate; sessionStorage dedupe per profile |
| **Single active session** | `cross-profile-active-session-lease.ts` + `ActiveSessionLeaseOwner` | 12s TTL, 4s heartbeat; blocks unlock in second window for same account |
| **Slot conflict UI** | `profile-slot-account-conflict-*.tsx`, `account-active-in-other-profile-inline.tsx` | Surfaces `ProfileSlotAccountConflictError`, `AccountActiveInOtherProfileWindowError` |
| **Fresh window for new account** | `openFreshProfileWindowForSignIn()` | Creates registry profile + `desktop_open_profile_window` |
| **Native data dir** | `shared_profile_data_dir()` in Rust | Secondary windows share profile-scoped WebView storage dir |

---

## 4. Persistence & truth (profile as partition key)

Profiles do not own message bodies directly. They **partition** every downstream store:

| Store | Profile coupling | Wrong-slot symptom |
|-------|------------------|-------------------|
| **SQLite (`@dweb/db`)** | All ops take `profileId` param | `dbGetMessages(wrongSlot, convId)` → `[]` |
| **chat-state mirror** | Scoped by `(profileId, publicKeyHex)` via `getScopedStorageKey` | Thin/empty mirror for active account in wrong slot |
| **Account event log (M3)** | Partition `${profileId}::${accountPublicKeyHex}` | Restore/backup applies to resolved slot only |
| **Community ledger / directory (M1)** | Scoped keys + `getResolvedProfileId()` in `group-provider` | Group list metadata may survive while bodies miss |
| **Profile bus** | Events scoped by `profileId`; dual subscribers bridge legacy | Cross-profile events dropped in isolation tests |
| **Registry** | Global localStorage per WebView | Secondary window registry may diverge until native sync |

**Cross-module failure pattern (Modules 1–3):**

```
Write path: message persisted under profileId = X (window at send time)
Read path:  hydrate uses profileId = Y (resolved at load time)
Result:     sidebar/metadata may survive (different lifecycle) while thread body empty
Mitigation: listAccountSharedSqliteProfileIds merges slots on native; account filter downstream
Residual:   unregistered/unbound slot not in union → still empty; web has no scan
```

**Startup order (observed):**

```
layout.tsx init scripts (__OBSCUR_SYNC_PROFILE_SCOPE__)
  → DesktopProfileBootstrap / startDesktopWindowBoot
  → WindowRuntimeBindingOwner
  → AuthGateway / ProfileBoundAuthShell
  → UnlockedAppRuntimeShell
      → ProfileRuntimeProvider (setProfileRuntimeScope + gateway)
      → AccountScopeBoundaryOwner (purge derived caches on scope change)
      → GroupProvider / MessagingProvider / …
```

---

## 5. Doc vs code conflicts

| Doc says | Code does | Severity |
|----------|-----------|----------|
| Truth map row 2 owner: `desktop-profile-bootstrap.tsx` | Scope injection split across `layout.tsx` scripts, `desktop-window-boot.ts`, `desktop-profile-runtime.ts`; bootstrap only calls `startDesktopWindowBoot()` | **Med** — bootstrap is lifecycle gate, not sole scope owner |
| `production-surfaces.md` boot owner: `desktop-window-boot.ts` | Truth map / module index cite `desktop-profile-bootstrap.tsx` | **Low** — naming split |
| Design goals: explicit `profileId`, no ambient current user | `getResolvedProfileId()` falls back to registry `activeProfileId`; global registry not window-aware on web | **Med** |
| Invariant: profile scope before account-scoped stores mount | `ProfileRuntimeProvider` mounts only after unlock; pre-unlock paths use sync scope + override parallel to provider | **Med** — works but dual path |
| Enc. 18: don't scope privacy-critical storage by profileId alone | Slot binding is profile-scoped by design; guards require explicit account continuity checks | **Low** — intentional, easy to misuse |
| Shared profile storage (W0-1) | Rust uses per-profile `data_directory`; registry in each WebView's localStorage may diverge until native refresh | **Med** — multi-window registry coherence unclear |
| P3b–P3d two-profile soak pending | Cross-slot scan added for native hydrate; no CI gate for multi-window cold restart | **High** — process gap |

---

## 6. Test & CI coverage

**Present (profiles feature — 37 test files):**

| Area | Test file | Proves |
|------|-----------|--------|
| Boot payload | `desktop-window-boot-payload.test.ts`, `desktop-window-boot.test.ts` | Sync scope mirror, non-blocking boot |
| Bootstrap UI | `desktop-profile-bootstrap.test.tsx` | Web vs native boot gate |
| Scope resolution | `profile-runtime-scope.test.ts`, `profile-scope.test.ts`, `read-active-desktop-profile-id.test.ts` | Override / sync / registry order |
| Multi-slot hydrate | `account-shared-sqlite-profile-ids.test.ts` | Registry union + bound slots |
| Slot login guard | `profile-slot-login-guard.test.ts` | Block different account in occupied slot |
| Cross-window lease | `cross-profile-active-session-lease.test.ts` | TTL, claim, conflict error |
| Bus isolation | `single-process-profile-isolation.test.ts`, `profile-message-bus.test.ts` | Cross-profile event drop |
| Gateway | `resolve-client-gateway.test.ts`, `profile-runtime-provider.storage-ports.test.tsx` | Fallback gateway assembly |
| Window label | `desktop-profile-window-label.test.ts` | Secondary label parse |
| Registry | `profile-registry-service.test.ts` | CRUD, switch |
| Portability/archive | Multiple | Export/wipe/archive flows |

**Present (runtime, adjacent):**

- `profile-bound-auth-shell.test.tsx` — stall timeout UI
- `secondary-profile-dm-soft-refresh.test.ts`, `secondary-profile-window-reload-scheduler.test.ts`
- `window-runtime-supervisor.test.ts` — includes unlock guard paths
- DM hydrate tests mock `listAccountSharedSqliteProfileIds` for multi-slot scenarios

**Missing (user-visible gaps):**

| Gap | Severity |
|-----|----------|
| No dedicated test for `profile-window-account-binding.ts` (only indirect) | Med |
| No test for `AccountScopeBoundaryOwner` / `account-scope-boundary.ts` | Med |
| No integration test: Tauri multi-window boot → unlock → DM/group hydrate across two profile windows | **High** |
| No test for `layout.tsx` init-script scope vs secondary-window theme path (registry fallback) | Med |
| `desktop-profile-runtime.test.ts` minimal (~12 LOC) — native refresh/fallback largely untested | Med |
| Manual two-profile soak (P3b–P3d) still pending per design goals | **High** (process) |
| End-to-end account switch + cross-slot data recovery | **High** |

**CI gates:**

- Truth map minimal set includes `profile-bound-auth-shell.test.tsx`
- **Not gated:** profile boot, multi-window hydrate, slot binding, account-scope boundary purge
- Compare M2: `pnpm verify:p5-persistence` (64 tests) — no profile/multi-window band

---

## 7. Hypotheses (not proven)

- **H1:** User-reported "sidebar survives, thread empty after restart" on groups (M1) is partially explained by profile-slot mismatch at SQLite write vs read time, with list metadata coming from chat-state/ledger under a different resolution path than sealed message bodies.
- **H2:** Secondary WebView localStorage registry divergence causes `listAccountSharedSqliteProfileIds` to miss slots until `syncNativeProfilesIntoRegistry` completes on that window.
- **H3:** `layout.tsx` theme/accessibility init (uses registry `activeProfileId` when sync scope absent) can flash wrong theme in secondary windows before React hydrates — cosmetic but signals scope ordering gap.
- **H4:** Scanning *all* registry profiles (not just bound slots) is safe only because downstream account filtering is always applied — if a filter is skipped on any read path, unrelated account rows could surface.

---

## 8. Open questions for synthesis

1. **Canonical "active profile" on desktop:** Deprecate `ProfileRegistryService.activeProfileId` for native in favor of per-window snapshot only, or keep dual model for web + main-window default?
2. **`listAccountSharedSqliteProfileIds` breadth:** Is account filtering downstream always sufficient when scanning all registry profiles?
3. **Registry coherence across WebViews:** Race where secondary window registry diverges from Rust source of truth — is native refresh authoritative enough?
4. **Pre-unlock vs post-unlock gateway:** Should tombstone/hydrate paths before unlock be forbidden, or should sync scope + fallback gateway be the documented interim contract?
5. **AccountScopeBoundaryOwner untested:** Is purge-on-scope-change sufficient for Enc. 18 under rapid profile+account switches?
6. **Does cross-slot scan close "wrong slot empty hydrate"** for production claims without P3b–P3d manual soak?
7. **15 subscribe-*-dual.ts bridges:** Collapse target for v1.5+ or permanent adapter layer?
8. **Fork decision:** Should synthesis treat registry/window duality as a Path A amputation candidate (single-slot desktop only) vs Path B requirement (multi-window coordination)?

---

## 9. References

**Code:**

- `apps/pwa/app/features/profiles/services/profile-runtime-scope.ts` — `getResolvedProfileId`, `setProfileRuntimeScope`
- `apps/pwa/app/features/profiles/providers/profile-runtime-provider.tsx`
- `apps/pwa/app/features/profiles/services/desktop-window-boot.ts` — `startDesktopWindowBoot`
- `apps/pwa/app/features/profiles/services/desktop-profile-runtime.ts` — `applyDesktopWindowBootPayload`
- `apps/pwa/app/features/profiles/services/read-active-desktop-profile-id.ts`
- `apps/pwa/app/features/profiles/services/profile-window-account-binding.ts`
- `apps/pwa/app/features/profiles/services/account-shared-sqlite-profile-ids.ts`
- `apps/pwa/app/features/runtime/components/account-scope-boundary-owner.tsx`
- `apps/pwa/app/layout.tsx` — boot/sync init scripts
- `apps/desktop/src-tauri/src/profiles.rs` — `window_boot_init_script`

**Docs:**

- `docs/encyclopedia/12-core-architecture-truth-map.md` (rows 0–3, invariants)
- `docs/encyclopedia/18-account-scope-and-discovery-guardrails.md`
- `docs/program/design-goals-and-constraints.md` §4
- `docs/architecture/production-surfaces.md` § Desktop multi-window boot

**Prior modules:**

- [01-community-groups.md](./01-community-groups.md) — sealed persistence cross-slot scan
- [02-messaging-dm.md](./02-messaging-dm.md) §8 — Profiles cross-dep
- [03-account-sync-backup-restore.md](./03-account-sync-backup-restore.md) — restore ↔ profile partition

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | v1 — first-pass audit |
