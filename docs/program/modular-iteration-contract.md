# Modular iteration contract

**Purpose:** How Obscur maintains original functional goals across a large monorepo while pausing, siloing, redesigning, and re-integrating modules without patch-debug drift.

_Last updated: 2026-06-18_  
**Always-on rule:** [`.cursor/rules/obscur-modular-iteration.mdc`](../../.cursor/rules/obscur-modular-iteration.mdc)  
**Agent skill:** [`.agent/skills/obscur-modular-iteration/SKILL.md`](../../.agent/skills/obscur-modular-iteration/SKILL.md)

---

## Core thesis

Agents do **not** execute vague promises ("fix this feature", "build a good UI"). They **explore relevant components**, **reason about owners and boundaries**, then follow:

**plan/spec → mental simulation → implementation → named proof**

This contract applies to humans and agents. It complements [design-goals-and-constraints.md](./design-goals-and-constraints.md) and [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md).

---

## Goal preservation

| Rule | Meaning |
|------|---------|
| **Original goals stand** | Functional intent from active program docs remains the north star unless **objectively infeasible** (evidence + feasibility review) or **explicitly cancelled** in handoff/register |
| **Temporary reduction OK** | Scope can shrink for a release band (e.g. hide vs delete, manual unlock vs auto-restore) — must be **honest in UX** and **documented** |
| **Pause ≠ abandon** | PAUSED bands (e.g. community membership) mean **no feature churn** until automation or charter; goals are deferred, not deleted |
| **Cancel is explicit** | CANCELLED bands (e.g. AUTH-SESSION-1) are intentional product decisions — agents must not resume without handoff update |

---

## Silo strategy (impasse)

When a module hits an impasse (≥3 failed iterations on the same band per [rules/11](../../rules/11-feasibility-and-modular-safety.md)):

1. **Stop patching** the silo — register the symptom, owners, and blockers.
2. **Isolate** — no new reconcile/bridge layers touching working modules.
3. **Redesign inside the silo** — investigation spec + subtraction plan before re-integration.
4. **Re-integration gate** — study **interface conflicts** between the redesigned module and **currently working** modules *before* wiring back.

```
Working modules A, B  ──►  PAUSED silo C  ──►  redesign C  ──►  integration study  ──►  merge
                              (no churn)         (in silo)        (boundary contract)
```

Community band (2026-06): siloed at **PAUSED** until `verify:com-mem-2` exists — not abandoned.

---

## Modular architecture expectations

The whole repository uses **modular boundaries** so functions are:

| Property | Requirement |
|----------|-------------|
| **Easy to integrate** | Explicit contracts (`profileId`, typed ports, feature services) — no ambient singletons |
| **Easy to isolate** | Feature folders under `apps/pwa/app/features/*`, packages under `packages/*`, native under `apps/desktop/src-tauri/` |
| **One owner per lifecycle** | One canonical mutation path per user action ([rules/01](../../rules/01-operating-principles.md)) |
| **Investigate before fix** | Trace one user action; name owner; list parallel writers |
| **Failed modules return via redesign** | Re-integration only after subtraction + integration study + proof plan |

---

## Agent execution order (mandatory)

For any non-trivial task:

| Phase | Activity | Gate |
|-------|----------|------|
| **0. Gate** | [obscur-session-gate](../../.agent/skills/obscur-session-gate/SKILL.md) — handoff, PAUSED/CANCELLED | No diff if conflict |
| **1. Explore** | Read relevant modules, registers, truth map — **not** whole repo or `docs/archive/` | Components named |
| **2. Reason** | Classify: owner, parallel paths, integration surface | Written in spec or session header |
| **3. Plan / spec** | Investigation or design spec (`specs/backend/`, `docs/program/`) | **No code** for bugs/cross-module |
| **4. Mental simulation** | Walk one user action; sender vs receiver; failure modes | Integration risks listed |
| **5. Implement** | Smallest slice; [subtraction](../../.agent/skills/obscur-subtraction-change/SKILL.md) before adapters | Matches spec |
| **6. Proof** | L1–L4 per [testing-and-issue-tracking-spec.md](../archive/program/inactive-2026-06/testing-and-issue-tracking-spec.md) | No vague "fixed" |

**Forbidden:** jumping to implementation from "fix X" or "make UI good" without phases 1–4.

---

## Integration study (before re-wiring a silo)

When bringing a redesigned or paused module back:

1. **List working neighbors** — modules that must not regress (e.g. DM kernel while integrating community).
2. **Document interface contract** — inputs, outputs, ownership, proof commands.
3. **Conflict scan** — parallel writers, shared stores, relay scope, profile binding.
4. **Proof plan** — automated scenario first (e.g. COM-MEM-2), then runtime L-layer.
5. **Handoff update** — un-pause only with charter + next atomic step.

---

## Relationship to other docs

| Doc | Role |
|-----|------|
| [CURRENT.md](../CURRENT.md) | Version truth + daily boot |
| [handoffs/current-session.md](../handoffs/current-session.md) | PAUSED / CANCELLED / next step |
| [12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md) | Owner map |
| [rules/11-feasibility-and-modular-safety.md](../../rules/11-feasibility-and-modular-safety.md) | Stop patch loops |
| Global `backend-rigor` | Specs-first + L-layers |

---

## Anti-patterns

- Treating PAUSED as "low priority" and patching anyway
- Re-integration without integration study
- UI compensation for broken backend owners
- Archive or chat as source of truth
- Claiming goal abandonment without feasibility doc + maintainer sign-off
