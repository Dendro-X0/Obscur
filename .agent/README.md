# Obscur agent procedures

Repo-local **skills** and **workflows** for Cursor/Codex. Global skills (`backend-rigor`, `solo-dev-defaults`, `ui-taste`) live under `~/.cursor/skills/` and apply across projects; this folder holds **Obscur-specific** procedures agents load when working in this monorepo.

## Boot order (humans and agents)

1. [`docs/START-HERE.md`](../docs/START-HERE.md) — 5-doc daily allowlist
2. [`docs/handoffs/current-session.md`](../docs/handoffs/current-session.md) — next atomic step, PAUSED/CANCELLED
3. [`AGENTS.md`](../AGENTS.md) → [`rules/`](../rules/README.md)

## Skill stack

| Layer | Location | Role |
|-------|----------|------|
| Policy (always-on) | `AGENTS.md`, `rules/`, `.cursor/rules/` (incl. `obscur-modular-iteration.mdc`) | Non-negotiables + iteration order |
| Global procedure | `~/.cursor/skills/backend-rigor/` | Plan fidelity, specs, L1–L4 proof |
| Global defaults | `~/.codex/skills/solo-dev-defaults/` | Solo-dev architecture defaults |
| Global UI | `~/.cursor/skills/ui-taste/` | Frontend spec → build (after backend-rigor) |
| **Obscur modular iteration** | [`skills/obscur-modular-iteration/`](skills/obscur-modular-iteration/SKILL.md) | Explore → spec → simulate → implement; silo/re-integration |
| **Obscur session gate** | [`skills/obscur-session-gate/`](skills/obscur-session-gate/SKILL.md) | **Before every diff** — handoff, bands, proof plan |
| **Obscur subtraction** | [`skills/obscur-subtraction-change/`](skills/obscur-subtraction-change/SKILL.md) | Owner map, retire parallel paths before adapters |
| **Obscur continuity** | [`skills/obscur-context-continuity/`](skills/obscur-context-continuity/SKILL.md) | Checkpoints, handoff close, thread resume |
| **Obscur recovery triage** | [`skills/obscur-foundation-recovery/`](skills/obscur-foundation-recovery/SKILL.md) | Broken core flows — classify, trace, repair order |

**Cursor IDE:** mirrored copies live in [`.cursor/skills/`](../.cursor/skills/) for Skills UI discovery. **Canonical source:** `.agent/skills/` — edit there, then re-copy to `.cursor/skills/` when skill text changes.

## Workflows (referenced by skills)

| Workflow | When |
|----------|------|
| [`workflows/plan-execution-checklist.md`](workflows/plan-execution-checklist.md) | Detailed gates + proof command matrix |
| [`workflows/core-change-checklist.md`](workflows/core-change-checklist.md) | Owner/proof detail during edits |
| [`workflows/context-continuity.md`](workflows/context-continuity.md) | Checkpoint and thread close |
| [`workflows/recovery-triage.md`](workflows/recovery-triage.md) | Core flow broken — triage steps |

## Invocation order

```
solo-dev-defaults (global defaults)
  → obscur-session-gate (refuse if band conflict)
  → obscur-modular-iteration (explore → spec → simulate — vague tasks)
  → backend-rigor (specs + proof layers)
  → obscur-subtraction-change (if touching core domains)
  → implement
  → obscur-context-continuity (close + checkpoint)
```

For UI: **backend-rigor** through verify → **ui-taste** frontend spec → build.

## Domain stops (read handoff for current)

| Domain | Default rule |
|--------|----------------|
| Community / `groups/**` | **PAUSED** — register/study only unless handoff un-pauses |
| AUTH-SESSION-1 / desktop F5 restore | **CANCELLED** |
| Stuck loop ≥3 on same band | Feasibility doc only ([`rules/11`](../rules/11-feasibility-and-modular-safety.md)) |
