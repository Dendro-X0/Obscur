# Investigation — F-ACK checkmark honesty (post F-RECV-LIVE)

**Date (UTC):** 2026-08-02  
**Handoff step:** DELIVERY-1 · F-ACK honesty (publish OK / checkmarks)  
**Parent:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md) · prior D2 [dm-publish-ack-honesty-design-2026-08.md](./dm-publish-ack-honesty-design-2026-08.md)  
**Runtime context:** F-RECV-LIVE operator Pass (dual-window live sync); residual described as “outgoing bubbles stay single grey check.”

---

## Session header

```text
NEXT ATOMIC STEP:     DELIVERY-1 · F-ACK honesty (publish OK / checkmarks)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation · AUTH-SESSION
CANONICAL OWNER:      message-list status map · dm-controller handleConfirmed · dm-send-pipeline confirmation
PROOF BEFORE DONE:    L1 status-map / send confirmation tests · dual-window operator: Clock→single Check on OK (not Soft L3 claim alone)
OUT OF SCOPE:         Community · AUTH-SESSION · claiming Soft L3 Pass · F-TARGET / F-DIAL soak
```

---

## Symptom (operator language)

After live A↔B sync works, outgoing bubbles often show a **single grey check**. Handoff treated this as F-ACK residual (publish confirmation UI / OK path broken).

---

## Canonical UI map (DM compose — source of truth)

`apps/pwa/app/features/messaging/components/message-list.tsx`:

| `MessageStatus` | Icon | i18n label |
|-----------------|------|------------|
| `sending` | Clock (pulse) | sending |
| `accepted` | **single** `Check` | sent |
| `delivered` | **double** `CheckCheck` | delivered |
| `failed` / `rejected` | AlertTriangle | failed |

**Note:** `packages/ui-kit` `MessageStatus` inverts accepted/delivered icons relative to this map. DM bubbles use **message-list**, not ui-kit — do not triage from ui-kit alone.

---

## Canonical status writers

1. **Optimistic insert** — `dm-controller` → `sending`.
2. **Phase-1 return with `onConfirmed`** — stays `sending` (`immediateStatus` only `accepted` when `result.success`; D2 honesty returns `success: false` until confirm).
3. **`handleConfirmed`** — `confirmation.success` → `accepted`; else `failed` (+ toast; `partialWireDelivery` warning when wire fired without OK).
4. **Self-echo / self-authored receive** — forces `delivered` when echo is applied.

D2 L1 already landed: `buildSendConfirmation` requires publish OK; Phase-1 `sendToOpen` is assist only.

---

## Root-cause pin (this residual)

### Misread: single grey check ≠ “ACK missing”

Under message-list semantics, **single Check = `accepted` = relay publish OK confirmed**. That is the **Pass** glyph for F-ACK / D2 honesty, not the Fail glyph.

Fail glyphs for F-ACK:

| Observed | Meaning |
|----------|---------|
| Clock sticks while peer already has plaintext | Publish OK never applied / confirmation hung |
| Triangle / failed while peer has plaintext (no honest `partialWire` toast) | Dishonest fail or wrong path |
| Instant `accepted` with `lastSuccessfulPublishAtUnixMs` still null on writable pool | Pre-D2 fake success (should be gone on honesty path) |

### Adjacent (not F-ACK Fail): double check rarely appears

Send path pre-registers the wire event id:

`dmReceivePipelineInternals.markProcessed(dedupSet, build.signedEvent.id)` in `dm-send-pipeline`.

Receive then skips the same id as dedup → **`self_echo` never runs** → status never upgrades `accepted` → `delivered`.

So after a healthy send+OK, the bubble **correctly stays on single Check** forever for that event id. Operator “stuck on single check” after sync is **consistent with F-ACK Pass**, not evidence of missing OK.

Call this adjacent class **F-ECHO** (delivered upgrade / self-echo swallowed) if product wants double-check = “seen back from relay.” Out of F-ACK Pass gate unless maintainer redefines honesty to require double-check.

### Race note (if F-ECHO is fixed later)

`self_echo` currently sets `delivered` whenever existing status ≠ `delivered`, including overwriting `accepted`. With message-list icons that is an **upgrade** (single → double). Do **not** overwrite `failed` with `delivered` without an explicit design (would hide honest fail).

---

## Non-causes (this slice)

- F-RECV-LIVE REQ re-arm / EVENT frame parse — already operator Pass.
- Soft L3 harness Row B alone — release still forbids lab-only claim; separate from glyph semantics.
- ui-kit MessageStatus mapping — not what DM list renders.

---

## Pass / Fail for F-ACK (operator dual-window)

**Pass** when, on production-parity dual windows after a new live send that the peer receives ≤45s:

1. Sender bubble leaves **Clock** and shows **single Check** (`accepted`) within the publish-OK window (default ~8s `connectTimeoutMs`), **or** shows failed + honest toast if OK truly fails.
2. Optional corroboration: Relays / supervisor evidence of successful publish when status is `accepted` (not required to rename this Pass if (1) holds and peer receive holds).

**Fail** when peer has the marker and sender stays on **Clock** past the OK window, or lands **failed** without `partialWireDelivery` honesty when Phase-1 clearly fired.

**Do not** require double Check for F-ACK Pass (that is F-ECHO).

---

## Fix direction

| Outcome | Action |
|---------|--------|
| Operator confirms Clock → single Check on live sends | Mark **F-ACK Pass**; advance release queue to **R2** dial soak; optionally register F-ECHO as deferred |
| Operator sees Clock stuck / dishonest fail | Design smallest slice: confirmation apply / timeout / target URL — **no** echo-dedup change in that slice |
| Maintainer wants double Check as “sent” | Separate **F-ECHO design**: allow status-only self-echo when dedup already holds event id; never invent `accepted` from echo alone |

**No code in this investigation.**

---

## Claim language

- D2 Implemented L1 ≠ F-ACK operator Pass ≠ Soft L3 Pass ≠ delivery fixed.
- F-ACK Pass ≠ double-check / F-ECHO.
- Soft L3 / “delivery fixed” still blocked until charter claim gate (Row A+B + honest checks per recovery doc).
