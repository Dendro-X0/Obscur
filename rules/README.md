# Agent Rules — Navigation Hub

**Canonical agent rules live here.** Do not paste duplicate rule blocks into the Cursor Rules UI.

- **Entry point (all tools):** [`AGENTS.md`](../AGENTS.md)
- **Human + LLM docs encyclopedia:** [`docs/README.md`](../docs/README.md)
- **Workflows:** [`.agent/workflows/`](../.agent/workflows/)
- **Skills:** [`.agent/skills/`](../.agent/skills/)
- **Cursor file-scoped rules:** [`.cursor/rules/`](../.cursor/rules/)

---

## Rule modules (read in order when onboarding)

| # | Module | When to load |
|---|--------|----------------|
| 00 | [Scope](./00-scope.md) | Every session |
| 01 | [Operating principles](./01-operating-principles.md) | Every session |
| 02 | [Monorepo standards](./02-monorepo-standards.md) | Cross-app / package work |
| 03 | [Runtime and state](./03-runtime-and-state.md) | Startup, auth, sync, storage |
| 04 | [Messaging and relay](./04-messaging-and-relay.md) | DM, requests, relay, transport |
| 05 | [Auth and identity](./05-auth-and-identity.md) | Import, unlock, profiles, sessions |
| 06 | [Testing and validation](./06-testing-and-validation.md) | Fixes, releases, verification |
| 07 | [Documentation](./07-documentation.md) | Doc or handoff updates |
| 08 | [Context continuity](./08-context-continuity.md) | Multi-thread / handoff work |
| 09 | [Anti-patterns](./09-anti-patterns.md) | Before merging risky changes |
| 10 | [Recovery heuristic](./10-recovery-heuristic.md) | Broken core flows |
| 11 | [Feasibility and modular safety](./11-feasibility-and-modular-safety.md) | Stalled features, infeasible goals, regression-safe iteration |
| 13 | [Navigation performance](./13-navigation-performance.md) | Sidebar/route changes, warm-up, shell layout, perf regressions |

---

## How this fits the monorepo

| Layer | Role |
|-------|------|
| `rules/` | Tool-agnostic agent policy (markdown modules) |
| `AGENTS.md` | Short bootstrap every agent reads first |
| `.cursor/rules/*.mdc` | Cursor-native always-on rules (`obscur-core`, `obscur-modular-iteration`, …) |
| `.agent/skills/` | Task-specific playbooks (continuity, recovery, …) |
| `.agent/workflows/` | Step-by-step procedures |
| `docs/` | Product/architecture encyclopedia (not agent policy) |

**Language:** Write rules and docs in **English** unless a file is explicitly localized.

---

## Boot sequence (substantial work)

1. `AGENTS.md`
2. `rules/01-operating-principles.md` + domain modules for the task
3. `docs/encyclopedia/08-maintainer-playbook.md`
4. `docs/handoffs/current-session.md` → resume **Next Atomic Step**

---

## Adding or changing rules

1. Edit the focused module under `rules/` (one concern per file).
2. If Cursor scope changes, update the matching `.cursor/rules/*.mdc`.
3. Keep `AGENTS.md` as an index only — no duplicate long-form text.
4. Link new shelves from `docs/README.md` when the change is product/architecture docs.
