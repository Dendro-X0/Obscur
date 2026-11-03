# Design — P4c private_dc L2 lab soak (2026-11)

**Status:** Pass (L2 lab)  
**Parent:** [platform-p4b-private-dc-http-wire-design-2026-11.md](./platform-p4b-private-dc-http-wire-design-2026-11.md)  
**Artifact:** [platform-p4c-private-dc-l2-soak-latest.md](../../docs/handoffs/platform-p4c-private-dc-l2-soak-latest.md)

```text
HANDOFF ATOMIC STEP: P4c private_dc L2 lab soak — DONE Pass
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · private-dc-client + lab server
PROOF:               soak matrix Pass · private-dc-client.l2.test.ts Pass
```

## 1. Goal

Unblock **Private DC L2** without waiting on a company DC: run a **lab-only** HTTP server that speaks the P4b `/v1/conversations` wire, soak the client against it, and record artifacts.

Operator/production DC soak remains a later optional cut (same wire).

## 2. Lab wire (identical to P4b)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/v1/conversations` | Seeded rooms |
| `GET` | `/v1/conversations/{id}/messages` | Seeded + posted |
| `POST` | `/v1/conversations/{id}/messages` | Append + echo canonical message |
| — | Bearer optional | Wrong/missing token → 401 when `requireBearer` set |

Bind: `127.0.0.1` only. Not exposed as a product feature.

## 3. Impl slice

1. `scripts/lib/private-dc-lab-server.mjs` — start/stop + seed.
2. `scripts/platform-p4c-private-dc-l2-soak.mjs` — start lab → fetch matrix → write handoff artifact.
3. Vitest L2: `private-dc-client` against an in-process `http` server (real `fetch`, not `vi.fn`).
4. Update P4b / charter / handoff NEXT.

## 4. Proof

| Layer | Check |
|-------|--------|
| L1 | existing mocked-fetch client/adapter (unchanged) |
| L2 | vitest live localhost + soak script artifact Pass |

## 5. Non-claims

- Not production company-DC interoperability
- Not Soft L3 / Tor Verified / Matrix promote
- Not multi-protocol shipping
