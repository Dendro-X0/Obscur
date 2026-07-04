# Relationship sync experiment (E-REL)

**Status:** Community slice **complete (manual pass 2026-06-12)** — opt-in experiment; DM rows E4–E5 deferred  
**Owner:** `apps/pwa/app/features/relationship-sync/`  
**Gate:** `pnpm verify:relationship-sync-experiment`

---

## Hypothesis

End-to-end relationship consistency is achievable **without new server push** if the client:

1. Names **one authority per question** (coordination directory for community membership; peer-trust + canonical contact events for DM).
2. Runs **hydrate repair** before any sidebar / invite / send gate reads durable state.
3. Treats all other stores as **cache or drift**, surfaced by `detectRelationshipSyncDrift`.

Multi-owner conflicts are not solved by more patches; they are solved by **subtraction + a single projection read API**.

---

## Scope (in)

| Domain | Authority (experiment) | Legacy drift sources |
|--------|------------------------|----------------------|
| Community roster / invite block | Coordination directory `activeMemberPubkeys` | Join-evidence widen, membership ledger terminal, tombstone, metadata cache |
| DM contact / establish | `peerTrust.acceptedPeers` (+ account projection when reads enabled) | IndexedDB `connectionStore`, stale `connectionRequests`, thread-only establish |
| Sidebar community rows | Workspace list-port **after** `repairCommunityMembershipDurableStateOnHydrate` | Terminal ledger without repair |

## Scope (out)

- New coordinator push / participant port pings (future CodaCtrl work).
- Replacing coordination or relay stacks.
- Full deletion of `features/groups/` in this experiment.

---

## Enable

```bash
# apps/pwa/.env.local
NEXT_PUBLIC_OBSCUR_RELATIONSHIP_SYNC_EXPERIMENT=1
```

When enabled:

- Community invite blocklist uses **directory-only** active members (no `joinEvidenceMemberPubkeys` widen).
- Sidebar list-port materializes groups when coordination lists self active but local ledger/metadata hide the row (E-REL-2). **Never** when leave outbox or directory `left`/`expelled` lists record an intentional leave.
- Drift issues log at `relationship.sync.drift_detected` (dev console / log-app-event).
- Contact list holds legacy peerTrust until account projection has accepted peers (`network.peer_trust_read_authority_selected`).

---

## Manual proof matrix (maintainer)

Two profiles (Tester1 / Tester2), `pnpm dev:desktop:online`, coordination + relay up.

| Step | Action | Pass |
|------|--------|------|
| E1 | A invites B to managed workspace; B accepts | Both see group in sidebar |
| E2 | B leaves; restart both apps | B absent from B sidebar; A directory excludes B within poll SLA |
| E3 | B re-invited and accepts; restart both | B sidebar + A invite blocklist agree (no “already in” while B hidden) |
| E4 | A removes B as DM contact (Network profile remove); restart | `isDmContactAccepted` false both sides |
| E5 | A re-requests; B accepts; restart | DM thread usable; trust accepted; no stranger banner stuck |

Record drift: call `detectRelationshipSyncDrift` from dev-lab or browser console when wired.

### Manual evidence (2026-06-12)

Two-profile desktop (`pnpm dev:desktop:online`, coordination + relay, `NEXT_PUBLIC_OBSCUR_RELATIONSHIP_SYNC_EXPERIMENT=1`):

| Step | Result |
|------|--------|
| NewTest 1 leave (A + B) | Group did **not** reappear (leave-outbox gate) |
| NewTest 2 leave (B) | Lists consistent within seconds; **survived PC restart** |
| NewTest 2 re-invite + accept | Real-time roster/sidebar on A and B |
| Console | `peer_trust_read_authority_selected` boot flip; `acceptedPeerCount: 1` throughout — no UX regression |

**Not exercised:** E4–E5 (DM contact remove/re-add). **Not claimed:** production-wide E2E sync; public-release regressions possible.

---

## Exit criteria

| Criterion | Evidence |
|-----------|----------|
| Programmatic gate green | `pnpm verify:relationship-sync-experiment` |
| E1–E3 pass on manual matrix | **Done 2026-06-12** (see manual evidence above) |
| Drift detector finds zero issues after E3/E5 | Not formally logged; no drift-driven failures observed in E1–E3 pass |
| Optional: wire roster modal to projection-only read | Follow-up E-REL-3 (deferred) |

Failure → do not expand experiment; fix subtraction or document blocker in register.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-12 | E-REL-2 directory sidebar + leave-outbox gate; manual E1–E3 pass (PC restart) |
| 2026-06-08 | E-REL-1 — projection port, drift detector, invite blocklist experiment flag |
