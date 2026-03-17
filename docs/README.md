# Obscur Documentation

Use this folder as the single source of truth for both human contributors and language-model agents.

The goal is high signal, low token waste: enough context to resume work quickly, without historical roadmap noise.

## Canonical Docs

1. [01 Project Overview](./01-project-overview.md)
2. [02 Repository Map](./02-repository-map.md)
3. [03 Runtime Architecture](./03-runtime-architecture.md)
4. [04 Feature Modules](./04-messaging-and-groups.md)
5. [05 Data, State, and Sync Flows](./05-performance-and-load-testing.md)
6. [06 Testing and Quality Gates](./06-testing-and-quality-gates.md)
7. [07 Operations and Release Flow](./07-operations-and-release-flow.md)
8. [08 Maintainer Playbook and Continuation Handoff](./08-maintainer-playbook.md)

## Scope Rules

- `/docs` should describe current architecture, canonical owners, key workflows, and known risks.
- Historical roadmaps and superseded plans are intentionally removed.
- Keep docs aligned with code paths under `apps/`, `packages/`, and `scripts/`.

## Mandatory Checks

```bash
pnpm docs:check
```

## Release Prep Shortlist

```bash
pnpm version:sync
pnpm version:check
pnpm docs:check
pnpm release:preflight -- --allow-dirty 1
```

For strict preflight, run without `--allow-dirty` on a clean `main` working tree.
