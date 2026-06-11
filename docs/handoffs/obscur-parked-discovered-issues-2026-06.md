# Obscur — Parked state & discovered issues (2026-06)

**Status:** Project **paused** by maintainer (mental health / scope). Do not treat active development as in progress.  
**Recorded:** 2026-06-01 (session arc: Dev Lab, handoff gate, DM restart, feasibility review)  
**Parent:** [current-session.md](./current-session.md) · [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md) · [v1.5.0-architecture-refactor-queue.md](../program/v1.5.0-architecture-refactor-queue.md)

---

## Executive summary

Obscur accumulated **vision-scale surface area** (native DM, projection, groups, relay, sync, dev-lab, manual matrix) while **R1 message materialization was never closed**. Solo + AI-assisted “vibe coding” added interim layers (hydrate authority, thread-history kernel, dev-lab scenarios) **without deleting parallel truth owners**. Result:

- **Groups:** backend deliberately stubbed; UI shells remain.
- **DM:** unreliable after desktop restart/reload — one-sided history, console SQLite errors, hydrate replaces full thread with partial SQLite.
- **Gates:** often green while desktop runtime fails (mocked native, browser-only dev-lab).
- **Docs:** describe targets and “landed phases” that exceed runtime truth.

**Conclusion (maintainer):** Not feasible to complete Obscur at current scope with indie + AI workflow without enterprise-style subtraction, reviewers, and native runtime gates. Park until a future attempt with smaller scope and enforced single owners.

---

## 1. Architecture & process (root causes)

### ARCH-PARK-001 — R1 never exited (DM multiplicity)

| Field | Detail |
|-------|--------|
| **Spec** | [v1.5.0-architecture-refactor-queue.md](../program/v1.5.0-architecture-refactor-queue.md) § R1; [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md) § Interim multiplicity |
| **Target** | One read model per `(profileId, conversationId)`; delete parallel assemblers |
| **Actual** | Six+ interim modules landed (“still not R1 exit”): `dm-read-authority-contract.ts`, `dm-conversation-hydrate-read-model.ts`, `dm-conversation-hydrate-pipeline.ts`, projection-live-merge, indexed-scan, sibling diagnostics |
| **Symptom** | Same DM bugs rediscovered every session; each fix adds merge branches instead of removing paths |
| **Status** | **Open** — structural blocker |

### ARCH-PARK-002 — Policy vs implementation (native SQLite)

| Field | Detail |
|-------|--------|
| **Spec** | [obscur-native-sqlite-policy.md](../program/obscur-native-sqlite-policy.md) — native DM read/write = SQLite only; chat-state not read authority |
| **Actual** | Hydrate still runs projection authority, chat-state fallback (web), direction-coverage reconcile, projection merge in `use-conversation-messages` |
| **Symptom** | Policy says one thing; runtime merges five layers |
| **Status** | **Open** |

### ARCH-PARK-003 — “Engineering exit” without runtime exit

| Field | Detail |
|-------|--------|
| **Evidence** | R0/R1 “engineering exit” in refactor queue; DM-001/MEM-001 deferred to manual matrix |
| **Symptom** | CI/gates pass; A/B restart soak still fails |
| **Status** | **Open** — gate design failure |

### ARCH-PARK-004 — Reverse iteration workflow

| Field | Detail |
|-------|--------|
| **Pattern** | Phases A–F (thread-history kernel), Dev Lab, fast lane added while groups subtracted and R1 open |
| **Symptom** | Fewer usable features per iteration (groups broken → DM broken) |
| **Status** | **Process** — freeze required before more feature work |

### ARCH-PARK-005 — AI / vibe-coding mismatch

| Field | Detail |
|-------|--------|
| **Limit** | AI strong at local patches; weak at multi-month “delete path X or no merge” enforcement |
| **Symptom** | Redundant unit tests (mocked `requiresSqlitePersistence`) green while Tauri invoke fails |
| **Status** | **Accepted** for future: native CDP gate + human reviewer |

---

## 2. DM & messaging (runtime)

### DM-PARK-001 — One-sided history after restart/reload (O-2 class)

| Field | Detail |
|-------|--------|
| **Symptom** | Tester1 (A) and Tester2 (B): after quit + relaunch, both see **only messages sent by A**. B may briefly show both sides; after hydrate loads, **B’s own messages disappear**. |
| **Repro** | Two desktop profiles (or A/B); exchange DMs; full process quit; relaunch; open same thread. |
| **Observed pattern** | Each profile’s SQLite tends toward **one direction only** (A: outgoing-only; B: incoming-only from A) when writes fail or merge loses direction |
| **Canonical owner (intended)** | Write: `message-persistence-service.ts` → `db_insert_message`. Read: `db_get_messages` via `dm-conversation-hydrate-indexed-scan.ts` |
| **Competing owners** | Account projection read cutover, `dm-read-authority-contract` merge rules, `dm-thread-read-model` direction reconcile, projection merge `useEffect`, live overlay |
| **Diagnostics** | `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity`; `messaging.conversation_history_authority_selected` |
| **Dev Lab** | `dm-reload-history` (browser reload on `:3340`); `dm-history-monotonic`; flaky in full `verify:handoff` benchmark (12/13) |
| **Matrix** | P4-3 native cold quit — [unified-verification-matrix.md](../program/unified-verification-matrix.md) |
| **Status** | **Broken** on desktop (maintainer-confirmed) |

### DM-PARK-002 — `db_insert_message not allowed. Command not found`

| Field | Detail |
|-------|--------|
| **Symptom** | Console: `[MessagePersistenceService] Failed to flush queued message operations: db_insert_message not allowed. Command not found` |
| **Surface** | Tauri desktop loading dev app (`:3340` in WebView); Next.js error overlay |
| **Root cause** | Rust registered `db_*` commands in `lib.rs` but **Tauri 2 capability allowlist** in `permissions/app.toml` did not include `allow-db-commands` until 2026-06 session |
| **Fix attempted** | `allow-db-commands` permission + `desktop.json` / `mobile.json` capabilities; `isTauri()` in `packages/db/src/client.ts` requires callable invoke |
| **Files** | `apps/desktop/src-tauri/permissions/app.toml`, `capabilities/desktop.json`, `packages/db/src/client.ts` |
| **Status** | **Fix landed in tree** — requires **desktop shell restart** to load capabilities; does not repair already-corrupt one-sided SQLite data |

### DM-PARK-003 — Hydrate intentionally drops direction (merge gap)

| Field | Detail |
|-------|--------|
| **Mechanism** | Native `resolveLegacyHydrationAuthority` → `indexed_primary` while projection read cutover off or sqlite one-sided; `assembleDmHydrateThreadReadModel` skipped projection gap-fill when `useProjectionReads === true` |
| **Fix attempted** | Native one-sided sqlite + projection fills gap → `indexed_primary_projection_direction_incomplete`; assemble merges projection when `requiresSqlitePersistence() && partial direction` |
| **Assessment** | **Interim patch** — does not close R1; recurrence likely |
| **Status** | **Partial** — subtraction still required |

### DM-PARK-004 — First hydrate excludes live overlay (conversation change)

| Field | Detail |
|-------|--------|
| **Mechanism** | `use-conversation-messages.ts` called `hydrateHistory` with `includeLiveOverlay: !conversationChanged` |
| **Fix attempted** | `includeLiveOverlay: true` always |
| **Status** | **Partial** |

### DM-PARK-005 — `verify:handoff` / dev-lab do not prove desktop DM durability

| Field | Detail |
|-------|--------|
| **`pnpm verify:handoff`** | stability + dev-lab unit + `dev:lab:benchmark` on `http://127.0.0.1:3340` |
| **Gap** | Browser dev server has **no native SQLite**; Playwright path ≠ Tauri cold quit |
| **Failure observed** | `dm-reload-history` failed 12/13 in full benchmark; passed in isolation (~45s) — suite-order flake |
| **Native scenario** | `dm-native-persist` requires `--cdp` to Tauri WebView — not in default handoff |
| **Status** | **Gate mismatch** |

### DM-PARK-006 — Unit / integration tests redundant for this bug class

| Field | Detail |
|-------|--------|
| **Examples** | `dm-read-authority-contract.test.ts`, `dm-read-authority-native-hydrate.test.ts`, `dm-conversation-hydrate-read-model.test.ts`, `use-conversation-messages.integration.test.ts` — mock `requiresSqlitePersistence` / `dbGetMessages` |
| **Gap** | Did not catch Tauri permission omission or invoke failures |
| **Overlap** | `verify:thread-history` and `verify:p5-persistence` include same mocked persistence tests |
| **Status** | **Low signal** for native restart until real invoke or CDP gate |

### DM-PARK-007 — Legacy known issues still relevant

| ID | Summary | Register status |
|----|---------|-----------------|
| **DM-001** | Delete-for-me reappears after refresh | Accepted limitation — multi-owner |
| **DM-002** | Cross-device history divergence | Open |
| **DM-003** | One-sided restore | Open |

See [v1.5.0-known-issues-and-investigation-queue.md](../program/v1.5.0-known-issues-and-investigation-queue.md) (table stale 2026-05-15).

---

## 3. Groups & communities

### GRP-PARK-001 — Group messaging backend subtracted (2026-06-01)

| Field | Detail |
|-------|--------|
| **Decision** | [current-session.md](./current-session.md) — visual-only stubs; `SealedGroupMessageDurabilityOwner` unwired |
| **Symptom** | Send shows toast “backend rebuilding”; no real group publish/ingest |
| **Status** | **Intentional stub** — not a mystery bug |

### GRP-PARK-002 — Prior community reliability (still in registers)

| ID | Symptom |
|----|---------|
| REL-001–005 | Leave/join truth, restore, multi-profile leak, leave outbox |
| MEM-001 | Roster collapse — accepted limitation |
| MEM-002–006 | Cross-surface status, self-only roster, invite evidence, group list empty |

Do not manual-test group publish paths until ingest → `appendGroupThreadMessage` lands.

---

## 4. Verification, Dev Lab & fast lane

### VER-PARK-001 — Fast lane adopted but insufficient for desktop DM

| Command | Covers | Misses |
|---------|--------|--------|
| `pnpm dev:lab:smoke` | Auth, shell | Native SQLite |
| `pnpm verify:handoff` | stability + dev-lab unit + core benchmark | Tauri cold quit, permissions |
| `pnpm verify:thread-history` | Mocked/kernel contracts | Real invoke |
| Manual matrix | Product truth | Maintainer capacity |

Docs: [dev-lab-spec.md](../program/dev-lab-spec.md), [dev-lab-issue-backlog.md](../program/dev-lab-issue-backlog.md), [stability-first-delivery.md](../program/stability-first-delivery.md).

### VER-PARK-002 — Gateway / transport boundary fixes (session)

| Issue | Fix |
|-------|-----|
| `thread-history/*` imports tripped gateway check | Allowlist in `verify-client-gateway-boundaries.mjs` + eslint |
| Five group paths transport violations | `transport-nostr-feature-allowlist.json` |
| `verify:stability` | Reported green after fixes |

These are **boundary hygiene**, not DM restart proof.

### VER-PARK-003 — Dev Lab scenario backlog (incomplete guards)

| Scenario | Status in backlog |
|----------|-------------------|
| Native cold-quit persist | Backlog |
| Real membership join/leave | Partial |
| Real group send | Deferred (stub) |
| Route stall / `uiResponsiveness` | Backlog |

---

## 5. Documentation drift

### DOC-PARK-001 — Handoff claims vs runtime

| Doc | Problem |
|-----|---------|
| `current-session.md` | Phases A–F read as “landed”; DM durability implied; R1 exit not stated as blocked |
| `dev-lab-issue-backlog.md` | Rows marked **Guarded** without native CDP evidence |
| `v1.5.0-architecture-refactor-queue.md` | R1 “interim milestones landed” vs runtime DM-001 still accepted |
| `v1.5.0-known-issues-and-investigation-queue.md` | Last updated 2026-05-15 — stale status column |

### DOC-PARK-002 — Encyclopedic sprawl

Many program docs, matrices, phase letters — hard to know **what works today** without reading thousands of lines.

**Recommendation for return:** single `LIVE-STATUS.md` (works / stubbed / broken / one gate each).

---

## 6. Session change log (may be uncommitted)

| Change | Path | Notes |
|--------|------|-------|
| Tauri DB permissions | `apps/desktop/src-tauri/permissions/app.toml`, capabilities | `allow-db-commands` |
| `isTauri()` callable check | `packages/db/src/client.ts` | |
| Hydrate authority / merge patches | `dm-read-authority-contract.ts`, `dm-conversation-hydrate-read-model.ts`, `use-conversation-messages.ts` | Interim only |
| `pnpm verify:handoff` | `scripts/verify-handoff.mjs` | |
| Dev Lab infrastructure | scenarios, manifest, failure artifacts | Browser-focused |
| Native R1 read policy | `native-dm-read-policy.ts` + guards in hydrate/read-model/hook | Subtraction, not merge |
| SQLite integrity diagnostics | `native-dm-sqlite-integrity.ts` | Fail-loud `native_dm_sqlite_integrity_violation` |
| SQLite one-sided repair | `native-dm-sqlite-repair.ts` | Scan + relay backfill request via transport owner |
| Dev Lab SQLite gate | `dev-lab-dm-native-persist.mjs`, `getSqliteMessagesForPeer` | No longer reads controller memory |
| Legacy path contracts | `native-dm-legacy-path.contract.test.ts` | v1 controller quarantined |
| Orchestrator type migration | `dm-queue-orchestrator.ts`, `outgoing-dm-orchestrator.ts`, `recipient-discovery-service.ts` | `RelayPoolContract` from v2 types |
| This document | `docs/handoffs/obscur-parked-discovered-issues-2026-06.md` | |

**Git:** Large uncommitted diff at time of parking — do not assume a clean tag without maintainer action.

---

## 7. What was NOT fixed (explicit)

1. R1 collapse — parallel hydrate owners **partially disabled on native** (`native-dm-read-policy`); modules not deleted  
2. Native SQLite-only read path — **policy + guards landed**; full path deletion incomplete  
3. Corrupt / one-sided existing SQLite per profile — **relay backfill repair owner** (`native-dm-sqlite-repair.ts`); no row-level SQLite rewrite tool yet  
4. Group real messaging — still stubbed  
5. `verify:handoff` as desktop DM gate — still browser-centric (`dm-native-persist` CDP reads SQLite when run)  
6. Documentation consolidation — not done (except this register)  
7. Manual matrix / P4-3 — **suspended** by maintainer (2026-06-08); programmatic contracts continue  

---

## 8. Recommended actions when resuming (future)

1. **Tag park point:** `git tag obscur-parked-2026-06` (maintainer).  
2. **Freeze** all feature work until one native gate passes: `dm-native-persist` via CDP or P4-3 manual once.  
3. **Subtract:** native read = `db_get_messages` only; delete projection hydrate authority on native.  
4. **One LIVE-STATUS page** — stop phase letters until runtime matches.  
5. **Human reviewer** or paid hour: “which path was deleted?”  
6. **Scope cut:** desktop DM A↔B + relay optional only; groups UI-only.  

---

## 9. Quick reference — key files

| Concern | Files |
|---------|--------|
| DM write | `apps/pwa/app/features/messaging/services/message-persistence-service.ts` |
| DM hydrate pipeline | `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-pipeline.ts` |
| DM authority | `apps/pwa/app/features/messaging/services/dm-read-authority-contract.ts` |
| DM hook | `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts` |
| SQLite scan | `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-indexed-scan.ts` |
| Tauri DB | `apps/desktop/src-tauri/src/commands/db.rs`, `permissions/app.toml` |
| DB client | `packages/db/src/client.ts` |
| v2 DM controller | `apps/pwa/app/features/messaging/controllers/v2/dm-controller.ts` |
| Handoff script | `scripts/verify-handoff.mjs` |
| Dev Lab runner | `scripts/dev-lab-run.mjs` |

---

## 10. Maintainer note

Obscur remains a valid **long-term ideal** but was **not completable** under indie + AI iteration without subtraction, native gates, and review bandwidth. Parking is intentional. Do not interpret paused state as permission to continue vibe-coding patches without reading §8.
