# v1.8.10 — Demo / manual verification matrix

**Release:** [v1.8.10-release.md](../../../releases/v1.8.10-release.md)  
**Gate:** [v1.8.10-gate.md](../../../releases/v1.8.10-gate.md)  
**Scope:** [v1.8.10-scope.md](../../../program/v1.8.10-scope.md)

---

## Test D2 — Compaction on operator relay (M10-1) — **new for v1.8.10**

| Step | Actor | Pass criteria |
|------|-------|---------------|
| 1 | A | Send group message; B receives |
| 2 | A | Remove from workspace (kind 5) |
| 3 | Operator | `pnpm operator-relay:compact -- --registry apps/relay-gateway/data/hide-registry.json --db <nostr-rs-relay.sqlite>` (see [operator-relay-compaction.md](../../../../infra/nostr/operator-relay-compaction.md)) |
| 4 | B | New REQ does not receive hidden event from relay storage |

**Record:** `run_id`, `outcome=compact_ok|failed`, config note.

---

## Test P1 — Android install smoke (M10-2)

| Step | Check |
|------|--------|
| 1 | Install APK from `v1.8.10` GitHub Release (or local `pnpm build:android:debug`) |
| 2 | Cold start, unlock, open app shell |
| 3 | No crash on launch; version label shows **1.8.10** |

**Record:** `run_id`, device/emulator, `outcome=pass|failed`.

---

## Regression (optional)

If relay/gateway compaction touches D1 path, re-run [v1.8.9 Test D1](../v1.8.9/README.md).
