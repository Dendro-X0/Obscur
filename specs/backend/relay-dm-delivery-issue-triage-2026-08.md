# Triage — DM transmission + relay network issues (2026-08)

**Status:** Active inventory · investigation-only until each row has a probe plan  
**Date (UTC):** 2026-08-02  
**Handoff:** Public-path two-profile DM proof (prod)  
**Charter:** [v1.9.15-scope.md](../../docs/program/v1.9.15-scope.md)  
**Parents:** [relay-pool-delivery-strategy-design-2026-08.md](./relay-pool-delivery-strategy-design-2026-08.md) · Soft L3 [recipe](./relay-pool-delivery-l3-soft-recipe-2026-08.md)

## Session gate

```text
NEXT ATOMIC STEP:     Public-path two-profile DM proof (prod)
PAUSED / CANCELLED:   Dev Lab as validation · Soft L3 lab-only as release evidence · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION
CANONICAL OWNERS:     dm-send-pipeline · dm-relay-transport · relay-primary-selector · relay-publish-scope · conduit-mesh pool
PROOF BEFORE DONE:    Per-row probe below · Soft L3 Row A+B on public path without Docker requirement
OUT OF SCOPE:         Relays UI polish as primary work · claiming public Nostr SLA · COM-RUN membership · AUTH-SESSION
```

**Rule:** Troubleshoot **one open row at a time**. Do not patch UI honesty while DELIVERY-1 is open. Do not reopen PAUSED bands.

---

## Operator screenshot map (2026-08-02)

| Observed | Maps to |
|----------|---------|
| Banner “Relay compatibility … not assessed … sharing a relay” | **UX-1** (`relay-overlap-banner` status `unknown`) — informational; not root cause alone |
| Outgoing `test 1` single grey check | **DELIVERY-1** — pending / no publish ACK (D2 honesty) |
| Prior `S-POOL-L3-…` markers in thread | Historical Soft L3 attempts — **not** a Pass |
| Connected 3/5 or 3/4 active relays | Partial pool OK if publish∩subscribe nonempty |
| Peer OFFLINE | Does not block store-and-forward on shared relay |

---

## Queue (troubleshoot in this order)

| # | ID | Symptom | Status | Spec / evidence | Next action |
|---|----|---------|--------|-----------------|-------------|
| **1** | **DELIVERY-1** | A→B DM sync / ACK | **Live receive Pass (operator)** · **F-ACK OPEN** | [dm-delivery-1…](./dm-delivery-1-public-path-investigation-2026-08.md) · [live REQ](./dm-live-req-rearm-design-2026-08.md) | F-ACK investigation → then R2/R3 |
| 2 | **DELIVERY-2** | Lab Soft L3: S1 drops localhost; remotes fail OK → `lastSuccessfulPublishAtUnixMs` null | **Mitigated L1** (local fallback in `publishToRelays`) · **superseded** as product north star | [dm-local-agreed-path…](./dm-local-agreed-path-publish-fallback-investigation-2026-08.md) | Revisit only if lab assist needed after DELIVERY-1 |
| 3 | **EVIDENCE-1** | UI “sent” without relay OK | **L1 Implemented** (D2) | [dm-publish-ack-honesty…](./dm-publish-ack-honesty-investigation-2026-08.md) | Verify still honest under DELIVERY-1 soak |
| 4 | **DIAL-1** | Basic + live local primary starves public remotes | **L1 Implemented** (E2d) | [relay-basic-local-primary…](./relay-basic-local-primary-starves-remotes-investigation-2026-08.md) | Confirm both profiles show public POOL MEMBER before soak |
| 5 | **VIS-1** | Relays UI hid public cards / loopback-only list | **Soak OK** (visibility) · delivery not claimed | [relays-ui-public-pool…](./relays-ui-public-pool-visibility-investigation-2026-08.md) | Hold — no more UI polish |
| 6 | **READY-1** | publish-ready 0 / Switching while socket open (lab mesh) | **Investigated** · repairs listed | [relay-warmup-readiness…](./relay-warmup-readiness-honesty-investigation-2026-08.md) | After DELIVERY-1 if still seen on public path |
| 7 | **UX-1** | Overlap banner `unknown` / `no_overlap` | **Open (info)** | `relay-overlap-banner.tsx` · `use-contact-relay-overlap` | After DELIVERY-1: assess whether peer relay list is never populated |
| 8 | **ENV-1** | Soft L3 Blocked — second profile unlock / compose | **Env / tooling** | Handoff Soft L3 Blocked rows | Operator dual-window unlock; not a transport patch |
| 9 | **FUTURE-1** | No NIP-65 outbox / inbox discovery | **Design only** | Delivery strategy §4.1 Phase 2 · v1.9.15 F2 | Charter later — not this queue |
| — | **PAUSED** | Community / COM-RUN / AUTH-SESSION | **Do not touch** | Handoff | Register/study only |

**S1–S4** (publish scope, primary promote, publish-path UI, CM scoped) are **L1 Implemented** — treated as closed for triage unless DELIVERY-1 reproves a regression.

---

## Physics (settled)

Nostr delivery requires **publish target ∩ peer subscribe set** nonempty. Identical Settings screens are neither necessary nor sufficient. Obscur DMs today are shared-pool (A), not NIP-65 outbox (B).

---

## §1 — DELIVERY-1 probe plan (active)

### Claim under test

On **two production profiles**, with Tor off, prefer public remotes (`wss://relay.primal.net`, `wss://nos.lol`); demote/disable `localhost:7000` for the soak:

1. **Row A:** Both show ≥1 open **public** pool member (not local-only).  
2. **Publish ACK:** After send, sender gets `onConfirmed.success === true` **or** bubble leaves pending with honest failure — and if success, activity shows `lastSuccessfulPublishAtUnixMs` set (mesh stamp on `publishToUrls` success).  
3. **Row B:** Peer thread shows unique marker ≤45s.

### Discriminators (pick exactly one Fail class)

| Fail class | Evidence | Likely owner |
|------------|----------|--------------|
| **F-ACK** | Marker local-echo only; confirmation `success: false` / `no_relay_ok_ack`; timestamp null | `pool.publishToUrls` / mesh Nostr publish OK path |
| **F-TARGET** | Publish succeeds on URL set peer does not subscribe | `resolveTargetRelayUrls` / S1 scope / dial membership mismatch across profiles |
| **F-RECV** | Publish ACK OK on shared URL; peer never shows marker | Inbound subscribe / DM receive pipeline / peer trust / decrypt |
| **F-DIAL** | Public remotes still STANDBY while local carries traffic | E2d regression — DIAL-1 |
| **F-ENV** | Second profile cannot unlock / open compose | ENV-1 — stop transport work |

### Canonical path to instrument

```text
sendDm
  → sendToOpen (assist only; D2: not success)
  → resolveTargetRelayUrls (+ S1 scoped publish)
  → publishToRelays
       → publishToUrls (intersect open)
       → optional local agreed-path retry (lab)
       → publishToAll / sendToOpen (no fake ACK)
  → buildSendConfirmation(publishSuccess only)
  → onConfirmed → UI checkmarks
```

Mesh stamp: `use-conduit-mesh-relay-pool` sets `lastSuccessfulPublishAtUnixMs` **only when** `publishToUrls` reports `result.success`.

### Operator steps (minimal)

1. Both profiles: Relays → Default Stable / public pack; **disable localhost** for this soak.  
2. Confirm Relays cards: primal and/or nos **POOL MEMBER / open** on **both**.  
3. Accept contact if Chats shows peer but ceremony/trust incomplete.  
4. Send marker `PUBLIC-DM-YYYYMMDD-HHMM` from A→B.  
5. Record: bubble state · console `[dm-send] confirmed` · Relays last publish · B thread within 45s.  
6. Classify F-ACK / F-TARGET / F-RECV / F-DIAL / F-ENV.  
7. Write one short investigation addendum under that Fail class — **no code** until class is pinned.

### Claim language

| May say | When |
|---------|------|
| Triaged | This doc |
| Investigated (DELIVERY-1) | Fail class pinned with evidence |
| Implemented | Spec slice matching Fail class + L1 |
| Soft L3 / delivery **Pass** | Row A+B public path · recipe Pass · no Docker required |
| Public Nostr **fixed** | **Never** from one soak |

---

## §2–§N — deferred probes

| ID | When to open |
|----|----------------|
| DELIVERY-2 | Only if public soak needs lab assist and local fallback fails |
| UX-1 | After one successful public ACK: check whether overlap stays `unknown` forever |
| READY-1 | If public path shows publish-ready 0 with open sockets |
| FUTURE-1 | Separate charter after Soft L3 Pass |

---

## References

- [dm-publish-ack-honesty-investigation-2026-08.md](./dm-publish-ack-honesty-investigation-2026-08.md)  
- [dm-local-agreed-path-publish-fallback-investigation-2026-08.md](./dm-local-agreed-path-publish-fallback-investigation-2026-08.md)  
- [relay-basic-local-primary-starves-remotes-investigation-2026-08.md](./relay-basic-local-primary-starves-remotes-investigation-2026-08.md)  
- Owners: `dm-send-pipeline.ts` · `dm-relay-transport.ts` · `use-conduit-mesh-relay-pool.ts` · `relay-overlap-banner.tsx`
