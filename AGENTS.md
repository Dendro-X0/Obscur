# Obscur Agent Rules

**Bootstrap only.** Full policy is modular under [`rules/`](./rules/README.md). Product encyclopedia: [`docs/README.md`](./docs/README.md).

## Scope

Monorepo: privacy-first communication — PWA, Tauri desktop, shared TS packages, Rust/native boundaries. Optimize for correctness, explicit contracts, and maintainability over speed-by-patch. See [`rules/00-scope.md`](./rules/00-scope.md).

**Product continuity (2026-05):** Greenfield is discontinued as a separate delivery repo. Obscur is the active execution path. Archived Greenfield docs under [`docs/archive/greenfield/`](./docs/archive/greenfield/) are reference material for design goals only.

## Non-negotiables (always)

From [`rules/01-operating-principles.md`](./rules/01-operating-principles.md):

- One owner per lifecycle / state / transport path.
- Explicit contracts (`profileId`, keys, capabilities) — no ambient "current user" in shared code.
- Local state ≠ network truth; UI success needs evidence.
- One canonical path per user action; fix by subtraction when paths overlap.
- Ship claims only when runtime + tests agree.
- If a feature stalls after repeated iterations, stop patch-debug loops and run feasibility analysis (`rules/11-feasibility-and-modular-safety.md`).

**Anti-patterns:** [`rules/09-anti-patterns.md`](./rules/09-anti-patterns.md)

## Boot sequence (substantial work)

1. This file + relevant [`rules/`](./rules/README.md) modules for the task.
2. [`docs/program/obscur-backend-engine-roadmap.md`](./docs/program/obscur-backend-engine-roadmap.md) — **phase order** (backend only)
3. [`docs/program/obscur-ui-archive-manifest.md`](./docs/program/obscur-ui-archive-manifest.md) — UI frozen; ui-kit preserved
4. [`docs/handoffs/current-session.md`](./docs/handoffs/current-session.md) — **next atomic step**

Verify: `pnpm verify:engine-lab` · `pnpm verify:ui-archive`. No dev server. Legacy: `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1`.

Full doc index: [`docs/README.md`](./docs/README.md). **Do not boot from `docs/archive/`.**

**Plan execution (before every diff):** [`.agent/skills/obscur-session-gate/SKILL.md`](./.agent/skills/obscur-session-gate/SKILL.md) · [`.agent/workflows/plan-execution-checklist.md`](./.agent/workflows/plan-execution-checklist.md) · global [`backend-rigor`](~/.cursor/skills/backend-rigor/SKILL.md)

**Subtraction / recovery / iteration:** [`.agent/skills/obscur-subtraction-change/SKILL.md`](./.agent/skills/obscur-subtraction-change/SKILL.md) · [`.agent/skills/obscur-foundation-recovery/SKILL.md`](./.agent/skills/obscur-foundation-recovery/SKILL.md) · [`.agent/skills/obscur-modular-iteration/SKILL.md`](./.agent/skills/obscur-modular-iteration/SKILL.md) · [modular-iteration-contract.md`](./docs/program/modular-iteration-contract.md) · catalog [`.agent/README.md`](./.agent/README.md)

**Continuity:** [`rules/08-context-continuity.md`](./rules/08-context-continuity.md) · [`.agent/skills/obscur-context-continuity/SKILL.md`](./.agent/skills/obscur-context-continuity/SKILL.md)

## Rule index

| Topic | Module |
|-------|--------|
| Monorepo layout | [`rules/02-monorepo-standards.md`](./rules/02-monorepo-standards.md) |
| Runtime / storage / sync | [`rules/03-runtime-and-state.md`](./rules/03-runtime-and-state.md) |
| Messaging / relay | [`rules/04-messaging-and-relay.md`](./rules/04-messaging-and-relay.md) |
| Auth / identity | [`rules/05-auth-and-identity.md`](./rules/05-auth-and-identity.md) |
| Testing / release evidence | [`rules/06-testing-and-validation.md`](./rules/06-testing-and-validation.md) |
| Documentation | [`rules/07-documentation.md`](./rules/07-documentation.md) |
| Broken core flow | [`rules/10-recovery-heuristic.md`](./rules/10-recovery-heuristic.md) |
| Feasibility / modular safety | [`rules/11-feasibility-and-modular-safety.md`](./rules/11-feasibility-and-modular-safety.md) |
| Modular iteration (always-on) | [`.cursor/rules/obscur-modular-iteration.mdc`](./.cursor/rules/obscur-modular-iteration.mdc) · [`docs/program/modular-iteration-contract.md`](./docs/program/modular-iteration-contract.md) |
| Navigation performance | [`rules/13-navigation-performance.md`](./rules/13-navigation-performance.md) · [`docs/program/navigation-performance-contract.md`](./docs/program/navigation-performance-contract.md) |

## Broken core flow (quick)

1. Identify canonical owner → 2. List parallel paths → 3. Remove/isolate non-canonical → 4. Diagnostics at boundary → 5. Repair behavior.

## Language

Rules, docs, and code comments: **English** unless a file is explicitly localized.
