# Decision Log

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


Track high-impact technical decisions here with date, context, and consequences.

## 2026-03-03: Preserve Legacy Docs as Archive, Rewrite Active Docs

### Decision

- Move old docs to `docs/archive/legacy-2026-03-03`.
- Establish numbered active docs as source of truth.

### Why

- Previous docs mixed stale planning and current behavior.
- Maintainers needed a clear, current operational reference.

### Consequences

- Active docs are easier to navigate and update.
- Legacy references remain available for historical context only.

## 2026-03-03: Feature-Flagged Chat Performance Rollout

### Decision

- Keep `chatPerformanceV2` default `false` for controlled rollout.

### Why

- Reduces risk in critical messaging correctness paths.

### Consequences

- Performance behavior differs by flag state.
- Regression reports must include flag state.

## 2026-03-03: Add Dev-Only Synthetic Load Generator

### Decision

- Install `window.obscurChatPerf` in non-production runtime only.

### Why

- Enables reproducible load/performance validation without manual mass message sending.

### Consequences

- Faster regression triage for scrolling/perf behavior.
- No production behavior impact when environment is production.

## How to Add New Decisions

For each entry include:

1. date,
2. decision statement,
3. context/why,
4. consequences,
5. rollback path (if applicable).
