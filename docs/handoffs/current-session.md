# Current Session Handoff — Obscur (v2 slim kernel + workspace kernel)

- Last Updated (UTC): 2026-06-11T22:10:00Z
- Session Status: **v1.9.5 active** — trust, anti-fraud/bot, internal security validation (blocks v2.0 prep)
- Last commit: `121b29e5` — SEC-B4 BOT-1 flood gate; **SEC-B band complete**

## Next Atomic Step

**v1.9.5 Phase A — SEC-R relay security band**

1. ~~v1.9.4 Phase C~~ **Done** — `release:test-pack` @ `7a49e339`; client community verified (NewTest 2).
2. ~~SEC-F1–F4~~ **Done** @ `02a7b847` — trust port, banner, settings copy, `verify:trust-v1.9.5`.
3. ~~SEC-B1–B4~~ **Done** @ `121b29e5` — inbound bot hardening, spam signals, pause UX, BOT-1 keyword flood gate.
4. **Implement** SEC-R1 → SEC-R4 (operator trust bundle, relay scorer tests, hardening doc, publish honesty).
5. **Run** [v1.9.5-security-validation-checklist.md](../program/v1.9.5-security-validation-checklist.md) §1–§6 at Phase C.
6. **Then** [v2.0-release-pipeline.md](../program/v2.0-release-pipeline.md) Phase 1.

**First code task:** `SEC-R1` — operator trust bundle audit per [v1.9.5-scope.md](../program/v1.9.5-scope.md).

## Workspace kernel W4 (landed)

- **Scope register** — `workspace-kernel-backup-restore-scope.ts` (included: room list, thread messages, group sqlite metadata; deferred: coordination directory + relay hints with user copy)
- **Backup-restore port** — delegates to Path B B4 `native-sqlite-backup-evidence` collectors/restorers
- **COM-BKP gate** — `workspace-kernel-com-bkp-gate.ts`
- **Settings copy** — `WorkspaceKernelBackupRestoreScopeNotice` in profile Account Sync panel
- Gate: `pnpm verify:workspace-kernel-w4` · `pnpm verify:workspace-kernel` chains W0→W4

## Decision (2026-06-10) — Workspace kernel strategy (accepted)

Community delivery **does not** continue by patching `features/groups/` parallel paths. New geometry: **workspace-kernel** — mirror dm-kernel (one port per lifecycle, subtraction before UI, COM-* proof gates).

Canonical: [workspace-kernel-manifest.md](../program/workspace-kernel-manifest.md)

| Kernel | Scope | Status |
|--------|-------|--------|
| **dm-kernel** | Native E2E DM | **Landed** — `pnpm verify:v2-slim` |
| **workspace-kernel** | Managed workspace only (Path B) | **W0–W4 complete** — `pnpm verify:workspace-kernel` |

**Public release:** DM-only OSS debut may precede workspace kernel completion; v2.0.0 must not claim full community UX until COM-MEM / COM-MSG gates pass.

## Decision (2026-06-09)

**Manual soak / visual testing stopped.** Progress = programmatic gates + subtraction only.

## Decision (2026-06-08) — Path B programmatic bands (complete)

**DM is sufficient for v2 slim;** legacy group send on non-kernel paths unchanged. Workspace-kernel W2 re-enabled native group send via write-port. Path B B0–B5 landed ([back-online-modular-roadmap-2026-06.md](../program/back-online-modular-roadmap-2026-06.md)) — coordination policy + wire honesty, **not** integrated community UX.

**Do not:** re-enable public-relay roster truth; local-first leave; patch hybrid roster merge on old paths (`rules/11`).

## Strategy

[obscur-v2-slim-kernel-manifest.md](../program/obscur-v2-slim-kernel-manifest.md) · [workspace-kernel-manifest.md](../program/workspace-kernel-manifest.md) · Performance: [obscur-v2-performance-optimization-plan.md](../program/obscur-v2-performance-optimization-plan.md)

| Tier | Status |
|------|--------|
| 0 — Hydrate quarantine | **Landed** |
| 1 — dm-kernel module | **Landed** |
| 2 — Static desktop default | **Landed** |
| 3 — Infra amputation | **Landed** |
| 4 — Programmatic gates only | **Landed** |
| 5 — Expansion (repair, groups, v2.0 prep) | **Active** |

## Programmatic gate (run before claiming progress)

```bash
pnpm verify:v2-slim
```

Includes: dm-kernel contracts, native quarantine, write-port, repair wiring, bidirectional gate unit tests, tier-4 exit contract, runtime-capture lib gates (`dm_kernel.write_probe`, `dm_kernel.one_sided_sqlite`, `dm_kernel.bidirectional`).

**Native CDP gate (unlock Tester1 in Tauri; requires Tester1↔Tester2 SQLite thread for bidirectional):**

```bash
export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"
pnpm dev:desktop:online
# unlock Tester1, then:
pnpm capture:runtime:dm-kernel
```

Skip bidirectional when no seeded thread: `OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL=1 pnpm capture:runtime:dm-kernel`

## Landed (Tier 4 — 2026-06-10)

- **Bidirectional gate** — `dm-kernel-bidirectional-gate.ts` + CDP capture + `dm_kernel.bidirectional` runtime-capture gate
- **Native hydrate subtraction** — `resolveDmThreadHistoryAdapter()` returns `dmKernelThreadHistoryStub` under dm-kernel (client gateway no longer routes native hydrate)
- **Transport repair contract** — CDP smoke for `forceNativeDmRelayBackfillSync` + `triggerMissedMessageSync`; tier-4 contract test on transport owner
- **tier-4-complete.contract.test.ts** — exit checklist encoded in vitest
- **Dev nav UX** (online only) — `shouldEnableNavigationProgressUx`, lazy routes in dev desktop, warmup on online

## Legacy hydrate files

Nine hydrate/projection files remain **`@deprecated` for web legacy** — native routing and client gateway no longer use them. Physical deletion is a **web cutover** task, not Tier 4.

## Landed (P0 perf — 2026-06-10)

- **`docs/handoffs/v2-perf-baseline.md`** — capture log + thresholds
- **`pnpm perf:v2:baseline:static`** — static export JSON at `docs/assets/perf/v2-static-prod.json`
- **S0 `--unlock` / `--rapid`** — Dev Lab build + Tester1 unlock + P2 rapid-nav gate in JSON (`v2PerfGate`)
- **`pnpm perf:v2:baseline:record`** — append row to handoff table from JSON

**First capture (2026-06-09):** static export unlocked + rapid — `v2PerfGate PASS` (median nav 108ms, max 411ms). See `docs/handoffs/v2-perf-baseline.md` + `docs/assets/perf/v2-static-prod.json`.

**Re-run:**

```bash
pnpm perf:v2:baseline:static -- --skip-build --unlock --rapid
pnpm perf:v2:baseline:record docs/assets/perf/v2-static-prod.json
```

## Landed (P2 — 2026-06-10)

- **MainShell unmount off `/`** — `ChatRouteMainShell` returns `null` on sidebar routes (subtracts ~4k-line hook fan-out); DM state via MessagingProvider + dm-kernel re-hydrate on return
- **Single warm-up owner** — `navigation-warmup-owner.ts` extracted from `app-shell.tsx`
- **`verify:p2-navigation`** — contract test + coordinator + chat-route tests
- **Post-P2 capture:** median 106ms, rapid gate pass, `verify:p2-navigation` + `v2PerfGate` green — see `v2-perf-baseline.md` row `2026-06-09 14:43:54`

## Landed (P2 dev compare — 2026-06-09)

- **`pnpm perf:v2:baseline:dev-webpack`** + **`pnpm perf:v2:baseline:compare`** — dev vs static artifacts
- **Cold dev** (first compile): median 1796ms → **`toolchain`** (settings 1819→50ms = compile)
- **Warm dev** (canonical): median **152ms** vs static **106ms** → **`acceptable`** (1.43×); `v2PerfGate` PASS — see compare row `2026-06-09 15:11:18`
- **Perf gates:** static `out/` for regression; warm dev compare confirms architecture is not the bottleneck

## Landed (P3 — 2026-06-10)

- **Invoke audit** — `dm-kernel-invoke-audit.ts` (`evaluateDmKernelThreadOpenBudget`: ≤1 initial `db_get_messages` per conversation)
- **Session thread cache** — `dm-kernel-thread-session-cache.ts` + port integration (P2 MainShell remount without duplicate SQLite read; bus invalidates cache)
- **Sidebar audit** — `loadDmKernelSidebar` records `conversations` invokes
- **`pnpm verify:p3-dm-kernel`** — contract + audit + thread-port tests (included in `verify:v2-slim`)

## Landed (P4 — 2026-06-10)

- **Hydrate tree-shake** — `resolve-dm-thread-history-adapter.ts` uses desktop build stub + dynamic `require` for web legacy only
- **ESLint P4 boundary** — runtime/main-shell/providers block legacy hydrate imports (fixed missing `files:` on gateway allowlist block)
- **`pnpm verify:p4-bundle`** — contract + quarantine + tier-4 tests
- **`pnpm perf:v2:release-budget`** — static reference vs candidate within 20% (`RELEASE_PERF_MAX_DELTA_RATIO=1.2`)

## DM proof gate (passed 2026-06-10)

Two desktop profiles; 10 messages each direction; full quit; relaunch; **both see all 20** — no silent shrink after load. Manual soak is no longer the progress gate; programmatic + CDP evidence only.

## Landed (P5 — 2026-06-10)

- **Cold-start repair** — `scheduleDmKernelColdStartRepair` + `DmKernelColdStartRepairOwner` (profile one-sided scan on unlock)
- **Post-repair reload** — `use-dm-kernel-thread` invalidates session cache + re-reads SQLite after relay backfill event
- **Group kernel port** — `dm-kernel-group-thread-port.ts` wired through `useGroupThreadMessages` + `group-adapter`
- **`pnpm verify:p5-expansion`** — P5 contract + cold-start + group Phase E

## Client verification ladder

| Tier | Gate | Status |
|------|------|--------|
| 1 | `pnpm verify:v2-exit` (programmatic + smoke) | **Done** |
| 2 | `pnpm dev:lab:native-gate` (in-app Tauri, no CDP) | **Done** |
| 3 | `pnpm verify:tier3` (= core benchmark 13/13 + cold-reload) | **Done** |
| 4 | Manual matrix (DM/auth/relay/UI; not §3 communities) / `pnpm verify:tier3:full` | Optional parallel |

## Path B — Band B0 (landed)

Workspace create/join gates: coordination configured + `/health` (production-strict) + relay tier ≠ `public_default` for `managed_workspace`.

```bash
pnpm verify:path-b-b0
```

**Manual K-M1/K-M2 matrix:** [apps/coordination/README.md](../../apps/coordination/README.md) § Path B local matrix.

## Path B — Band B1-1 (landed)

Coordination-only roster for `managed_workspace`: `mergeHybridMembershipTruthFallback` is a no-op; stale/missing directory → empty roster (no monotonic relay widen). Action/invite/display read models use coordination projection only.

```bash
pnpm verify:path-b-b1
```

Full membership band (worker + reconcile + sealed-community Path B): `pnpm verify:path-b-membership`

## Path B — Band B1-2 (landed)

Sealed-community relay ingest is **chat-only** for `managed_workspace`: subscription filters exclude roster/join/leave kinds; ingest ignores membership events. Roster authority stays on coordination directory (B1-1).

```bash
pnpm verify:path-b-b1-2
```

## Path B — Band B1-3 (landed)

Single `useSealedCommunity` instance policy: main shell owns sidebar group chat on `/`; group-home owns `/groups/[id]`; management dialog reuses `communityController` when provided. Relay ingest uses the same enable flag per surface.

```bash
pnpm verify:path-b-b1-3
```

## Path B — Band B1-4 (landed)

Worker steward ACL on membership delta append: self-attested join/leave; expel by bootstrap steward (first join at seq 1) only. Enforced in `membership-delta-acl.ts` before D1 insert (`403` on violation).

```bash
pnpm verify:path-b-b1-4
```

**Full Band B1 gate:** `pnpm verify:path-b-membership` (B1-1 → B1-4 + client reconcile).

## Path B — Band B1 complete

Bands B1-1 through B1-4 landed. Manual K-M1/K-M2 matrix remains optional maintainer smoke ([coordination README](../../apps/coordination/README.md) § Path B local matrix).

## Path B — Band B2-1 (landed)

Team relay transport publishes a signed `["EVENT", …]` wire via `publishToUrl` or returns an explicit failure — no optimistic `{ success: true }` without relay acknowledgment.

```bash
pnpm verify:path-b-b2-1
```

Full B2 band (includes relay list alignment): `pnpm verify:path-b-b2`

## Path B — Band B2-2 (landed)

`invite-manager.ts` reads enabled relays via `loadEnabledRelayUrlsForIdentity` — same v2-first / v1-fallback storage as `use-relay-list` (coordination invite create + connection request publish).

```bash
pnpm verify:path-b-b2-2
```

## Path B — Band B2-3 (landed)

Raw REQ/CLOSE removed from `group-management-dialog.tsx`. Ephemeral kind-0 profile fetch lives in `useCommunityMemberDisplayNames` (scoped subscribe + CLOSE on unmount).

```bash
pnpm verify:path-b-b2-3
```

**Full Band B2 gate:** `pnpm verify:path-b-b2` (B2-1 → B2-3).

## Path B — Band B2 complete

Wire honesty bands B2-1 through B2-3 landed.

## Path B — Band B3-1 (landed)

One canonical group message send path: **`use-chat-actions`** (`GroupService.sendSealedMessage` → `publishGroupEvent` → `commitSealedGroupMessages` → `messageBus`). `use-sealed-community.sendMessage` remains a no-op.

```bash
pnpm verify:path-b-b3-1
```

Full B3 band: `pnpm verify:path-b-b3`

## Path B — Band B3-2 (landed)

`commitSealedGroupMessages` is awaited with pending-write tracking; profile slot resolves via `resolveSealedGroupPersistenceProfileId` (`readActiveDesktopProfileId` on native). Callers (e.g. `use-chat-actions`) no longer pass `profileId`.

```bash
pnpm verify:path-b-b3-2
```

Full B3 band: `pnpm verify:path-b-b3`

## Path B — Band B3-3 (landed)

Group hydrate scans SQLite across all account profile slots (`listAccountSharedSqliteProfileIds` + `mergeGroupMessageRecordsForPage`). `loadPersistedSealedGroupMessages` passes `resolveSealedGroupPersistenceProfileId` into the thread-history read path for cold-start bodies.

```bash
pnpm verify:path-b-b3-3
```

## Path B — Band B3 complete

Bands B3-1 through B3-3 landed (canonical send, awaited commit + profile slot, multi-slot hydrate).

```bash
pnpm verify:path-b-b3
```

**Note:** `GROUP_MESSAGING_STUB_MESSAGE` remains in dev-lab surfaces only; Tier 4 §3 community matrix may proceed when maintainer chooses.

## Path B — Band B4 (landed)

**B4-1:** Native backup publish attaches `nativeSqliteEvidence` (SQLite-derived DM/group rows via `collectNativeSqliteBackupEvidence`).  
**B4-2:** Restore materializes `createdGroups` into `community-group-sqlite-store` and replays sqlite evidence via `applyNativeRestoreSqliteMaterialization`.

```bash
pnpm verify:path-b-b4
```

## Path B — Band B5 (landed)

**B5-1:** Thread chrome uses recipient-only `StrangerWarningBanner` via `shouldShowPathBThreadWarningBanner` in `chat-view.tsx`.  
**B5-2:** DM receive pipeline routes incoming connection requests through `evaluatePathBIncomingDmSafetyGate` (rate + M10 strict mode).  
**B5-3:** Request transport `sendRequest` checks `evaluatePathBConnectionRequestEconomicsGate` before publish.

```bash
pnpm verify:path-b-b5
pnpm verify:p5-safety
pnpm verify:path-b
```

## Path B complete

Bands B0–B5 landed. Community restart Path B execution order satisfied; Tier 4 §3 community matrix may proceed when maintainer chooses.

## Next atomic step

Path B community restart is complete. Choose next expansion track from [v1.9.x-execution-contract.md](../program/v1.9.x-execution-contract.md) or performance work ([obscur-v2-performance-optimization-plan.md](../program/obscur-v2-performance-optimization-plan.md)).

## Tier 2 (native in-app gate) — no CDP

WebView2 remote debugging is **not required**. Tauri loads at `http://127.0.0.1:<port>/` (e.g. `1430`) — CDP attach was infeasible on this machine.

```bash
# terminal A — keep running
pnpm dev:lab:native-gate

# terminal B
pnpm dev:desktop:online
# unlock Tester1 — gate auto-runs when shell + messaging are ready
```

Alias: `pnpm capture:runtime:dm-kernel` (same listener). Report: `test-results/dev-lab-native-gate/native-gate-latest.json`.

Optional: `await obscurDevLab.runNativeGate()` in app console after listener is up.

CDP scenarios (`--cdp`) remain for machines where WebView2 debugging works; not a daily gate.

## Tier 3 (dev-lab benchmark)

Requires **online** static shell (`experimentOnline: true` in `apps/pwa/out/obscur-shell-manifest.json`).

```bash
pnpm dev:desktop:online -- --rebuild   # once after UI/dev-lab changes
pnpm verify:tier3                      # 13/13 core + cold-reload
pnpm verify:tier3:full               # optional extended suite
```

**Landed (2026-06-10):** settings-route shell health probe (fixes false `shell_not_unlocked` on `/settings`); benchmark waits for messaging bridge; online-shell manifest check for core/full.

## Desktop dev

```bash
taskkill //F //IM obscur_desktop_app.exe
pnpm dev:desktop              # offline UI stub (no relay stack)
pnpm dev:desktop:online       # default online dev: static shell + coordination + relay (smooth nav)
pnpm dev:desktop:online:live  # webpack HMR + online stack (slow nav; UI edit loop only)
```

## Do not

- Manual A/B soak as progress gate
- Patch hydrate merge rules on native
- Re-enable `nativeDmThreadHistoryAdapter` under dm-kernel authority
- Re-enable group send by deleting the stub alone (requires workspace-kernel W2 + COM-MSG)
- Patch community roster / leave / message bugs on `use-sealed-community` or `group-provider` when workspace-kernel is the strategy (W0+)
- Sovereign-room / Test-10-class debugging as community progress gate — use managed workspace + COM-* gates only
