# Obscur program — overview

**Status:** v1.9.10 on `main` · v2.0 delayed

_Last updated: 2026-06-17_

---

## North star

Restore trustworthy **desktop communication** on a **kernel geometry** (auth, DM, workspace) with **private configurable transport** — not public-relay Nostr client behavior.

**Current truth:** [../CURRENT.md](../CURRENT.md)  
**Daily order:** [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md)  
**Live step:** [../handoffs/current-session.md](../handoffs/current-session.md)

---

## Active program files

Only **28** markdown files in `docs/program/`. Index: [README.md](../archive/program/inactive-2026-06/README.md).

Everything else from the 2026-06 program shelf → [../archive/program/inactive-2026-06/](../archive/program/inactive-2026-06/README.md).

---

## Kernels + verify

| Kernel | Verify |
|--------|--------|
| auth-kernel | `pnpm verify:auth-kernel-contracts` |
| dm-kernel | `pnpm verify:v2-slim` |
| workspace-kernel | `pnpm verify:workspace-kernel` |

---

## Paused / cancelled

- **Live roster sync** — cancelled ([membership-graph-integration-study-2026-06.md](./membership-graph-integration-study-2026-06.md))
- **Community feature band** — paused ([community-relaunch-decision-2026-06.md](./community-relaunch-decision-2026-06.md))
- **Transport-kernel** — not started; relay stack still multi-owner ([CURRENT.md](../CURRENT.md))
