# Investigation — P1-O4b Soft L3 peer demote + Requests pending (2026-11-08)

```text
HANDOFF ATOMIC STEP: P1-O4b Soft L3 peer demote notify + Requests pending (DM residue)
PAUSED / CANCELLED: Soft L3 Fixed · Tor · Matrix promote · Continuity · packaged Pass
CANONICAL OWNER: request-transport.notifyPeerConnectionEnded ·
  applyIncomingContactLifecycle · use-requests-inbox (upsertIncoming / merge) ·
  Soft L3 exclusive listen (:7000 open)
PROOF BEFORE DONE: L1 unit (cancel demote + accepted→pending reopen) ·
  L2 Soft L3 dual CDP remove→peer Network 0→reconnect→Requests (N)
```

## Evidence (P1-O4 Partial)

Source: `docs/handoffs/contact-soft-l3-remove-reconnect-l2-soak-2026-11-08.md`

| Observation | Implication |
|-------------|-------------|
| T1 Remove UI Pass; T2 Network still `TRUSTED` | Peer cancel demote did not land (or was undone) |
| T2 often `Connecting 0/1` / runtime `open=[]` while intent=`local_dev_mesh` | Soft L3 gift-wrap cancel may never be ingested |
| T1 Invitation delivered Pass; T2 `NO OPEN REQUESTS` | Reconnect request not surfacing Requests inbox |
| Hello in DM + intermittent `Request accepted` / `Contact accepted` | Sandbox/thread path + sticky accepted / auto-accept residue |

## Architecture (unchanged owners)

| Concern | Owner |
|---------|--------|
| Wire end notify | `notifyPeerConnectionEnded` → `t=connection-cancel` via `sendDm` |
| Peer apply | `applyIncomingContactLifecycle` → `demotePeerRelationship` (`unacceptPeer` + inbox `remove`) |
| Requests reopen | `use-requests-inbox` `shouldIgnoreIncomingForExistingRequest` — accepted allows reopen on **distinct** `eventId` |
| Soft L3 listen | exclusive intent + runtime open on `ws://localhost:7000` |

## Hypotheses

### H1 — Soft L3 cancel never delivered (primary for demote Fail)

- **Mechanism:** At Remove time T2 is not open on `:7000` (`Connecting 0/1` / `open=[]`). Cancel gift-wrap publishes to Soft L3; T2 never decrypts → never `connection-cancel` → stays TRUSTED.
- **Falsify:** L2 with both windows Soft L3 **open** (1/1) before Remove; assert T2 trust demotes without storage repair. If still TRUSTED with proven open+ingest, H1 false.

### H2 — `demotePeerRelationship` early-return skips `CONTACT_REMOVED`

- **Mechanism:** When `requestsInbox.remove` exists, function returns before `appendCanonicalContactEvent(CONTACT_REMOVED)`. Projection / hydrate can keep peer accepted-looking even after `unacceptPeer`.
- **Falsify:** Unit — after cancel apply with `remove` present, projection/canonical must still record removal OR hydrate must not resurrect. Code already calls `unacceptPeer` before early return; H2 is secondary if `removedPeers` sticky holds.

### H3 — Sticky `accepted` inbox blocks Requests pending without distinct eventId

- **Mechanism:** Merge prefers legacy `accepted` over pending projection. If cancel never cleared inbox accepted, reconnect `upsertIncoming` needs distinct `eventId` to reopen. Missing/reused id → ignore → Hello can still land as sandbox DM without Requests card.
- **Falsify:** After forced demote+inbox remove, reconnect must show `Requests (1)`. If Hello arrives and inbox still empty with fresh eventId, H3 false → look at sandbox vs lifecycle routing.

### H4 — Auto-accept / pending-accept queue fires without Requests chrome

- **Mechanism:** Soft L3 later opens + public bleed (`Connected 2/2`) delivers stale accept or local Accept residue → toast without Requests (N).
- **Falsify:** Soft L3 sole open throughout; no Accept click; no toast unless user Accepts from Requests.

## Working root cause (updated 2026-11-09 Soft L3 dual CDP)

**H1 falsified** for listen-never-open: both peers Soft L3 `writable=1` / `phase=healthy` / sole `enabled=[ws://localhost:7000]` before Remove.

**H5 (publish scope) addressed L1:** exclusive Soft L3 pin in `resolveTargetRelayUrls`. Relay watch confirms cancel kind `1059` lands on `:7000` at Remove after rebuild `shell-2026-11-09T04:31:17Z`.

**H6 primary for remaining demote Fail:** Soft L3 reports `healthy` + `writable=1` with **`activeSubscriptionCount=0`**. Live cancel is published; peer does not ingest. Lookback REQ can still apply historical cancel/accept and **flap** trust (seed accept → demote → accept within seconds).

**H3 likely coupled** for Requests Fail once live demote is reliable. H2 still a subtractive guard if hydrate resurrects after proven cancel ingest.

Design (publish): `specs/backend/p1-o4b-soft-l3-exclusive-cancel-publish-design-2026-11-08.md` · L1 Pass  
Handoff: `docs/handoffs/p1-o4b-soft-l3-exclusive-cancel-publish-2026-11-08.md`  
**H6a design:** `specs/backend/p1-o4b-soft-l3-subscribe-honesty-design-2026-11-08.md` — mesh pool stub zeros count; wire honest `getActiveSubscriptionCount`.  
**NEXT after H6a L1 + user soak:** if still real `activeSubs=0` → H6b; else lookback idempotency + H3 Requests.

## Non-causes

- Missing Remove UI path (confirmRemove already notifies)
- Soft L3 Apply intent write (intent=`local_dev_mesh` observed)
- Public-plane Requests Pass (2026-11-07) — Soft L3 surface is the owed prove

## Proof plan

1. **L1** — unit: cancel → demote + inbox remove; accepted + distinct eventId → pending reopen; accepted + same eventId → ignore.
2. **L2 Soft L3** — wait both `openLocal` on `:7000` → T1 Remove → T2 Network 0 / not TRUSTED (no storage repair) → T1 invite → T2 `Requests (N>0)` before any Accept.
3. Do **not** claim Soft L3 contact rows 1–3 Pass until L2 Pass without demote repair.

## NEXT

1. Bring Soft L3 dual CDP; probe cancel delivery with open wait.
2. If H1 confirmed: fix Soft L3 listen-before-mutate / retry cancel, not UI.
3. If demote Pass but Requests Fail: design H3 subtractive (inbox scrub on cancel always; reopen path).
