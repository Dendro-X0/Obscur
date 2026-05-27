# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-05-27T18:00:00Z
- Session Status: **Active** — **v1.8.4** public release (v1.8.3 tag skipped)
- Active Owner: Maintainer

## Active objective

**Ship path:** Installer includes **desktop + mobile only** (no standalone PWA/web installer target).

**Sequence:**

1. **Native offline optimization** — Rust/Tauri shell, SQLite, keychain, startup IPC; experiment shell proves loadability.
2. **Desktop production reliability** — **primary** — cold start, nav, unlock, DM online, settings; S0 prod baseline.
3. **Online functional modules** — relay, coordination, account sync — on desktop first ([phase3-desktop-online-gate.md](../program/phase3-desktop-online-gate.md)).
4. **Android (Lane P1)** — **wrap-up only** — debug APK pipeline done; emulator/UI/UX pass before release, not parallel to desktop feature work ([stability-first-delivery.md](../program/stability-first-delivery.md)).

Charter refs: [obscur-offline-first-policy.md](../program/obscur-offline-first-policy.md), [obscur-2.0-milestone-roadmap.md](../program/obscur-2.0-milestone-roadmap.md) Lane **P**, [mobile-desktop-version-policy.md](../program/mobile-desktop-version-policy.md).

## Recently shipped (DM thread ownership — 2026-05-26)

| Piece | Effect |
|-------|--------|
| `usePinnedDmForMessageHook` | DM message hydration stays on last opened DM while user views a group — hook never re-binds to group id |
| `dm-thread-display-cache.ts` | Profile-scoped display cache; UI survives failed re-hydrate (no blank pane) |
| `use-chat-view-props` | DM hook receives DM ids only; group chat uses `groupState` / `mapSealedGroupMessagesToChatMessages` |
| `dm-read-authority-contract` | Native: prefer SQLite when projection missing a direction |
| Maintainer QA | Group → DM switch shows full bidirectional Tester1/Tester2 history without refresh |

**Evidence:** `use-pinned-dm-for-message-hook.test.ts`, `dm-thread-display-cache.test.ts`, `use-chat-view-props.dm-ownership.test.ts`, `dm-read-authority-contract.test.ts`.

**Out of scope (deferred):** community group **send** in coordination-only dev — still requires writable relay or future local-send owner redesign.

## Parked (2026-05-27) — relay-backed join after invite accept

**Maintainer decision:** Proceed without blocking on B stuck on **Complete join on relay** / relay retry loop.

| Validated (do not re-litigate) | Parked for v1.8.4+ / env soak |
|----------------------------------|-------------------------------|
| Membership truth / no ghost roster on A (coordination directory display) | `publishToCommunityScopeWithRetry` join path after DM accept |
| Invite lifecycle: wire `inviteId`, accept recorded in DM, card copy honest about relay lag | B group sidebar entry + sealed chat until relay ACK |
| Participant list shows directory active only (Tester1-only after leave) | Full matrix: invite → accept → **both** in group chat on `localhost:7000` |

**Env when resuming:** `pnpm dev:relay`, coordination `:8787`, drop or narrow `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE` for chat join tests. Card owner: `community-invite-card.tsx` (`inviteRetryJoin`).

**Next lane:** **v1.8.5** — relay join after accept, membership read-model port completion ([v1.8.x-release-train.md](../program/v1.8.x-release-train.md)).

## Recently shipped (search jump + highlight — 2026-05-24)

| Surface | Effect |
|---------|--------|
| Settings search | Scroll + purple pulse to indexed sections; retry until dynamic tab panels mount; **Community membership sync** panel rendered on Relays tab |
| Chat message search | Live thread messages indexed (not only chat-state store); identity-aware jump (`id` / `eventId` / `relayPublishedEventId`) |
| Discovery search | Result cards scroll + flash before navigation |
| Shared | `app/shared/search-target-highlight.ts` — `focusSearchTargetById` with resolve retries |

**Evidence:** `search-target-highlight.test.ts`, `conversation-history-search.test.ts`, `chat-view.test.tsx` (live-index + id resolve); maintainer visual QA on settings Relays search.

## Recently shipped (UI shell + native)

| Piece | Effect |
|-------|--------|
| Lazy `ProtocolState` init | Protocol DB opens on first command, not Tauri `setup` |
| `classifyTransportFailure` | Maps network errors → connection/offline problems (G5 prep) |
| Settings `)` artifact fix | blocklist/privacy/security/storage panels (restart dev to pick up) |
| Desktop startup IPC audit | Deferred WebView migration + async binding reset; skip redundant registry writes |
| Global top loading bar | Route/chunk feedback without full-page overlay |
| Settings tab switch | Removed in-panel black loading block; bar only |
| Chrome registry + portal fixes | Page-switch freeze/crash resolved |
| Turbopack default + desktop fail-open boot | Dev loadability improved |

## Native focus areas (current lane)

| Area | Path / owner |
|------|----------------|
| Tauri commands + IPC | `apps/desktop/src-tauri/src/commands/*` |
| SQLite / DB | `commands/db.rs`, native storage ports |
| Profiles + keychain | `profiles.rs`, `native_keychain.rs`, `session.rs` |
| Mobile shell build | `apps/desktop/src-tauri/tauri.conf.json`, `gen/android/*` |
| Offline runtime policy | `experiment-shell-policy.ts`, `obscur-offline-first-policy.md` O1–O4 |

## Signing policy (mobile — no commercial certs)

| Method | Role |
|--------|------|
| **Local release keystore** (self-generated) | Maintainer-owned APK signing; document in repo, never commit secrets |
| **Android Studio debug / project keystore** | Canonical dev + emulator path |
| **Direct sideload** (USB, file share) | Primary distribution for indie release |
| **F-Droid / Obtainium** (optional later) | Community-trusted distribution without Play Console |
| **Play Console / Apple Developer Program** | **Out of scope** — not purchasing commercial certificates |

Closeout deliverable: [android-p1-signing-runbook.md](../program/android-p1-signing-runbook.md) (generate keystore, `apksigner`, verify fingerprint, CI optional secret). Scripts: `verify:android-prerequisites`, `build:android:debug`, `build:android:release`.

## Recently shipped (persistence excision)

| Piece | Effect |
|-------|--------|
| `React is not defined` | `main-shell.tsx` — value import + `useCallback` (was type-only `React`) |
| IndexedDB excision | `rules/12-indexeddb-excised.md`, in-memory `@dweb/storage` engine, no `indexedDB.open` in app paths |
| Chat-state | Full state to localStorage only; IDB hydrate/mirror removed |
| DM web hydrate | SQLite on native; web window empty (chat-state + projection) |

## Phase 1 — app opens and stays open

Canonical doc: [phase1-desktop-shell-gate.md](../program/phase1-desktop-shell-gate.md)

| Change | Effect |
|--------|--------|
| `tauri.conf` dev | `EXPERIMENT_ONLINE=0` by default — offline stubs, not G6 relay tree |
| `pnpm verify:phase1` | Automated shell/runtime tests |
| `pnpm dev:desktop:online` | Explicit opt-in for online experiment modules |
| DesktopUpdater | GitHub fetch skipped in dev — no `Failed to fetch` overlay |

## Phase 2 — DM survives restart (automated complete)

Canonical doc: [phase2-desktop-dm-persistence-gate.md](../program/phase2-desktop-dm-persistence-gate.md)

| Fix | Effect |
|-----|--------|
| `usesBatchedPersistence()` | Tauri always flushes message bus → SQLite |
| `notifyMessagesIndexRebuilt` | Sidebar reloads from `db_get_conversations` after SQLite flush |
| `pnpm verify:phase2` | Green — manual P2-1…P2-8 on maintainer machine before G6-3 |

## UI stability (2026-05-22) — sidebar search render loop

**Fix:** `Maximum update depth exceeded` in `SidebarUserSearch` — relay pool identity churn. P0 `group-discovery`; P1 search/resolver trio; P1 shell/settings (`use-chat-actions`, `global-dialog-manager`, `use-profile-publisher`, `settings-tab-panel-model`) → `useRelayPoolRef`. Policy: [ui-effect-stability-policy.md](../program/ui-effect-stability-policy.md) · [ui-relay-pool-effect-audit-2026-05.md](../program/ui-relay-pool-effect-audit-2026-05.md).

## Radical stability slice (2026-05-22)

Canonical: [radical-stability-slice-2026-05.md](../program/radical-stability-slice-2026-05.md)

| Piece | Effect |
|-------|--------|
| `community-radical-truth-policy.ts` | Dev default: no persisted_fallback sidebar / coordinator backfill without ledger |
| `pnpm verify:stability` | `verify:phase3` + binding/stability tests + `verify-react-stability.mjs` + boundaries |

## Profile boot stall loop (2026-05-23) — fixed

| Fix | Effect |
|-----|--------|
| `bindProfile` locked fall-through | Label-only native refresh no longer resets `binding_profile` + `pending` |
| Loading + stored key | Promote to `auth_required` while identity bootstrap finishes |
| `transitionTo` session patch | Profile label/metadata updates apply without no-op skip |
| `ProfileBoundAuthShell` fail-open | Spinner skipped when stored identity already known |
| Stall timeouts | Desktop 45s; bootstrap refresh deadline 20s |
| `desktop-profile-runtime` emit | Label change notifies binding owner |

**Evidence:** `pnpm verify:stability` green 2026-05-23; maintainer reports cold start → login stable.

## Workspace create/join gates (Path B — 2026-05-25)

| Surface | Gate |
|---------|------|
| Create dialog + `global-dialog-manager` | `assessWorkspaceCommunityTrust` — coordination + non–`public_default` relay |
| Invite accept (DM card) | `assessWorkspaceCommunityTrustAsync` |
| `GroupJoinDialog` + guest join on group home | `useWorkspaceCommunityTrustGate` + `assertWorkspaceCommunityJoinAllowed` |
| Coordination invite token redeem | `/invites/redeem` + `partitionInviteRelayHints` (DM vs workspace relays) |
| `?relays=` query + `obscur://group/...?relay=` deep links | Same partition; workspace hosts rejected without coordination |
| Deep link `processGroupLink` | `assessWorkspaceCommunityTrustAsync` before route success |

Policy: `community-trust-policy.ts` · hook: `use-workspace-community-trust-gate.ts` · redeem: `community-invite-redemption-policy.ts`.

**Operator setup wizard:** Settings → Relays → **Operator setup (private trust)** — device override for coordination URL + workspace relay (`operator-trust-config.ts`), probes `/health`, enables relay, sets coordination preferred.

**Desktop coordination E2E (2026-05-25 — environment, not release blocker for other work):**

| Evidence | Result |
|----------|--------|
| `curl http://127.0.0.1:8787/health` | `ok:true` (coordination worker OK) |
| Desktop app probe / membership POST | Unreachable from maintainer WebView (loopback); native HTTP + assume-local dev escape shipped |
| **Sign-off** | **G6-4 manual deferred** until a host where the **app** can POST to coordination (other PC, CI agent, browser dev at `:3340`, or staging VPS). **Does not block** DM, shell, Android prep, or automated contract tests. |
| **Production desktop** | TBD at release build; code path uses Tauri `plugin-http` + capability allowlist for `127.0.0.1` / `localhost` — verify on release candidate, not required to continue non-workspace development now. |

---

## v1.8.4 release (2026-05-27)

| Item | Status |
|------|--------|
| Public release | **v1.8.4** — skips unpublished v1.8.3 tag |
| Feature slice | REL-004 + invite DM + membership truth (from `7957492f`) |
| CI | `release:test-pack` Pass (`04d26c40`) |
| Tag | `v1.8.4` on `main` HEAD |
| GitHub Release | Create from tag + desktop installer |

## Next atomic step (active lane: **v1.8.5**)

**Canonical release train:** [v1.8.x-release-train.md](../program/v1.8.x-release-train.md)

1. **GitHub Release** — [v1.8.4-release.md](../releases/v1.8.4-release.md) + desktop artifact.
2. **Relay join after accept** — `Complete join on relay` retry loop (parked from soak).
3. **Membership read-model port** — complete T4-9 owner boundary across surfaces.
4. **`pnpm version:bump patch`** → **1.8.5** after tag.

### Prior program order (reference)

1. ~~**G6-1 manual**~~ — relay (P3-1…P3-5). **Signed off** 2026-05-22.
2. ~~**G6-2 manual**~~ — account sync idle-deferred (P3-6…P3-8). **Signed off** 2026-05-24.
3. ~~**G6-3**~~ — DM online soak (P2-1…P2-8). **Signed off** 2026-05-24 (maintainer: DM working).
4. **G6-4 manual** — **Deferred** (communities blocked without relay + manual two-client host).
5. ~~**G6-5**~~ — experiment shell trim. **Shipped** 2026-05-25: `shouldDeferExperimentHeavyWork()` — online mode (`dev:desktop:online`) runs messaging/profile hydrate, groups live bus, nav warmup, route guards immediately; offline stub keeps 12s deferrals.
6. ~~**Lane K**~~ — **Shipped** 2026-05-26: `dm-controller` v2 `useRelayPoolRef`; `use-sealed-community` split into `sealed-community-relay-scope`, `join-request-storage`, `message-merge`, `relay-kinds`, `governance-session`, `relay-publish-retry`, `membership-state-patch` (hook ~3.2k → ~3.0k lines). Relay ingest `onEvent` remains in hook (tight ref coupling); extract only if soak shows churn.
7. ~~**Workspace membership (automated)**~~ — **Shipped** 2026-05-26: coordination worker `membership-directory` tests (mock D1); PWA publish/reconcile/trust/fetch/health in `test:community-invariants`; root `test:workspace-membership` + worker gate in `verify:phase3`. **Manual G6-4** still deferred for two-client roster sign-off.
8. ~~**Lane P1 (Android) pipeline**~~ — **Done** 2026-05-26: runbook, `verify:android-prerequisites`, debug APK build/install. **Functional QA deferred** to final wrap-up (mobile UI/UX only). Maintainer: desktop online soak (chats, DM, nav) **no** error boundary — Android emulator crash treated as wrap-up item, not desktop blocker.
9. **Workspace membership manual (K-M1…K-M2)** — After G6-4 P3-10…P3-12: two profiles, coordination running, [private-trust-local-setup.md](../assets/demo/private-trust-local-setup.md) + [v1.9.0 demo matrix](../assets/demo/v1.9.0/README.md). Optional: `pnpm dev:relay` + `ws://localhost:7000` for chat.

## DM thread empty after nav (2026-05-22)

| Fix | Effect |
|-----|--------|
| `chat-route-main-shell` keep-alive | MainShell stays mounted (hidden off `/`); thread state not torn down on sidebar nav |
| `use-conversation-messages` retry | Re-hydrate when chat route active, SQLite index rebuilt, or stale empty thread (native backoff) |
| Web sync seed | Instant chat-state messages before async hydrate on conversation switch |
| `dm-read-authority-contract` | Empty all sources → `none` / `all_sources_empty` (not fake empty projection) |
| Integration tests | `use-conversation-messages.integration.test.ts` bridges `getAllByIndex` mocks → `dbGetMessages` (native hydrate path); web persisted-repair cases stub indexed window + `requiresSqlitePersistence(false)` |
| Composer layout | `ChatRouteMainShell` flex height chain + `Composer`/`ChatHeader` `shrink-0` so input is not clipped below viewport |
| Render loop (2026-05-22) | `bindProfile` idempotent when `ready`; stable sidebar portal snapshot; removed debug `useConversationMessagesFixed` wrapper |
| **Window runtime binding owner** (2026-05-22) | `WindowRuntimeBindingOwner` mounts once in `AppProviders`; `useWindowRuntime` is read-only + actions (no per-consumer bind/sync effects). `scripts/verify-react-stability.mjs` in `pnpm verify:stability`. |

6. **Frozen:** remember-me / auto-unlock; auth UX Auth-UX-1+; K-M3…K-M6 and full community matrix until K-M1…K-M2 pass.

## Phase 3 (active) — Online modules (G6)

Canonical doc: [phase3-desktop-online-gate.md](../program/phase3-desktop-online-gate.md)

| Piece | Effect |
|-------|--------|
| `pnpm dev:desktop:online` | `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1` — real relay + account sync |
| `pnpm verify:phase3` | Phase 2 + transport/relay/coordination contract tests |
| G6 order | G6-1 relay → G6-2 account sync → G6-3 DM online → G6-4 coordination → G6-5 trim experiment deferrals |

## Session policy (2026-05-23) — native secure restore

**Decision:** Web passphrases/remember-me tokens stay **off**. Native desktop/mobile restores unlocked session from **OS secure storage** after refresh (no password in localStorage).

| Piece | Effect |
|-------|--------|
| `NATIVE_SECURE_SESSION_RESTORE_ENABLED` | Bootstrap + `SessionApi` keychain restore on native |
| `SESSION_CREDENTIAL_PERSISTENCE_ENABLED` | Still false — no web remember-me tokens |
| `use-conversation-messages` | Re-hydrate when index rebuilds / partial thread (one-sided messages) |

## Session policy (2026-05-24) — no web “remember me”

**Decision:** Obscur does **not** offer persisted login / “remember me.” Users enter credentials on every app open. UI: `AuthSessionPolicyNotice`; code: `session-credential-policy.ts`.

| Piece | Effect |
|-------|--------|
| `identity-persistence.ts` | Account record on device (Welcome back); unlock manual each open |
| Auto-unlock | Off (`auth-gateway`, `use-identity`, `session-api`) |
| Auth UI | Policy notice; no “Trust this device” checkbox |

**Auth overhaul:** Deferred to future versions — design only: [auth-ux-redesign-future.md](../program/auth-ux-redesign-future.md). No major auth refactors during Phase 1/2.

## G6 online modules (2026-05-23)

Flag: `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1` (use `pnpm dev:desktop:online`; **not** default in `tauri.conf`).

| Subsystem | When online flag set |
|-----------|----------------------|
| Relay pool | `FullRelayProvider` (background connect after shell ready) |
| Account sync + projection | Real rehydrate/bootstrap |
| Network | Full presence + requests inbox |
| DM transport owner | Enabled at unlock |
| Groups hydrate / live bus | Immediate when `EXPERIMENT_ONLINE=1`; 12s defer only in offline stub |
| Startup overlay / nav warmup | Still experiment-off |

**Still deferred:** community coordination HTTP, full experiment shell off.

## Gate before re-enabling online modules

Do **not** turn experiment shell relay/account-sync back on until all rows pass.

| # | Gate | Evidence |
|---|------|----------|
| G1 | Desktop cold start + sidebar nav stable (no freeze/crash) | Manual + S0 prod baseline |
| G2 | Native startup IPC clean (`profile_binding_refresh` low ms) | DevTools event + window paints before refresh |
| G3 | Settings N5 panels render without JSX artifacts | Visual QA all tabs |
| G4 | `markRuntimeReady` never waits on relay/connecting | Code + runtime phase logs |
| G5 | Transport errors → `offline` / relay banner only; no provider throw | `enhanced-relay-pool`, `RelayProvider` experiment noop |
| G6 | Re-enable **one** online subsystem per flag (relay → account sync → coordination) | Subsystem checklist below |
| G7 | Android P1 signing runbook (when desktop gate passes) | Lane P1 doc |

**Online re-enable order (one flag at a time):**

1. Relay pool connect (background only; no startup gate).
2. Account sync / backup fetch (idle-deferred; never blocks unlock UI).
3. Community coordination HTTP (membership port; failures = transport/degraded UI only).
4. Full experiment shell off only after G1–G5 hold under each step.

**Invariant:** Local code owns UI truth; online failures surface as connection/degraded state, never as uncaught provider errors or startup block.

## Desktop startup IPC audit (2026-05-23)

| Finding | Severity | Action |
|---------|----------|--------|
| `migrate_legacy_webview_data` ran synchronously in `DesktopProfileState::new` | **Critical** | **Fixed** — `spawn_blocking` after boot |
| `block_on(reset_startup_window_bindings)` in Tauri `setup` | Medium | **Fixed** — async spawn |
| `persist_registry` on every profile snapshot / session resolve | Medium | **Fixed** — skip when binding unchanged |
| `setSnapshot` full JSON compare + always invalidate cache | Low | **Fixed** — profile-scoped diff |
| Sync `db_*` Tauri commands block IPC thread | Medium | Deferred — tombstone hydrate already idle-deferred in experiment shell |
| `ProtocolRuntime::new` + `DbState::open` in setup | Low | **Protocol lazy-init done**; `DbState::open` still at setup |

Fail-open boot (`DesktopProfileBootstrap`) unchanged: UI paints before `refresh()` completes.

## Do not

- Block desktop merges on Android smoke or store signing.
- Run **Android release APK** builds during active desktop development (use wrap-up cadence).
- Re-enable full online provider tree before offline native path is stable.
- Purchase or require commercial code-signing certificates.
- Resume relay/community patch loops as primary strategy.
- Start **auth UX overhaul** (Auth-UX-1+) before Phase 2 gate sign-off — see [auth-ux-redesign-future.md](../program/auth-ux-redesign-future.md).
- Treat Android emulator-only crashes as mandatory repro on desktop before shipping desktop fixes.
