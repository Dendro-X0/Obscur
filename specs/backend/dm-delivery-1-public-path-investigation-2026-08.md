# Investigation — DELIVERY-1 public-path DM (publish ACK / receive)

**Date (UTC):** 2026-08-02  
**Status:** **Live receive Pass (operator)** · F-ACK residual · Soft L3 / delivery not fully claimed  
**Design (live):** [dm-live-req-rearm-design-2026-08.md](./dm-live-req-rearm-design-2026-08.md)  
**CodaCtrl:** issue `verify:issue:agent:9e5bbc9aa9d4a242` · chain `chain-delivery-1-public-dm-2026-08-02`

## Session gate

```text
NEXT ATOMIC STEP:     DELIVERY-1 · F-ACK honesty (publish OK / checkmarks)
PAUSED / CANCELLED:   Dev Lab · Soft L3 lab-only · COM-RUN-* · AUTH-SESSION
CANONICAL OWNER:      dm-send-pipeline · mesh publish waitForOk (F-ACK)
PROOF BEFORE DONE:    Outgoing confirmation honest on live dual-window · Soft L3 claim language
OUT OF SCOPE:         COM-RUN · Relays UI polish
```

## Operator evidence (2026-08-02 · post F-RECV-LIVE)

| Observation | Class |
|-------------|--------|
| Dual-window `test 2` sync · Connected 3/3 · peer ONLINE | **F-RECV-LIVE Pass** |
| Outgoing still single grey check | **F-ACK OPEN** |

## F-RECV-LIVE — Verified runtime

| Bug | Fix | Proof |
|-----|-----|-------|
| REQ not re-armed; EVENT frame wrong | Re-arm + parse `["EVENT", subId, event]` | L1 vitest + operator dual-window |

## Next — F-ACK

Investigate why confirmation stays single-check while peer already received. Likely OK timeout / Phase1 sendToOpen / UI status mapping. Design before patch.
