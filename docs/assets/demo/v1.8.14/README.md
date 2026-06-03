# v1.8.14 — Demo / manual verification matrix

**Release:** [v1.8.14-release.md](../../../releases/v1.8.14-release.md)  
**Gate:** [v1.8.14-gate.md](../../../releases/v1.8.14-gate.md)  
**Scope:** [v1.8.14-scope.md](../../../program/v1.8.14-scope.md)

**Prereq:** Managed workspace (Test 8 style) on operator relay — [v1.8.9 demo](../v1.8.9/README.md).

---

## Automated gates (required before tag)

| Gate | Command |
|------|---------|
| Version sync | `pnpm version:check` |
| Docs | `pnpm docs:check` |
| Release pack | `pnpm release:test-pack -- --skip-preflight` |
| B2 descriptor smoke | included in test pack (`ci:community-bot-descriptor-smoke`) |

---

## Test B2 — Inbound bot keyword (M14-1) — **new for v1.8.14**

| Step | Actor | Pass criteria |
|------|-------|---------------|
| 1 | Steward | Register outbound bot (B1) + enable **keyword trigger** in Manage → Bots |
| 2 | Operator | Run `pnpm community-inbound-bot` with relay env (see [community-inbound-bot.md](../../../messaging/community-inbound-bot.md)) |
| 3 | Member | Post matching keyword in sealed group chat |
| 4 | All | Bot auto-reply appears in thread |
| 5 | Steward | Disable trigger → keyword no longer fires |

**Record:** `run_id`, `outcome=bot_inbound_ok|failed`, trigger type, relay URL.

---

## Test P13 — Sidebar structured preview (M14-2)

| Step | Actor | Pass criteria |
|------|-------|---------------|
| 1 | A | Send community invite DM to B |
| 2 | B | Accept or decline invite |
| 3 | Both | Contacts sidebar shows human preview + correct timestamp (not stale plain text or raw JSON) |

**Record:** `run_id`, `outcome=preview_ok|failed`, preview string observed.

---

## Test P14 — Light theme smoke (M14-3) — optional

| Surface | Pass criteria |
|---------|---------------|
| Group Manage dialog | Readable panels in light theme |
| Community home | Bento cards contrast OK |
| Network profile | Connection status full-width; invite cards readable |
| Auth screen | Primary buttons purple, not blue |

---

## Regression (optional)

- [v1.8.11 Test B1](../v1.8.11/README.md) outbound bot announcement.
- [deferred-manual-verification-checklist.md](../../../program/deferred-manual-verification-checklist.md) §1 P13, §3 bots, §5 MEM-002.
