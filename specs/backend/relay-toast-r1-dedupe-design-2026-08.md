# Design — R1 relay toast dedupe / UI throttle

**Date (UTC):** 2026-08-04  
**Parent:** [relay-stability-speed-manual-verify-note-2026-08.md](./relay-stability-speed-manual-verify-note-2026-08.md)  
**Owner:** `native-error-store.ts` · `error-panel.tsx` (display already shows ×N)

---

```text
NEXT ATOMIC STEP:     R1 relay toast dedupe
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      nativeErrorStore
PROOF BEFORE DONE:    L1 native-error-store.test.ts
OUT OF SCOPE:         Claiming faster public relays · Soft L3 · M3 kind-0 publish
```

---

## Problem

`RELAY_CONNECT_FAILED` already coalesces to **one** card (×10 on screenshots). Repeated flaps still **notify UI on every bump**, so the toast feels like spam even though it is one entry.

`RELAY_INIT_FAILED` uses a different code → can stack a second card.

---

## Contract

1. Soft connect/init codes share one coalesce key (`RELAY_SOFT_CONNECT`).  
2. Internal `occurrenceCount` always increments on repeat; latest host message is kept.  
3. **UI notify throttle** default **45s** (`RELAY_UI_NOTIFY_THROTTLE_MS`) for soft merges.  
4. Host message changes (**nos → damus**) do **not** force an immediate re-paint — avoids multi-node flap spam.  
5. Honesty unchanged — still show unreachable host on the card; no SLA claim.

**R1.1 (2026-08-04):** Less intrusive — 8s → 45s; drop force-notify on message change.  
**R1.2 (2026-08-04):** User dismiss (X) snoozes soft relay toast for **15 minutes** (`RELAY_SOFT_DISMISS_SNOOZE_MS`).

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `vitest` · `native-error-store.test.ts` |
