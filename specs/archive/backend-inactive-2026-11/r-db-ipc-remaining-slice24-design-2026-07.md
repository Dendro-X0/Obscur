# Design — R-DB-IPC-REMAINING Slice 24

**Status:** Designed · Verified (L1) · 2026-07-30  
**Prior:** [investigation](./r-db-ipc-remaining-slice24-investigation-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 24 — pin remaining ACL allowlist · close non-PAUSED db_* queue
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · R-RELAY
CANONICAL OWNER:      docs + boundary catalog (no product mutate of PAUSED paths)
PROOF BEFORE DONE:    vitest engine-invoke-boundary-catalog (remaining ACL pin)
OUT OF SCOPE:         Group/community code · P2 UI soak execution
```

---

## Keep-set

| # | Change |
|---|--------|
| 1 | Investigation + this design |
| 2 | Boundary catalog: `allow-db-commands` exact remaining set |
| 3 | Charter: non-PAUSED `db_*` refactor **Done**; next = P2 soak or community un-pause |

## Claim language

| May say | When |
|---------|------|
| Non-PAUSED bare `db_*` subtract complete | Inventory + ACL pin green |
| Fixed (group/invite) | **Never** until PAUSED lifted + migrate |
| Fixed (P2 unlock→shell UI) | **Never** without release L3 soak evidence |
