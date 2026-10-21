# Investigation — Audio attachment visible on sender, missing on peer (2026-08-20)

**Status:** Investigation · no code yet  
**Surface:** Packaged desktop · dual-profile DM  
**Stamp context:** `shell-2026-08-20T16:06:07Z` (sender video local-first fix)

```text
HANDOFF ATOMIC STEP: none — greenfield demo bug
PAUSED / CANCELLED:    none
CANONICAL OWNER:       dm-send-pipeline · dm-relay-transport · dm-receive-pipeline
PROOF BEFORE DONE:     L3 dual-window audio marker with ≥1 shared open relay
```

## Observed (operator screenshots)

| Side | Evidence |
|------|----------|
| Sender → DemoUser | MP3 bubble (`kornevmusic-epic-478847.mp3` @ `cdn.nostrcheck.me`), player 2:00, **single check** (~45m ago) |
| Sender | Video bubble **0:05** mountain preview (local-first path OK) |
| Receiver (DemoUser → Tester2) | Images + video present; **no audio bubble** |
| Receiver | Toast: couldn't reach `relay.damus.io`; footer still "CONNECTED TO RELAYS" |

## Status semantics (code)

| UI | `MessageStatus` | Meaning in v2 controller |
|----|-----------------|--------------------------|
| Clock | `sending` | Phase-1 wire / awaiting OK |
| Single ✓ | `accepted` | `onConfirmed.success === true` (relay OK ACK) |
| Double ✓✓ | `delivered` | Self-echo ingested from relay |

Sender audio shows **single ✓** ⇒ upload + encrypt + **at least one relay OK** succeeded. Failure class is **not** “local-only optimistic without ACK.”

## Upload / render path (ruled out as primary)

- Send path uploads via NIP-96, appends `[fileName](url)` into plaintext, passes `attachments` on optimistic outgoing (`use-chat-actions` → `dmController.sendDm`).
- Incoming events carry **plaintext only**; attachments are inferred later via `extractAttachmentsFromContent` / `normalizeDmConversationMessageRow`.
- `.mp3` + markdown filename classify as `audio`. No audio-specific outbound gate once compose mode is `full`.
- Sandbox blocks attachments only while handshake pending — would fail send, not produce `accepted`.

**Conclusion:** CDN upload and sender bubble are healthy. Peer never materializes the DM (or never receives the event).

## Ranked fail classes (DELIVERY triage)

Aligned with [relay-dm-delivery-issue-triage-2026-08.md](./relay-dm-delivery-issue-triage-2026-08.md):

| Rank | Class | Why it fits |
|------|-------|-------------|
| 1 | **F-TARGET** | OK may have landed only on `relay.damus.io` while peer cannot reach damus; video later OK'd on overlapping `nos.lol` / `primal` |
| 2 | **F-RECV** | Peer trust sticky-accept gap at send time → `stranger_dm_blocked` skip; video after trust hydrate |
| 3 | **F-ACK honesty edge** | Unlikely here (single ✓ already means confirmation success) |
| — | Audio codec / player | Ruled out for *missing bubble* (would still show broken player if event arrived) |

## Discriminator probe (do before any patch)

Both profiles, Tor off, ≥1 **shared** open public relay (prefer `nos.lol` / `primal`; treat damus-only as insufficient):

1. Send unique text marker `AUD-PROBE-<ts>` — peer must show ≤45s.
2. Send short MP3 only — peer must show audio bubble ≤45s; sender should move toward double ✓ when self-echo lands.
3. Expand sender “Show relay URLs” / publish feedback: note which relays OK'd.
4. If (1) Pass and (2) Fail → reopen for audio-specific receive/normalize (unexpected).
5. If both Fail when damus is sole OK → **F-TARGET**; ops fix = wait for shared open relays, not audio UI patch.
6. If both Fail with stranger/pending UI on peer → **F-RECV** / trust; sticky-accept path already patched — retest on current exe.

## Claim discipline

- Do **not** claim “audio send bug fixed” without L3 peer visibility.
- Do **not** patch AudioPlayer / upload MIME until probe classifies Fail as audio-specific.
- Optional later design (only after F-TARGET confirmed often): media sends require multi-relay OK or waitForConfirmation with explicit partial-pool warning.
