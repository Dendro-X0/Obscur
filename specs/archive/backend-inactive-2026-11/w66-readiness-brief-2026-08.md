# W66 readiness brief — post invite-mesh smoke

**Date (UTC):** 2026-08-04  
**Handoff:** Maintainer W66 readiness (agents do **not** flip sign-off PASS or run deletion)

---

## Session header

```text
NEXT ATOMIC STEP:     Maintainer W66 readiness
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      transport-kernel standalone legacy subtraction (W66)
PROOF BEFORE DONE:    Decision PASS + deletion env → execute-transport-standalone-legacy-subtraction.mjs
OUT OF SCOPE:         Agent-forged PASS · Soft L3 patch loop · groups/**
```

---

## Agent evidence already green

| Gate | Status | Evidence |
|------|--------|----------|
| Invite → mesh (L1) | **Implemented** | `invite-manager` fail-closed without bridge; no `publishToUrlsStandalone` |
| Invite mesh smoke (L3) | **Pass** | `test-results/invite-mesh-smoke-2026-08-04.json` · marker `INV-MESH-msebc0ca` · `[dm-send] confirmed` · no standalone |
| Web-legacy browser-pool EVENT | **Implemented** | `shouldUseLegacyStandaloneRelayPublish = () => false` |
| Soft L3 DM re-proof | **Blocked** (harness) | Static shell `/network/<hex>` blanks; use `/network/profile?pubkey=` |

Invite smoke is the invite-safety precondition that previously blocked thin-port deletion. It does **not** replace W53 host-publish smoke.

---

## Still required (maintainer only)

Per [W53 runbook](../docs/program/transport-engine-w53-maintainer-smoke-runbook.md) and [W66 charter](../docs/program/transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md):

1. **W53 live desktop publish smoke** (host publish shim journal / multi-relay) — agents do not execute or claim PASS.
2. Flip [transport-engine-smoke-sign-off-recorded.md](../docs/handoffs/transport-engine-smoke-sign-off-recorded.md) to **`Decision: PASS`** with metadata filled.
3. Set `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`.
4. `node scripts/execute-transport-standalone-legacy-subtraction.mjs` (exit 0).
5. W66 mechanical commit steps → `pnpm verify:transport-engine-w67` → `pnpm verify:engine-lab`.

Current recorded sign-off: **`Decision: BLOCKED`**.

---

## Files W66 will delete (when gate opens)

- `transport-kernel-standalone-publish-legacy.ts`
- `transport-kernel-standalone-publish.ts`

Thin port copy into `relay-standalone-publish-port.ts` per charter.

---

## Soft L3 residual (optional, not W66)

`openPeer` soft-nav to `/network/<hex>` fails under `static_shell`. Prefer `/network/profile?pubkey=<hex>` (same as invite smoke).

---

## Status

**Agent prep complete** — invite mesh Pass · W12/W24 pins retargeted to mesh bridge · recovery metrics mock/`connections` harden · `pnpm verify:transport-engine-w68` **Pass** (2026-08-04). Awaiting maintainer **Decision: PASS** + deletion env. No W66 file deletion by agent.
