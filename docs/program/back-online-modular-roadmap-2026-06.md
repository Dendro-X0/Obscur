# Back online — modular roadmap (Path B)

**Status:** Active  
**Last updated:** 2026-06-02  
**Fork:** **Path B — Internal network** ([community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md) §Decision record)  
**Evidence base:** [exploration synthesis](../exploration/synthesis/as-built-architecture-and-fork-options.md) (modules 1–8)

---

## 1. Product commitment

Obscur ships **encrypted DM** (Nostr adapter) **plus** **workspace communities** on **operator-controlled infrastructure**:

| Layer | Authority |
|-------|-----------|
| **Membership** (join / leave / expel / roster) | Coordination API — signed head/deltas (`apps/coordination`) |
| **Community chat** | Sealed / room-key model on **trusted or private** relay only |
| **DM** | Existing v2 transport + SQLite on native — unchanged |
| **Public relay graph** | **Not** membership owner for new workspaces |

**Not in scope:** Sovereign rooms on public relays as a supported create path; public-relay roster truth; platform enforcement from warning tiers.

---

## 2. What stays stable (do not break)

Build all Path B work on this core — regression here blocks everything:

| Domain | Owners | CI |
|--------|--------|-----|
| DM send/receive | `runtime-messaging-transport-owner-provider` → v2 `dm-controller` → `dm-relay-transport` | P5-DM-1/2/3 |
| DM hydrate (native) | `dm-conversation-hydrate-pipeline` → indexed scan → SQLite | `verify:p5-persistence` |
| Native persistence | `requiresSqlitePersistence()` → `@dweb/db` → `libobscur` | P5 bands |
| Startup / auth | `window-runtime-supervisor` → `AuthGateway` → `UnlockedAppRuntimeShell` | `verify:phase1` |
| Profiles | Per-window scope + `listAccountSharedSqliteProfileIds` | Unit tests; Phase B soak pending |

---

## 3. Path B execution bands (ordered)

Work **subtraction before addition**. No piecemeal persistence patches without the band owner and CI gate named below.

### Band B0 — Ops & gates (unblock)

| # | Deliverable | Owner / path |
|---|-------------|--------------|
| B0-1 | Coordination `/health` + `isCoordinationConfigured()` required for **new** workspace create (already partial — verify no dev escape in prod builds) | `community-trust-policy.ts`, `create-group-dialog.tsx` |
| B0-2 | Relay tier ≠ `public_default` for `managed_workspace` create/join | `community-mode-contract.ts` |
| B0-3 | Document production ops minimum: deployed Worker + one trusted `wss://` | This doc §6 |
| B0-4 | Local dev matrix documented and runnable | `apps/coordination/README.md`, `.env.example` |

**Exit:** Maintainer can run K-M1/K-M2 locally with two profiles + coordination dev server.

---

### Band B1 — Membership truth subtraction (mandatory)

| # | Deliverable | Owner / path |
|---|-------------|--------------|
| B1-1 | For `managed_workspace`: **disable** `mergeHybridMembershipTruthFallback` relay widen — roster from coordination directory when `fresh`, else explicit stale/empty UX | `community-membership-truth.ts` |
| B1-2 | `use-sealed-community`: relay ingest **chat only** for workspace — not roster authority | `use-sealed-community.ts` |
| B1-3 | Single `useSealedCommunity` instance policy (shell vs group-home) — document or merge | `main-shell.tsx`, `group-home-page-client.tsx` |
| B1-4 | Worker **steward ACL** design + implement (who may append deltas per `communityId`) | `apps/coordination/src/membership-directory.ts` |

**Exit:** K-M1/K-M2 automated in CI (two-client or mocked dual publish).

**CI gate (new):** `test:workspace-membership` extended or `verify:path-b-membership` — leave propagates roster shrink.

---

### Band B2 — Community wire honesty

| # | Deliverable | Owner / path |
|---|-------------|--------------|
| B2-1 | `createCommunityTeamRelayTransport`: publish real Nostr EVENT or return **failure** — no optimistic `{ success: true }` | `community-team-relay-transport.ts`, `enhanced-relay-pool` |
| B2-2 | `invite-manager.ts` reads **v2** relay list (same as `use-relay-list`) | `invite-manager.ts` |
| B2-3 | Audit `group-management-dialog.tsx` raw REQ/CLOSE — single subscription owner or scoped helper | M5 + M1 |

**Exit:** Integration test proves EVENT wire on team-relay publish path.

---

### Band B3 — Group message durability (Test 10 class)

| # | Deliverable | Owner / path |
|---|-------------|--------------|
| B3-1 | **One** group message send path (canonical: `use-chat-actions` **or** sealed hook — pick one, subtract the other) | `use-chat-actions.ts`, `use-sealed-community.ts` |
| B3-2 | `commitSealedGroupMessages` awaited; profile slot correct at write | `sealed-group-message-persistence.ts` |
| B3-3 | Hydrate reads SQLite with multi-slot scan (already partial) | `sealed-group-message-persistence.ts` + M4 |

**Exit:** **P5-COM-MSG** band in `verify:p5-persistence` — send → simulated cold start → bodies visible.

**Feasibility gate:** If B3 fails after **two substantial iterations**, run `rules/11` analysis — Path D rewrite, not more adapters.

---

### Band B4 — Cross-device & backup (native)

| # | Deliverable | Owner / path |
|---|-------------|--------------|
| B4-1 | **BKP-2:** backup publish includes SQLite-derived evidence for DM/group bodies on native (not chat-state mirror only) | `encrypted-account-backup-service.ts` |
| B4-2 | Restore writes `community-group-sqlite-store` when group list restored | M3 + M1 |

**Exit:** Native restore integration test — bodies survive when SQLite pre-seeded.

---

### Band B5 — Extension modules (after B1–B3 green)

Orthogonal modules use **kernel hooks**, not new chat-state paths:

| Module | Hook | Greenfield alignment |
|--------|------|----------------------|
| **Safety / warnings** | DM receive pipeline + thread chrome | [02-warning-and-trust-model.md](../archive/greenfield/02-warning-and-trust-model.md) — recipient-only tiers |
| **M10 shared intel** | Extend existing `m10-shared-intel-policy.ts` | Signed signals, strict mode gates |
| **Anti-bot / rate** | Request transport + invite economics | Charter anti-fraud affordances |

**CI template:** `verify:p5-safety` (reproducible tier from fixture logs) — add when B5 starts.

---

## 4. Explicit non-goals (Path B)

- Public-relay community membership convergence (ACC-02 accepted limitation until coordination-only workspaces).
- Global delete / unsend marketing claims on Nostr.
- Server-side plaintext NLP for safety.
- Vendor account bans from warning scores.
- Growing `use-sealed-community.ts` with new features — **shrink** it.

---

## 5. Modular integration rules (all bands)

From [design-goals-and-constraints.md](./design-goals-and-constraints.md) §4 and [product-layers-and-nostr.md](../architecture/product-layers-and-nostr.md):

1. **One owner** per lifecycle concern per band.
2. **Explicit `profileId`** on all new stores and bus events.
3. **ClientGateway / TransportPort** for mutations — no direct `@dweb/nostr` in new feature code.
4. **Native:** SQLite authority; chat-state mirror only where policy allows.
5. **Ship claim** = runtime + **named CI band** — not manual matrix alone.
6. **Three iterations** → feasibility review ([rules/11](../../rules/11-feasibility-and-modular-safety.md)).

---

## 6. Operations minimum (production Path B)

| Component | Role |
|-----------|------|
| **Coordination Worker** | D1 membership directory + invites API — deploy `apps/coordination` (Cloudflare or self-host) |
| **Trusted relay** | At least one `wss://` under operator control for sealed gossip publish |
| **Desktop builds** | `NEXT_PUBLIC_COORDINATION_URL` + operator URL override (`obscur.operator.coordination_url.v1`) |
| **Two-profile QA** | Standard verification — Tester1 / Tester2 windows |

Local substitute: [community-fork-decision § Testing without your own private server](./community-fork-decision-2026-05.md).

---

## 7. Doc maintenance

When a band lands:

- Update [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md) owner rows.
- Update [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) owner matrix if persistence changes.
- Update [current-session.md](../handoffs/current-session.md) **Next atomic step** only — not exploration shelf (as-built audit is frozen at v1).

---

## 8. References

- [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md)
- [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)
- [obscur-r1-workspace-consolidation.md](./obscur-r1-workspace-consolidation.md)
- [exploration synthesis](../exploration/synthesis/as-built-architecture-and-fork-options.md)
- [p5-persistence-survival-contract.md](./p5-persistence-survival-contract.md)

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | Created — Path B signed; bands B0–B5 |
