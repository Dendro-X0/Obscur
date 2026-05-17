# Obscur Agent Rules

**Bootstrap only.** Full policy is modular under [`rules/`](./rules/README.md). Product encyclopedia: [`docs/README.md`](./docs/README.md).

## Scope

Monorepo: privacy-first communication — PWA, Tauri desktop, shared TS packages, Rust/native boundaries. Optimize for correctness, explicit contracts, and maintainability over speed-by-patch. See [`rules/00-scope.md`](./rules/00-scope.md).

## Non-negotiables (always)

From [`rules/01-operating-principles.md`](./rules/01-operating-principles.md):

- One owner per lifecycle / state / transport path.
- Explicit contracts (`profileId`, keys, capabilities) — no ambient "current user" in shared code.
- Local state ≠ network truth; UI success needs evidence.
- One canonical path per user action; fix by subtraction when paths overlap.
- Ship claims only when runtime + tests agree.

**Anti-patterns:** [`rules/09-anti-patterns.md`](./rules/09-anti-patterns.md)

## Boot sequence (substantial work)

1. This file + relevant [`rules/`](./rules/README.md) modules for the task.
2. [`docs/encyclopedia/08-maintainer-playbook.md`](./docs/encyclopedia/08-maintainer-playbook.md)
3. [`docs/handoffs/current-session.md`](./docs/handoffs/current-session.md) → **Next Atomic Step**

**Continuity:** [`rules/08-context-continuity.md`](./rules/08-context-continuity.md) · workflow [`.agent/workflows/context-continuity.md`](./.agent/workflows/context-continuity.md) · skill [`.agent/skills/obscur-context-continuity/SKILL.md`](./.agent/skills/obscur-context-continuity/SKILL.md)

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

## Broken core flow (quick)

1. Identify canonical owner → 2. List parallel paths → 3. Remove/isolate non-canonical → 4. Diagnostics at boundary → 5. Repair behavior.

## Language

Rules, docs, and code comments: **English** unless a file is explicitly localized.
