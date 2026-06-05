# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T02:00:00Z
- Git SHA: `3b7c5c92`
- Session Status: **v1.9.4 — P4-5 subtraction queue closed**

## North star (read first)

**[ui-render-loop-systemic-program.md](../program/ui-render-loop-systemic-program.md)** — render-loop CI bands R1–R3.

**[obscur-native-sqlite-policy.md](../program/obscur-native-sqlite-policy.md)** — native owner matrix; subtraction queue **closed**.

Manual Phase B matrix **de-prioritized** for loop hunting; product §2–§3 when maintainer chooses.

---

## Committed this session

| SHA | Summary |
|-----|---------|
| `3b7c5c92` | P4-5 — typecheck fixes; ACC-03/04; subtraction queue closed in docs |
| `02f1cb1b` | P4-5 — remove native chat-state DM repair shims |
| `f2f0ee83` | P4-5 — native SQLite list authority; backup restore body strip |
| `a436a168` | API `_api` → `api`, packaging helpers, main-shell UV-RUNTIME-1 test |
| `2a1badf7` | STAB-R — relay/window render loop fix + CI gates |

**Gates @ `02f1cb1b`:** `pnpm verify:stability` + `pnpm release:test-pack -- --skip-preflight` **Pass**

---

## P4-5 subtraction — complete

| Item | SHA / register |
|------|----------------|
| Repair shims removed | `02f1cb1b` |
| Metadata-only sqlite list merge | `f2f0ee83` |
| Native backup restore body strip | `f2f0ee83` |
| Relay checkpoints / call records | **ACC-03/04** in [issues register](../program/unified-verification-issues-register.md) |

Native DM/group message authority is **SQLite-only** on hydrate, list, and restore apply paths.

---

## Next atomic step

1. Commit typecheck fixes + register/policy/handoff sync (this turn).
2. **Phase B product matrix** §1–§7 when maintainer chooses (DM/COM flows — not loop hunting).
3. Optional: shell boot render-count test if launch crashes persist outside CI.
4. v2.0 pipeline: wire per-relay checkpoint owner (ACC-03) and call history persistence (ACC-04).
