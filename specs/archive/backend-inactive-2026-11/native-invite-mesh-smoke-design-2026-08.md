# Design — Native connection-request invite smoke (pre-W66)

**Date (UTC):** 2026-08-04  
**Depends on:** [invite-publish-mesh-retarget-design-2026-08.md](./invite-publish-mesh-retarget-design-2026-08.md) (**Implemented**)  
**Soft L3:** Blocked this session (CDP harness hangs) — DM mesh owner unchanged; invite smoke is independent L3 for W66 gate.

---

## Session header

```text
NEXT ATOMIC STEP:     Native invite smoke → W66 readiness (after Soft L3 Blocked)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      invite-manager → configureInviteRequestTransportBridge → pool.publishToUrls
PROOF BEFORE DONE:    L3: connection request publish evidence on Tauri (mesh, not standalone)
OUT OF SCOPE:         W66 file delete · community U6 · Soft L3 DM re-proof (parallel)
```

---

## Goal

Prove one **connection request** (friend invite) publishes via **mesh** `pool.publishToUrls` on production-parity desktop, so W66 thin-port / standalone deletion cannot break invites.

Not community invite role (`verify:u6-l3` — PAUSED band).

---

## Recipe (manual / agent CDP)

### Preconditions

1. `pnpm dev:desktop:online` · CDP `:9230` · lab relay `:7000` optional (public remotes OK for invite smoke if mesh dials)
2. Tester1 interactive shell (Settings/Chats chrome OK even if session snapshot says locked)
3. Peer: Tester2 pubkey or friend code known

### Steps

1. Open peer `/network/<tester2_hex>` or search friend code → **Message** / connection request UI
2. Send connection request with short marker `INV-MESH-<id>`
3. Evidence (any one):
   - Console: `[dm-relay-transport]` / `publishToUrls` success for invite EVENT
   - OR relay lab sees EVENT from Tester1
   - OR Tester2 Requests shows pending from Tester1
4. Negative: no call stack / log mentioning `publishToUrlsStandalone`

### Automation (optional follow-up)

Thin script `scripts/invite-mesh-smoke-desktop.mjs` — attach CDP, open peer, click request, assert console/mesh. Only after Soft L3 CDP locator hangs are reduced (evaluate-first).

---

## Claim language

| May say | When |
|---------|------|
| **Invite smoke Pass** | Marker request + mesh publish evidence; no standalone |
| **W66 ready** | Invite smoke Pass + maintainer PASS sign-off env |
| Soft L3 Pass | Separate DM recipe — not required for W66 if invite smoke Pass |

---

## Status

**Invite smoke Pass** (agent, 2026-08-04) — `pnpm verify:invite-mesh-smoke` · report `test-results/invite-mesh-smoke-2026-08-04.json` · marker `INV-MESH-msebc0ca` · `[dm-send] confirmed` successCount=1 · no standalone. Route: `/network/profile?pubkey=` (static shell; `/network/<hex>` blanks).
