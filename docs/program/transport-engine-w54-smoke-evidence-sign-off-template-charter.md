# Transport Engine W54 — Smoke Evidence Sign-Off Template Charter

**Status:** Charter + template pins (design-only; no smoke execution)  
**Last updated:** 2026-06-26  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Provide a **maintainer sign-off template** for recording W53 manual desktop smoke results before any standalone `-legacy` deletion wave.

W54 is design + contract only — no smoke run, no handoff fill-in.

## Template location (pinned)

`docs/handoffs/transport-engine-smoke-sign-off-template.md`

Maintainers copy sections into `docs/handoffs/current-session.md` (or a dated smoke evidence doc) when smoke completes.

## Required sign-off fields

| Field | Required |
|-------|----------|
| Commit hash | Yes |
| Smoke date (UTC) | Yes |
| `verify:transport-engine-w53` gate | Yes — must be green on smoke commit |
| Env matrix | Yes — authority + network flags recorded |
| Checklist pass/fail | Yes — all 8 W53 steps |
| Evidence notes | Yes — journal source, invoke command, per-relay summary |
| Maintainer decision | Yes — `PASS` or `BLOCKED` |

## Deletion gate

Standalone `-legacy` deletion remains **BLOCKED** until:

1. Sign-off template shows `Decision: PASS`.
2. W48 maintainer gate items satisfied.
3. Separate deletion charter wave (W55+) explicitly approved.

## Non-goals for W54

- No automated smoke execution.
- No pre-filled sign-off in `current-session.md`.
- No standalone owner deletion.

## Contract expectations (pinned in w54 tests)

W54 tests must assert:

- This charter exists and references the sign-off template path.
- Template contains all required fields and W53 checklist mapping.
- `current-session.md` does not contain a completed smoke `Decision: PASS` (template only).

## Sequencing after W54

- W55+ may define standalone deletion charter gated on completed sign-off.
- Production authority/network defaults remain off.
