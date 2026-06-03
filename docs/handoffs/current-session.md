# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-01T18:30:00Z
- Session Status: **M4 retention sweep + N6 prod baseline** — self-cleaning local indexes; S0 perf artifact
- Active Owner: Maintainer

## Delivery order (maintainer policy, 2026-06-01)

**Implement broader functionality first; manual testing in batches later** — not incremental gates between slices.

| Phase | Now | Gate |
|-------|-----|------|
| **1 — Implement** | Active | Vitest, typecheck, `release:test-pack` |
| **2 — Manual batch** | Deferred | [deferred-manual-verification-checklist.md](../program/deferred-manual-verification-checklist.md), demo matrices |
| **3 — Tag** | When chosen | Optional Pass columns before user-visible release |

Canonical: [v1.8.x-batch-implementation-lane.md](../program/v1.8.x-batch-implementation-lane.md).

## Public posture (maintainer policy)

- **Repo:** Public for **technical trust** — inspectable code, reproducible install, honest `/docs` — not for marketing yet.
- **Promotion:** Deferred until **after v2.0.0**; first publicly *demonstrated* release should be polished enough to impress.
- **Until then:** Underground (maintainer-led); continue **v1.8.x → v1.9.x → v2.0.0** per [v1.8.x-release-train](../program/v1.8.x-release-train.md) and [obscur-2.0-milestone-roadmap](../program/obscur-2.0-milestone-roadmap.md) — no outreach push.

## Active objective

**Primary lane:** [v1.8.x-batch-implementation-lane.md](../program/v1.8.x-batch-implementation-lane.md) (implement) + [v1.9.0-kernel-backend-roadmap.md](../program/v1.9.0-kernel-backend-roadmap.md) (Lane **K** backlog)  
**Policy:** [maintainer-distribution-policy.md](../program/maintainer-distribution-policy.md) — ZIP/clone OK; **no** version bump for CI; **no** routine Full Release.

| Priority | Tangible deliverable | Status |
|----------|----------------------|--------|
| **1** | **v1.8.14 batch land** — P13/P14, B2, Wave 3 trust, nav perf, N5 settings split | **Landed** — `341d1515` on `main` 2026-06-01 |
| **2** | **v1.9 B4 (R1/R2)** — DM materialization port + monotonic roster read model | **Done** (engineering) — main-shell R2 count fix 2026-06-01 |
| **3** | **N-series / broader perf** — N4/N5/N6 done; M3/M4 cache + retention | **M4 done** — idle vault/tombstone sweep |
| **—** | **Manual verification** (K-M, G6-4, deferred checklist) | **Batched** — not between implementation slices |
| **—** | GitHub Releases | **Hidden** on repo home (About → gear); not version truth |

**Next atomic step:** Manual mobile soak batch (deferred checklist §5), or v1.9 **K** backlog slice.

## Performance gate (2026-06-03)

**Manual sign-off:** Rapid-nav gate **Pass 2026-06-01** (10 fast sidebar switches + Settings pause; multi-window acceptable per maintainer).

**Durable contract:** [`docs/program/navigation-performance-contract.md`](../program/navigation-performance-contract.md) — owner map, forbidden patterns, manual gate, N-series backlog. Agents must read this before navigation-adjacent changes; tests are CI checkpoints only.

| Piece | Effect |
|-------|--------|
| `navigation-performance-contract.md` | Single source of truth for nav perf (not handoff/chat memory) |
| `rules/13-navigation-performance.md` + `.cursor/rules/obscur-navigation-performance.mdc` | Agent policy + file-scoped Cursor rule |
| `navigation-chunk-load-authority.ts` | Dev console warning if full chunk load bypasses warm-up authority |
| `use-network-request-transport.ts` | N3 — network/invites use runtime DM owner (removed 3 duplicate controllers) |
| `intelligent-navigation-warmup-runner.ts` | All warm-up phases run sequentially during idle — no parallel chunk imports |
| `route-navigation-warmup.ts` | Hover/intent uses shell-only prefetch; full chunk load only after quiescence |
| `app-shell.tsx` | Warm-up deferred until quiescent; rapid-nav suppresses chunk work; experiment shell disables transition overlay + mount probes |
| `experiment-shell-policy.ts` | `shouldRunNavigationInstrumentation()` — off for all desktop experiment builds |
| `relay-transport-bootstrap-policy.ts` + `relay-provider.tsx` | 5s relay connect delay on secondary windows vs 1.5s primary |
| `secondary-profile-window-reload-scheduler.ts` | Post-login DM soft refresh deferred to 8s + `requestIdleCallback` |
| `secondary-profile-dm-soft-refresh.ts` | SQLite chat-state scan limited to current `profileId` only |
| `use-account-sync.ts` | Skip redundant `startup_fast_follow` restore when projection already bootstrapped |

**Evidence:** `pnpm -C apps/pwa exec vitest run app/components/navigation-performance-coordinator.test.ts app/components/route-navigation-warmup.test.ts app/components/app-shell.test.tsx app/features/runtime/relay-transport-bootstrap-policy.test.ts app/features/runtime/services/secondary-profile-dm-soft-refresh.test.ts app/features/runtime/services/secondary-profile-window-reload-scheduler.test.ts`

**Remaining (broader v1.9.0 perf lane):** mobile 4GB manual soak (deferred checklist §5); full S0 nav matrix re-run after unlock seed.

## M4 self-cleaning retention (2026-06-03)

| Piece | Effect |
|-------|--------|
| `self-cleaning-retention-sweep-policy.ts` | Vault index cap (2k) + 90d age; tombstone TTL re-exports |
| `self-cleaning-retention-sweep.ts` | Idle orchestrator — vault prune + tombstone sweep |
| `local-media-store.ts` | `pruneLocalMediaIndexRetention()` profile-scoped |
| `message-delete-tombstone-store.ts` | `sweepMessageDeleteTombstones()` compacts raw storage |
| `profile-runtime-provider.tsx` | Schedules sweep 8s after profile bootstrap |
| `storage-health-service.ts` | Manual recovery runs retention sweep |

**Evidence:** `pnpm -C apps/pwa exec vitest run app/features/runtime/services/self-cleaning-retention-sweep-policy.test.ts app/features/messaging/services/message-delete-tombstone-store.test.ts app/features/messaging/services/storage-health-service.test.ts`

## N6 prod S0 baseline (2026-06-03)

| Piece | Effect |
|-------|--------|
| `docs/assets/perf/s0-prod.json` | Cold-start DOM **126ms** on static `apps/pwa/out` (2026-06-03) |
| `obscur-shell-perf-baseline.mjs` | Windows fix — serve relative path `apps/pwa/out` (spaces in repo path) |

Nav matrix skipped (`shellPhase: timeout`) — harness needs unlocked session; re-run after profile seed per [obscur-shell-perf-baseline-s0.md](../program/obscur-shell-perf-baseline-s0.md).

**Evidence:** `pnpm perf:shell:s0:prod -- --skip-build`

## N5 settings chunk split (2026-06-03)

| Piece | Effect |
|-------|--------|
| `settings-tab-panel-shared.tsx` | Lightweight UI helpers + constants (no provider hooks) |
| `settings-tab-panel-model-context.tsx` | Context + `useSettingsTabPanelModel` only |
| `settings-tab-panel-model-provider.tsx` | Heavy provider — lazy via `dynamic()` in loader |
| `settings-tab-panel-loader.tsx` | Per-tab `dynamic()` panels + lazy model provider wrapper |
| `settings-tab-panel-model.ts` | Barrel re-exports shared + context (safe sync import) |

Settings route entry no longer sync-parses the ~2.5k-line monolith. **N5 (2026-06-01):** per-tab model hooks in `settings-tab-panel-models/` — loader dynamic-imports only the active tab's provider chunk.

**Evidence:** `pnpm -C apps/pwa exec vitest run app/settings/settings-page-shell.test.tsx app/settings/components/settings-tab-panel-loader.test.tsx app/features/groups/services/community-leave-path-audit.test.ts`

**Distribution:** [unified-version-source.md](../program/unified-version-source.md) — `version.json` + repo channel on **`main`**. GitHub Releases are legacy noise only.

## Wave 4 progress (P14 — 2026-06-02)

| Piece | Effect |
|-------|--------|
| `settings-page-shell.tsx` | Mobile menu ↔ panel flow with single scroll owner (`mobile-scroll-region`), `PageShell.containScroll` on compact layout, `?tab=` URL sync on open/back |
| `page-shell.tsx` | Optional `containScroll` prop — defers vertical scroll to child regions on mobile settings |
| `settings-page-shell.test.tsx` | Menu scroll region, panel navigation, back control, and `?tab=` deep-link regressions |
| `network-dashboard.tsx` | Compact mobile tab rail switched from horizontal strip to 3-column grid pills with short labels (`All`, `Groups`, `Discover`, `Invites`, `Blocked`, `Manage`) and badge positioning tuned for narrow widths |
| `network-dashboard.test.tsx` | Added compact-layout regression coverage for mobile tab switching + discovery/invitations visibility |
| `vault-media-grid.tsx` | Compact filter rail (`mobile-scroll-region`), 44px-class chips/buttons, larger tile menus, wrapped preview toolbar |
| `vault-page-client.tsx` | `containScroll` + dedicated grid scroll region; header actions bumped to 44px on compact |
| `vault-media-grid.test.tsx` / `vault-page-client.test.tsx` | Compact touch-target + scroll-region regressions |

**Evidence:** `pnpm -C apps/pwa exec vitest run app/settings/settings-page-shell.test.tsx app/features/network/components/network-dashboard.test.tsx app/features/vault/components/vault-media-grid.test.tsx app/vault/vault-page-client.test.tsx`

## iPad / tablet layout (2026-06-02)

| Piece | Effect |
|-------|--------|
| `use-secondary-page-layout-tier.ts` | Phone (&lt;640px), tablet (640–1023px), desktop tiers — mobile shell iPad no longer forced into phone-compact |
| `network-dashboard.tsx` | Tablet: horizontal tab rail, `max-w-3xl` content, 2-col connection list |
| `settings-page-shell.tsx` | Tablet uses split nav (tier-based), not `md:` breakpoint alone |
| `group-home-page-client.tsx` | Tablet: `max-w-3xl`, tighter spacing, 2-col bento grid |
| `community-invite-*-card.tsx` | Thread/historical cards capped at 320px on tablet (not full-bleed) |

**Evidence:** `pnpm -C apps/pwa exec vitest run app/features/runtime/use-secondary-page-layout-tier.test.ts`

## Batch exit prep (v1.8.14 — 2026-05-29)

| Piece | Effect |
|-------|--------|
| `pnpm version:bump patch` | Workspace **1.8.14** (Tauri + Android versionCode 10814) |
| `v1.8.14-scope.md` / `v1.8.14-gate.md` | Batch exit scope: P13 + B2 + Wave 3 + carried R13 |
| `CHANGELOG.md` | Unreleased v1.8.14 section |
| Release train + batch lane | Batch exit **ready to tag** |

**Evidence:** `pnpm version:check`, `pnpm release:test-pack -- --skip-preflight` (run before push/tag).

## Recently shipped (Wave 3 MEM-005 — 2026-05-29)

| Piece | Effect |
|-------|--------|
| `group-invite-terminal` bus event | Inviter hears declined/canceled invite responses via profile bus |
| `community-invite-terminal-membership.ts` | Persists terminal left evidence and removes peer from relay-joined roster |
| `group-provider.tsx` | `handleInviteTerminalDetail` clears member lists, roster projection, known-participants directory |
| `incoming-dm-event-handler.ts` + `community-invite-card.tsx` | Dispatch terminal bus event on declined/canceled DM response and inviter cancel |
| `community-membership-ledger.ts` | Bootstrap restore may seed legacy key (REL-003 regression fix for fresh-device rebind) |

**Evidence:** `community-invite-terminal-membership.test.ts`, `group-provider.test.tsx` (MEM-005), `incoming-dm-event-handler.test.ts`, `community-membership-ledger.test.ts` (bootstrap legacy seed).

## Recently shipped (Wave 3 MEM-002 — 2026-05-29)

| Piece | Effect |
|-------|--------|
| `use-community-membership-read-model-index.ts` | Loads terminal left/expelled cache per group; auto-enables terminal exclusions so Network group cards match chat shell / management modal counts |
| Window listeners | Filter ledger/chat-state/terminal refresh events by `profileId` |

**Evidence:** `use-community-membership-read-model-index.test.tsx` (MEM-002).

**Do not publish `v1.8.12` tag** (void). Production GitHub Release remains **v1.8.11** until a batch exit tag (e.g. **v1.8.14** after P13 + B2).

## Recently shipped (Wave 3 REL-004 — 2026-05-29)

| Piece | Effect |
|-------|--------|
| Leave outbox (existing) | Durable pending/rate_limited/rejected items; background retry via `community-leave-outbox-retry.ts` |
| `community-leave-path-audit.test.ts` | Audit target: `settings-tab-panel-model-provider.tsx` (bulk-leave owner) |
| `community-leave-durability.test.ts` | AB-05 TODO replaced with real outbox + rate-limit regression |

**Canonical paths verified:** `GroupProvider.leaveGroup`, `removeGroupConversation`, `use-sealed-community` leave, settings bulk-leave — all enqueue outbox before relay publish.

**Evidence:** `community-leave-outbox.test.ts`, `community-leave-path-audit.test.ts`, `community-leave-durability.test.ts`, `community-leave-outbox-retry.test.ts`.

## Recently shipped (Wave 3 REL-003 — 2026-05-29)

| Piece | Effect |
|-------|--------|
| `community-membership-ledger.ts` | Named profiles no longer **seed** the shared legacy localStorage key on first save — prevents default profile from inheriting another profile's joined communities |
| Tests | `community-membership-ledger.test.ts`, `community-scope-isolation.test.ts`, existing `group-provider.test.tsx` REL-003 |

**Remaining REL-003 vectors (deferred):** in-memory invite snapshot cache (`community-invite-message-snapshot.ts`), `community-sync-service` sync state keyed by community only, window listeners in membership read-model hooks without `profileId` filter.

**Evidence:** Vitest REL-003 + AB-08 suites green.

## Recently shipped (P13 chat-thread polish — 2026-05-29)

| Piece | Effect |
|-------|--------|
| `conversation-row.tsx` | Timestamp vertically centered beside full name + preview block |
| `format-conversation-message-preview.ts` | Direction-aware invitation previews (`"X sent you an invitation"`, `"You accepted the invitation"`) |
| `composer.tsx` | Removed amber relay queue / cooling-down footer banners |
| `account-sync-ui-policy.ts` | `isAccountDataLoading()` / `isAccountProjectionStillLoading()` |
| `main-shell.tsx` + `mobile-shell-status-items.ts` | `suppressAccountLoadingNotices` hides restore/sync/relay strip items during account load (scope mismatch still shown) |
| `message-list.tsx` + `message-list-touch.ts` | Mobile action dock below bubble; sustained touch (~420ms) shows dock like hover |
| DM hydrate repair (PWA) | Outgoing repair + chat-state gap merge attempted — **maintainer accepted one-sided history as limitation** (DM-001); do not iterate unless reopened |

**Evidence:** `format-conversation-message-preview.test.ts`, `conversation-row.test.tsx`, `mobile-shell-status-items.test.ts`, `mobile-shell-status-strip.test.tsx`, `message-list-touch.test.ts`, `account-sync-ui-policy.test.ts`, focused Vitest (74 tests) green.

**Dev loop:** `pnpm dev:mobile-shell:online` → hard refresh at `http://127.0.0.1:3340`.

## Recently shipped (Wave 2 B2 — inbound community bots)

| ID | Status |
|----|--------|
| B2-1 | **Done** — `botTriggers` descriptor contract (`dweb-core` + PWA policy) |
| B2-2 | **Done** — `scripts/community-inbound-bot.mjs` + crypto decrypt tests |
| B2-3 | **Done** — Steward UX enable/disable triggers per bot |
| B2-4 | **Done** — Runbook + rate-limit copy in `docs/messaging/community-inbound-bot.md` |

**Manual deferred:** deferred checklist §3 B-02 (inbound keyword soak).

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

## v1.8.5 release (2026-05-27)

| Item | Status |
|------|--------|
| Tag `v1.8.5` | At `main` HEAD — includes CI fixes + Lane T slice |
| `v1.8.4` tag | Points at older commit — **no** GitHub Release; superseded |
| CI | `docs-check` + `release:test-pack` green |
| GitHub Release | Triggered by `git push origin v1.8.5` → [release.yml](../../.github/workflows/release.yml) |

## v1.8.6 completed (2026-05-28)

| Slice | Status |
|-------|--------|
| T6-1/T6-2 relay join owner | **Implemented** — `community-invite-relay-join.ts` + invite-card retry owner path (`handleRelayJoinRetry`) with deterministic terminal states/copy; remaining validation is environment-bound manual soak |
| T6-3/T6-4 membership read-model | **Implemented** — canonical owner path wired across participants/network/invite/header surfaces (`use-community-membership-read-model-index`, header count wiring); targeted tests/grep complete |
| T6-5 transport evidence lane (CI) | **Implemented** — `scripts/relay-runtime-smoke.mjs` + reliability/release workflows include `relay runtime smoke` gate against `nostr-rs-relay` service container |
| Release | **Published** — tag `v1.8.6` and GitHub release completed |

## v1.8.7 completed (2026-05-29)

| Slice | Status |
|-------|--------|
| T7-1 transport-hard relay/join evidence | **Implemented** — expanded invite relay-join tests (`community-invite-relay-join.test.ts`) for transient retry and deterministic terminal state coverage |
| T7-2 membership surface consistency assertions | **Implemented** — expanded tests on invite gating, network dashboard member count sourcing, and chat view -> header member-count forwarding |
| T7-3 docs/evidence packet alignment | **Implemented** — `v1.8.7` scope/gate/demo docs plus release-train sync landed |
| Release | **Published** — tag `v1.8.7` and GitHub release completed |

## v1.8.8 ready to tag (2026-05-29)

| Slice | Status |
|-------|--------|
| T8-1 confidence carry-forward | **Done** — automated gates green |
| T8-2 manual Test 8 (managed workspace) | **Done** — A/B invite → accept → sealed chat; restart history; header metadata |
| T8-3 continuity docs | **Done** — scope, gate, demo, [v1.8.8 release notes](../releases/v1.8.8-release.md), [v1.8.9+ roadmap](../program/v1.8.9-plus-managed-workspace-roadmap.md) |
| Version on `main` | **1.8.8** |

### Product fixes landed this band (beyond T8 docs)

| Area | Effect |
|------|--------|
| Relay dev | Open relay whitelist in `infra/nostr/nostr-rs-relay.toml`; loopback WS + publish fallback |
| Group persistence | `loadPersistedSealedGroupMessages` on chat open; persist on send/receive |
| Chat header | Members · online · last activity; CRDT-first count + terminal membership listener |
| Leave / roster | Terminal cache events; participants LEFT/EXCLUDED; merge fixes in group-provider |

## Next atomic step — tag **v1.8.8**

**Gate:** [v1.8.8-gate.md](../releases/v1.8.8-gate.md) · **Release notes:** [v1.8.8-release.md](../releases/v1.8.8-release.md)

1. Reconfirm on clean `main`: `pnpm -C apps/pwa typecheck`, `pnpm docs:check`, `pnpm release:test-pack -- --skip-preflight`, `pnpm version:check`.
2. Confirm CI `reliability-gates` green on HEAD.
3. Commit doc updates if needed (`CHANGELOG.md`, `README.md`, `docs/releases/v1.8.8-release.md`).
4. `git tag v1.8.8` && `git push origin v1.8.8` → GitHub Release.

**After tag:** [v1.8.9+ managed workspace](../program/v1.8.9-plus-managed-workspace-roadmap.md) — operator-relay deletion, group bots.

### Prior program order (reference)

1. ~~**G6-1 manual**~~ — relay (P3-1…P3-5). **Signed off** 2026-05-22.
2. ~~**G6-2 manual**~~ — account sync idle-deferred (P3-6…P3-8). **Signed off** 2026-05-24.
3. ~~**G6-3**~~ — DM online soak (P2-1…P2-8). **Signed off** 2026-05-24 (maintainer: DM working).
4. **G6-4 manual** — **Deferred** (communities blocked without relay + manual two-client host).
5. ~~**G6-5**~~ — experiment shell trim. **Shipped** 2026-05-25: `shouldDeferExperimentHeavyWork()` — online mode (`dev:desktop:online`) runs messaging/profile hydrate, groups live bus, nav warmup, route guards immediately; offline stub keeps 12s deferrals.
6. ~~**Lane K**~~ — **Shipped** 2026-05-26: `dm-controller` v2 `useRelayPoolRef`; `use-sealed-community` split into `sealed-community-relay-scope`, `join-request-storage`, `message-merge`, `relay-kinds`, `governance-session`, `relay-publish-retry`, `membership-state-patch` (hook ~3.2k → ~3.0k lines). Relay ingest `onEvent` remains in hook (tight ref coupling); extract only if soak shows churn.
7. ~~**Workspace membership (automated)**~~ — **Shipped** 2026-05-26: coordination worker `membership-directory` tests (mock D1); PWA publish/reconcile/trust/fetch/health in `test:community-invariants`; root `test:workspace-membership` + worker gate in `verify:phase3`. **Manual G6-4** still deferred for two-client roster sign-off.
8. ~~**Lane P1 (Android) pipeline**~~ — **Done** 2026-05-26: runbook, `verify:android-prerequisites`, debug APK build/install. **Functional QA deferred** to final wrap-up (mobile UI/UX only). Maintainer: desktop online soak (chats, DM, nav) **no** error boundary — Android emulator crash treated as wrap-up item, not desktop blocker.
9. **Workspace membership manual (K-M1…K-M2)** — **Deferred 2026-06-01** (maintainer skip). Runbook: [private-trust-local-setup.md](../assets/demo/private-trust-local-setup.md) + [v1.9.0 demo matrix](../assets/demo/v1.9.0/README.md).

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

6. **Frozen (implementation):** remember-me / auto-unlock; auth UX Auth-UX-1+. **Manual only (batched):** K-M1…K-M6, G6-4 soak — not incremental gates between code rows.

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

**Desktop window boot (2026-05-29):** Owner `desktop-window-boot.ts` — marks `__obscurBootReady` immediately on native; never blocks React on `resolveNativeWindowLabel` / `refresh()`. `DesktopProfileBootstrap` is a thin shell. Contract: [production-surfaces.md](../architecture/production-surfaces.md).

**Profile backup on auth (2026-05-29):** Auth surfaces must not use blocking Radix modals. `useUnifiedImportFlow` defaults to **inline** preflight when `publicKeyHex` is null (Welcome Back / restore / login). `AuthScreenRestoreBanner` wired on login Import Key tab; account conflict + archive export use inline panels inside the auth card. Fixed `ProfileArchiveResultDialog` content `z-[100]` under overlay `z-[200]` (invisible trap). Closed import preflight on hook unmount; dialogs return `null` when `!isOpen`. Post-unlock resume still uses modal via `PendingProfileImportResume`.

## Do not

- Block desktop merges on Android smoke or store signing.
- Run **Android release APK** builds during active desktop development (use wrap-up cadence).
- Re-enable full online provider tree before offline native path is stable.
- Purchase or require commercial code-signing certificates.
- Resume relay/community patch loops as primary strategy.
- Start **auth UX overhaul** (Auth-UX-1+) before Phase 2 gate sign-off — see [auth-ux-redesign-future.md](../program/auth-ux-redesign-future.md).
- Treat Android emulator-only crashes as mandatory repro on desktop before shipping desktop fixes.
