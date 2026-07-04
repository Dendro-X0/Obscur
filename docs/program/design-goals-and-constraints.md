# Design goals and constraints

**Status:** **Canonical** — stable product and architecture intent; read before implementation  
**Last updated:** 2026-06-01  
**Owner:** Maintainer  
**Process (how to work):** [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md)

This document answers **what Obscur is**, **what we are restoring in v1.9.x**, **what v2.0.0 means**, and **which rules must not be violated**. It does not replace the scope checklist ([version-roadmap-scope.md](./version-roadmap-scope.md)) or the active scope doc ([v1.9.4-scope.md](../archive/program/inactive-2026-06/v1.9.4-scope.md)).

---

## 1. Product identity

**One sentence:** Obscur is a transport-agnostic, E2E-first communication platform for teams that deploy on **infrastructure they trust** (private relays, coordination service, optional homeserver). **Nostr is an optional adapter**, not membership authority for workspace communities.

**Expanded:** [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md) · [product-layers-and-nostr.md](../architecture/product-layers-and-nostr.md) · [future/00-charter-vision.md](../future/00-charter-vision.md)

**Not the product story:** “Universal public-relay Nostr client with guaranteed global delete and roster truth.” That model is **explicitly abandoned** for workspace features ([community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md)).

---

## 2. Program phases (no ambiguity)

| Phase | Goal | Canonical docs |
|-------|------|----------------|
| **Now — v1.9.x** | Restore **in-scope features** to **I + V** (or **A** with copy) on desktop; kernel (Lane K) shipped in v1.9.0–v1.9.3 | [v1.9.x-release-train.md](./v1.9.x-release-train.md) · [v1.9.4-scope.md](../archive/program/inactive-2026-06/v1.9.4-scope.md) |
| **Later — v2.0 prep** | Installers, website, demo kit, full scope verification pass | [v2.0-release-pipeline.md](../archive/program/inactive-2026-06/v2.0-release-pipeline.md) — **after** v1.9.x exit |
| **v2.0.0 tag** | Production demo per full [version-roadmap-scope.md](./version-roadmap-scope.md) § exit | [obscur-2.0-milestone-roadmap.md](../archive/program/inactive-2026-06/obscur-2.0-milestone-roadmap.md) |

**v2.0.0 is delayed.** Do not shrink v2.0 scope silently; do not start v2.0 release prep while v1.9.x rows are still open without maintainer handoff note.

---

## 3. Surfaces and persistence (design target)

| Surface | Role | Persistence (native) |
|---------|------|----------------------|
| **Desktop (Tauri)** | Primary dev and verification | **SQLite only** — [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) |
| **PWA / web** | Same kernel; production web gated | Dev IDB allowed; not production authority |
| **Android** | Installable demo for v2.0 gate | SQLite; Tier 1 smoke in v1.9.4+ wrap-up |

**Policy one-liner:** On native runtime, durable product state lives in SQLite via `libobscur` / Tauri `db_*` — not IndexedDB or chat-state as authority.

### Enforcement honesty (avoid false “Done”)

Policy bands P3a–P3d are **implemented in code paths** but **verification and residual dual paths remain**:

| Gap | Impact | v1.9.x action |
|-----|--------|---------------|
| `chat-state` / IDB still referenced on some paths | DM/list drift, restart surprises | Close in v1.9.4+ per scope + truth map — **subtract**, do not bridge |
| P3b–P3d manual restart soaks | “Done (code)” ≠ **V** | Phase B matrix + register |
| Cross-client roster on public relay | MEM-001 limitation | **Accepted** until coordination path — ACC-02 |

Do not claim SQLite convergence complete until grep audit + Phase B rows pass ([obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) § enforcement).

---

## 4. Architecture invariants (non-negotiable)

From [`rules/01-operating-principles.md`](../../rules/01-operating-principles.md) — apply to **every** v1.9.x change:

1. **One owner** per lifecycle / state / transport path.
2. **Explicit `profileId`** and keys — no ambient “current user” in shared code.
3. **Local state ≠ network truth** — UI success requires evidence.
4. **One canonical path** per user action — fix by **subtraction** when paths overlap.
5. **Ship claims** only when runtime + tests agree.
6. **Three-iteration cap** per band — then feasibility review ([rules/11-feasibility-and-modular-safety.md](../../rules/11-feasibility-and-modular-safety.md)).

**Owner map:** [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md) · [14-module-owner-index.md](../encyclopedia/14-module-owner-index.md)

---

## 5. Shell and UI architecture (incremental target)

**Canonical shell contract:** [obscur-product-shell-architecture-2026-05.md](./obscur-product-shell-architecture-2026-05.md)

| Invariant | Meaning |
|-----------|---------|
| One `AppShell` per unlocked session | Chrome survives route changes |
| Route-domain providers | Messaging only on `/` and `/groups/*`; light routes avoid heavy stacks |
| Fail-open desktop boot | Shell paints before native profile IPC completes |
| Stability | No render loops — [ui-effect-stability-policy.md](./ui-effect-stability-policy.md); `pnpm verify:stability` on shell/relay touches |

**P0 before feature claims:** Fatal client errors (`RootErrorBoundary`, max update depth, hooks mismatch) block the active concentration unit until fixed or registered.

**Reference only (not daily queue):** [radical-overhaul-v2-target.md](../architecture/radical-overhaul-v2-target.md) — long-term explicit-everything direction; implement **incrementally** via shell contract + owner subtraction during v1.9.x, not as a parallel rewrite program.

**Archived alternate path:** [v2.0-resumption-charter.md](../archive/program/inactive-2026-06/v2.0-resumption-charter.md) (R-SHELL-first narrow v2.0) — do not execute unless maintainer re-charters in handoff.

---

## 6. Accepted limitations (product truth)

These are **not bugs to “fix” in v1.9.x** unless a scope row explicitly reopens them:

| ID | Topic | Doc |
|----|-------|-----|
| ACC-01 | Delete-for-me durability across refresh/restore on open Nostr | [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) |
| ACC-02 | Roster multi-owner / MEM-001 on public relay | Same |
| — | Cooperative “delete for everyone” UI | [cooperative-redaction-future.md](../messaging/cooperative-redaction-future.md) — v1.6+ |
| ACC-03 | Cross-restart “stay signed in” / OAuth-style convenience | **Cancelled on desktop** v1.9.10 — [v1.9.6-session-persistence-redesign.md](../archive/program/inactive-2026-06/v1.9.6-session-persistence-redesign.md) · manual unlock each session |
| — | Public marketing / GitHub Releases promotion | After v2.0.0 — [maintainer-distribution-policy.md](../archive/program/inactive-2026-06/maintainer-distribution-policy.md) |

Register: [unified-verification-issues-register.md](./unified-verification-issues-register.md)

---

## 7. In scope for v1.9.5 (trust & security band)

Work must trace to [v1.9.5-scope.md](./v1.9.10-scope.md) and Lane SEC in [version-roadmap-scope.md](./version-roadmap-scope.md):

- **Anti-fraud (basic)** — recipient-local assessment on dm-kernel; cold-contact + financial signals; DM banner UI
- **Anti-bot (basic)** — B2 inbound hardening, rate limits, steward disable
- **Relay security** — operator trust bundle audit, relay trust scorer, private-trust setup docs
- **Internal security validation** — [v1.9.5-security-validation-checklist.md](../archive/program/inactive-2026-06/v1.9.5-security-validation-checklist.md) signed before v2.0 prep

**Product position:** B2Pro / private-trust deployment; assessments are **local and optional**, not platform moderation. Native defense is scoped to **information exchange** (DMs, group chats)—recipient-local after decrypt, **no** centralized scoring or private-data collection marketed as protection. Independent from [Anti-SE Shield](../archive/program/inactive-2026-06/anti-se-shield-mutual-reference.md) (design reference only).

**Out of scope for v1.9.5:** v2.0 website/installers/demo kit, public promotion, full rule-pack CDN, iOS.

---

## 8. In scope for v1.9.4 (closed)

Historical — platform + community verification wrap-up. See [v1.9.4-scope.md](../archive/program/inactive-2026-06/v1.9.4-scope.md). Phase C exit @ `7a49e339`.

---

## 9. Document authority (single hierarchy)

When documents conflict, **higher number wins**:

| Priority | Document |
|----------|----------|
| 1 | [current-session.md](../handoffs/current-session.md) |
| 2 | **This file** — design goals and constraints |
| 3 | [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md) |
| 4 | [v1.9.x-release-train.md](./v1.9.x-release-train.md) + active scope doc |
| 5 | [version-roadmap-scope.md](./version-roadmap-scope.md) |
| 6 | [obscur-2.0-milestone-roadmap.md](../archive/program/inactive-2026-06/obscur-2.0-milestone-roadmap.md) (v2.0 destination) |

**Do not use as active queue:** [current-roadmap.md](../archive/program/inactive-2026-06/current-roadmap.md), [v2.0-resumption-charter.md](../archive/program/inactive-2026-06/v2.0-resumption-charter.md), [obscur-experiment-reset-2026-05.md](../archive/program/inactive-2026-06/obscur-experiment-reset-2026-05.md), `docs/archive/*` scope files unless handoff cites them for history.

---

## 9. Pre-implementation gate (maintainer)

Before setting handoff to **Active**:

- [ ] This file + execution contract read
- [ ] Active unit = **v1.9.4** (or handoff override with reason)
- [ ] One next atomic step written in handoff
- [ ] `pnpm release:test-pack -- --skip-preflight` baseline recorded
- [ ] No open doc conflict (charter vs train vs pipeline)

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | Initial canonical design goals — product, phases, invariants, limitations, doc authority |
