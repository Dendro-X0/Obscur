# Design — Soft L3 automation Track A (agent-runnable)

**Date (UTC):** 2026-08-02  
**Investigation:** [soft-l3-automation-track-a-investigation-2026-08.md](./soft-l3-automation-track-a-investigation-2026-08.md)  
**Recipe:** [relay-pool-delivery-l3-soft-recipe-2026-08.md](./relay-pool-delivery-l3-soft-recipe-2026-08.md)

---

## Contracts

### App base resolution (`resolvePlaywrightAppBase`)

| Priority | Rule |
|----------|------|
| 1 | `PLAYWRIGHT_BASE_URL` if set |
| 2 | Reachable `http://127.0.0.1:1430` (static production-parity) |
| 3 | Reachable `http://127.0.0.1:3340` (webpack live) |
| 4 | Default `http://127.0.0.1:1430` (honest prod-parity default even if down — preflight fails closed) |

### Soft L3 Pass

```
pass ⇔ !fatal ∧ A_pathHonesty ∧ B_received ∧ B_publishAck ∧ !B_blocked
```

| Field | Meaning |
|-------|---------|
| `B_received` | Tester2 sees marker ≤45s |
| `B_publishAck` | `lastSuccessfulPublishAtUnixMs != null` **or** console `[dm-send] confirmed` with `success: true` |
| `fAck` | alias of `B_publishAck` in report (Fail class pin) |

Receive without ACK → **Fail** (not Pass), `failClass: "F-ACK"`.  
Unlock / compose missing → **Blocked** (unchanged).

Optional override: `OBSCUR_SOFT_L3_ALLOW_RECEIVE_WITHOUT_ACK=1` for legacy debug only (must log warning; never default).

### Preflight (`--preflight`)

Checks only:

1. CDP `:9230` reachable  
2. CDP `:9231` reachable (warn if missing — Edge fallback noted)  
3. Resolved app base HTTP ok  
4. Agreed relay TCP/WS probe when local (`:7000`)  

Exit `0` when CDP A + app base ok (B optional warn). Exit `1` with JSON recipe when not. **No unlock, no send.**

### Sandbox catalog

Add `stress.obscur.soft_l3.public_dm@1` → proof command `pnpm verify:s-pool-delivery-l3` · tags delivery, dual-window, f-ack · symptomClasses `F-ACK`, `F-RECV`, `false-green-runtime`.

---

## Mental simulation

1. Maintainer runs `pnpm dev:desktop:online` (static `:1430`, CDP `:9230`).  
2. Agent runs preflight → green or fail-closed with “start dual CDP / rebuild shell”.  
3. Agent runs Soft L3 → report `l3.pass` / `fAck` / `failClass`.  
4. Maintainer never opens second window for this claim.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `node --test scripts/lib/resolve-playwright-app-base.test.mjs` (or vitest if repo standard) |
| L1 | `pnpm verify:s-pool-delivery-l3:preflight` against live stack (or exit 1 when down — still “implemented”) |
| L2/L3 | Full Soft L3 when dual CDP up — **agent-owned**; not required for Track A Implemented |

**Claim:** Track A Implemented ≠ Soft L3 Pass ≠ delivery fixed.
