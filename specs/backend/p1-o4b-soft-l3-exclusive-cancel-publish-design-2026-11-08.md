# Design — Soft L3 exclusive cancel publish scope (P1-O4b) (2026-11-08)

```text
HANDOFF ATOMIC STEP: P1-O4b Soft L3 peer demote notify + Requests pending
PAUSED / CANCELLED: Soft L3 Fixed · Tor · Matrix promote · Continuity · packaged Pass
CANONICAL OWNER: resolveTargetRelayUrls (dm-relay-transport) · mirror isHttpOnlyMeshTransportPool
PROOF BEFORE DONE: L1 Soft L3 exclusive ignores peer public evidence ·
  L2 Soft L3 dual CDP Remove → T2 Network demote (no storage repair)
```

## Problem (L2 evidence)

Probe `tmp/p1-o4b-soft-l3-cancel-demote-probe.mjs` (run2):

| Fact | Value |
|------|--------|
| Soft L3 open both | `enabled=[ws://localhost:7000]` · `writable=1` · `phase=healthy` |
| T1 Remove | Pass — T1 CONNECTIONS drops Tester 2 |
| T2 Network | Fail — still `TRUSTED` Tester 1 |
| T2 trust | `acceptedPeers` still has T1 · `removedPeers=[]` |
| Cancel lifecycle | No ingest — `request_flow_evidence.acceptSeen` still true · no cancel storage hits |
| UI residue | T2 "Their relay: nos.lol" / Possible delivery issue |

**H1 (listen never open) falsified for this run.** Soft L3 was healthy. Cancel still never demoted.

## Root cause (H5)

`resolveTargetRelayUrls` hybrid-unions peer NIP-65 / inbound evidence (often `wss://nos.lol`) with sender Soft L3. HTTP-only mesh already short-circuits:

```ts
if (isHttpOnlyMeshTransportPool(configuredSenderRelayUrls)) {
  return dedupeRelayUrlList(configuredSenderRelayUrls);
}
```

Soft L3 WS exclusive (`ws://localhost:7000` only) has **no** equivalent. Then `resolveScopedPublishRelayUrls` drops "offline" local when `pool.connections` lacks `status==="open"` (supervisor healthy/writable does not populate that array) → cancel publishes to public remotes T2 is not listening on under exclusive Soft L3.

## Invariant

When the sender's configured/enabled pool is **sole Soft L3 local WS lab** (`isLocalDevWorkspaceRelayUrl` for every configured URL), publish targets **must** be that lab only — ignore peer public evidence and DM public fallbacks. Same contract as HTTP-only mesh.

## Contract

| Input | Output |
|-------|--------|
| configured = `[ws://localhost:7000]` (+ peer evidence nos.lol) | `[ws://localhost:7000]` |
| configured = `[ws://localhost:7000, wss://nos.lol]` | hybrid (unchanged — not exclusive Soft L3) |
| configured = `[http://127.0.0.1:8788]` | HTTP-only short-circuit (unchanged) |

## Implementation (subtractive / mirror)

1. Add `isExclusiveLocalDevMeshTransportPool(configuredRelayUrls)` next to `isHttpOnlyMeshTransportPool`.
2. In `resolveTargetRelayUrls`, early-return configured URLs when exclusive Soft L3 (before hybrid + fallbacks).
3. Do **not** change public hybrid behavior when remotes are enabled.
4. Optional follow-up (not this slice): teach `resolveScopedPublishRelayUrls` to honor writable snapshot when `connections[]` is empty — only if L2 still fails after (1–2).

## Non-goals

- Claiming Soft L3 contact rows Pass / Soft L3 Fixed
- Tor / Matrix / packaged
- H3 Requests reopen (after demote Pass)

## Proof

| Layer | Gate |
|-------|------|
| L1 | `dm-relay-transport.test.ts` — Soft L3 exclusive ignores peer evidence |
| L2 | Re-run `tmp/p1-o4b-soft-l3-cancel-demote-probe.mjs` — `peerDemoted=true` without trust repair |

## Status

- **L1:** Pass (2026-11-09) — `dm-relay-transport.test.ts` 11
- **L2 demote:** Partial — cancel publishes to Soft L3; peer demote blocked by **H6** (`activeSubs=0` while healthy). See investigation H6 + handoff.

## NEXT after Pass

1. Soft L3 subscribe honesty design (H6) — then re-prove demote L2.
2. H3 design: inbox scrub + Requests (N) after Soft L3 reconnect invite.
