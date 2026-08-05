# Investigation — Soft L3 / dual-window assert automation (Track A)

**Date (UTC):** 2026-08-02  
**Handoff:** Maintainer choose · non-manual track → **A**  
**Parent:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md) · CodaCtrl [codactrl-improvement-findings-2026-07.md](../../docs/program/codactrl-improvement-findings-2026-07.md) Round 2026-08-02  
**Existing harness:** `pnpm verify:s-pool-delivery-l3` → `scripts/s-pool-delivery-l3-desktop.mjs` · recipe [relay-pool-delivery-l3-soft-recipe-2026-08.md](./relay-pool-delivery-l3-soft-recipe-2026-08.md)

---

## Session header

```text
NEXT ATOMIC STEP:     Track A — automate Soft L3 / dual-window assert
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation · AUTH-SESSION
CANONICAL OWNER:      s-pool-delivery-l3-desktop.mjs + Soft L3 recipe + sandbox catalog
PROOF BEFORE DONE:    L1 resolve-app-base test · preflight exit codes · Pass requires publishAck
OUT OF SCOPE:         Maintainer clicking · CodaCtrl product MCP fixes outside Obscur · Soft L3 Pass claim without report
```

---

## Goal

Stop release proof from depending on **maintainer dual-window eyes**. Agent (or CI with CDP) runs Soft L3 and gets Pass / Fail / Blocked from a JSON report — including **F-ACK** (publish OK), not receive-only.

---

## What already exists

| Piece | Status |
|-------|--------|
| Dual CDP / Edge Soft L3 script | Exists; Row A path honesty · Row B marker receive ≤45s · Row C CM hint |
| Publish evidence poll | Exists (`lastSuccessfulPublishAtUnixMs` + `[dm-send] confirmed`) but **not required for Pass** |
| F-ACK glyph map | Investigated — single Check = `accepted`; automation can use publishAck as proxy |
| Default `PLAYWRIGHT_BASE_URL` | **`http://127.0.0.1:3340`** — wrong for production-parity static shell (`:1430`) |
| Sandbox catalog Soft L3 scenario | **Missing** (`stress.obscur.soft_l3.public_dm@1` asked in findings) |
| Preflight-only (no soak) | **Missing** — agent cannot fail-closed before long unlock |

---

## Root gaps (subtraction)

1. **False webpack default** — agents attach CDP to Tauri static (`:1430`) while script navigates Edge Tester2 / settings to `:3340` → Blocked / flaky / wrong surface.  
2. **Receive without ACK = green** — Row B Pass = marker visible only; F-ACK residual never fails the report.  
3. **No cheap gate** — full Soft L3 always pays unlock/send cost; agents need preflight (CDP A/B, shell ports, relay).  
4. **Catalog drift** — CodaCtrl sandbox has no Soft L3 public/agreed-path scenario id.

Non-causes this slice: CodaCtrl `client_stack_preflight` requiring `:3340` (Studio product fix — document only); COM-RUN; Dev Lab synthetic send.

---

## Fix direction (design next)

1. Resolve app base: env override → probe `:1430` then `:3340` → default static.  
2. Soft L3 Pass = Row A ∧ Row B receive ∧ **publishAck** (F-ACK). Fail with explicit `fAck: false` when receive without ACK.  
3. `--preflight` / `verify:s-pool-delivery-l3:preflight` — CDP + ports + recipe pointer; no unlock.  
4. Add sandbox catalog scenario wiring to `verify:s-pool-delivery-l3`.  
5. Update Soft L3 recipe claim language.

**No product UI change** unless glyph assert later needs `data-message-status` (deferred).
