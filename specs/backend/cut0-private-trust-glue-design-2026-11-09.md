# Design — Cut 0 private-trust glue (post-0.10)

**Date:** 2026-11-09  
**Status:** L1 Pass · headless H-dc soak Pass (≠ Soft L3)  
**Parent:** Cut 0 spine · lab checklist

```text
HANDOFF ATOMIC STEP: privateTrust glue — seal → outbox → home ACK; headless H-dc soak
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote
CANONICAL OWNER:     libobscur::protocol::e2ee::t3_hdc_pipeline · engine privateTrust
PROOF:               L1 Rust · headless scripts/cut0-lab-hdc-t3-soak.mjs (≠ Soft L3)
```

## Goal

Make Cut 0.10 checklist steps 4–8 **callable** without Soft L3 UI:

1. CRM edge upsert/list via `engine_invoke`  
2. T3 seal → outbox enqueue → opaque envelope for H-dc POST  
3. Home ACK → `accepted` + clear outbox  
4. Headless loopback soak against lab `/v1`

## Non-goals

- Soft L3 contact Pass · X3DH multi-device Sesame · UI Vite migrate · public carriers

## Contracts

| Engine | Method | Effect |
|--------|--------|--------|
| `privateTrust` | `upsertRelationshipEdge` | sticky CRM write |
| `privateTrust` | `listRelationshipEdges` | sticky CRM read |
| `privateTrust` | `prepareT3Outbound` | ensure DR blob · seal · outbox · status sending |
| `privateTrust` | `completeT3HomeAck` | `apply_home_ack` (accepted≠delivered) |

TS H-dc client (0.6) remains the HTTP owner; glue does not dial the network.

## Proof

| Layer | Gate |
|-------|------|
| L1 | pipeline + engine_invoke tests |
| L2 headless | lab server health · POST envelope · poll since= · ACK accepted mapping |
| L3 | optional dual-profile desktop — not this slice |
