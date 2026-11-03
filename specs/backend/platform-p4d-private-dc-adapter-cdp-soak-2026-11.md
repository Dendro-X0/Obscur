# Design — P4d private_dc adapter CDP soak (2026-11)

**Status:** Pass (L2 + CDP L3)  
**Parent:** [platform-p4c-private-dc-l2-lab-soak-2026-11.md](./platform-p4c-private-dc-l2-lab-soak-2026-11.md)  
**Artifact:** [platform-p4d-private-dc-adapter-cdp-soak-latest.md](../../docs/handoffs/platform-p4d-private-dc-adapter-cdp-soak-latest.md)

```text
HANDOFF ATOMIC STEP: P4d private_dc adapter CDP soak — DONE Pass
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · private-dc-adapter + lab server + desktop CDP
PROOF:               adapter L2 vitest Pass · CDP matrix all true
```

## 1. Goal

Prove **adapter + session + active protocol** on desktop against the P4c lab `/v1` server — not only the raw client.

## 2. Proof layers

| Layer | Check |
|-------|--------|
| L2 | `private-dc-adapter.l2.test.ts` — live localhost HTTP via adapter (real `fetch`) |
| L3 | CDP: write session → `setActiveProtocolId("private_dc")` → `listConversations` / `sendMessage` through `window.__OBSCUR_PAL_SOAK__` |

## 3. Impl slice

1. Adapter L2 vitest (in-process lab).
2. Desktop-only soak hooks (`pal-soak-hooks.ts`) installed when Tauri present — exposes session write + PAL list/send.
3. `scripts/platform-p4d-private-dc-adapter-cdp-soak.mjs` — start lab → CDP → hooks round-trip → artifact.

## 4. Non-claims

- Not production company DC
- Not Soft L3 / Tor Verified / Matrix promote
- Not multi-protocol Verified
