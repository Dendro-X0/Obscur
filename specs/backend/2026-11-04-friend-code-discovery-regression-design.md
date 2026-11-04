# Design: Restore OBSCUR-* friend-code discovery (2026-11-04)

```text
HANDOFF ATOMIC STEP: RECORD DEMO FIRST — discovery P0
CANONICAL OWNER: use-profile-publisher + identity-resolver + friend-code-alias
PROOF: L1 unit · L2 relay REQ 31950/#i · L3 Discovery UI
```

## Confirmed root cause

Public discovery relays (`nos.lol`, `primal`, `damus`) hold **zero** events for:

- `#d` / `#i` / `#code` = `OBSCUR-WRLKPD|5KMPFN|GBKMBC`
- kind 0 authors = DemoUser hex

So invite lookup correctly returns unresolvable. Hex/npub still “resolves” locally with **empty display** → UI **Unknown contact**.

`buildFriendCodeAliasUnsignedEvent` (kind **31950**) exists but has **no production caller** — only tests. Discoverability today depends entirely on kind 0 + tags + about embed + best-effort mirror.

## Fix (smallest)

1. **Publish path:** After successful kind 0 publish with `inviteCode`, also sign+publish kind 31950 alias to the same scoped set **and** `GLOBAL_DISCOVERY_RELAY_URLS`.
2. **Kind 0 content:** Include `inviteCode` / `code` fields in JSON (parser already reads them).
3. **Resolve path:** For hex/npub success without `display`, best-effort `queryRelayProfiles({ mode: "author" })` to fill name (Unknown contact → real username when metadata exists).
4. **Demo unblock:** One-shot republish script for Tester1/2/DemoUser profiles+aliases to discovery relays (operator keys stay out of git; script args/env only).

## Non-goals

Soft L3 · Tor · Matrix · rewriting OB2/OB3 · committing secrets.
