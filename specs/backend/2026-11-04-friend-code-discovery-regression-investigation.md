# Investigation: Friend codes / hex show Unknown contact (2026-11-04)

```text
HANDOFF ATOMIC STEP: RECORD DEMO FIRST — discovery P0 for camera path
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote
CANONICAL OWNER: apps/pwa features/search (friend-code-alias · relay-discovery-query · identity-resolver)
PROOF BEFORE DONE: L1 tests · L2 REQ kind 31950 #d=OBSCUR-* · L3 Discovery UI Tester1↔2
SURFACE: Tauri desktop
```

## Symptom (operator evidence)

1. `OBSCUR-WRLKPD` (DemoUser) → Exact Match: **Invite code could not be resolved.**
2. Hex `860b15c3…` → Resolved via hex but title **Unknown contact** (no kind-0 name).
3. Same for Tester1 / Tester2 friend codes (`OBSCUR-5KMPFN`, `OBSCUR-GBKMBC`).
4. Diagnostics: Lookups 0 · INVITE-CODE:ON · DEEP-LINK:ON.

## Expected

- Canonical `OBSCUR-XXXXXX` resolves via NIP-33 alias **kind 31950** (`d` = code) and/or kind 0 with `#i`/`#code` / about embed.
- Hex/npub resolves identity **and** prefers kind 0 `name`/`display_name` when relays have metadata.
- Local OB2/OB3 self-describing codes are a separate path (not these codes).

## Hypotheses (ranked)

| # | Hypothesis | How to falsify |
|---|------------|----------------|
| H1 | Alias events never published (or not re-published after profile rewrite / cache clear) → empty REQ | Query public discovery relays for `kinds:[31950] #d:[OBSCUR-WRLKPD]` |
| H2 | Publish path broken / gated after rewrite (auth/profile publisher no longer signs 31950) | Trace publisher call sites; confirm unlock→publish |
| H3 | Lookup uses wrong relays / pool never opens (Quiet dial cap / no open sockets) | Log `enabledRelayUrls` + `GLOBAL_DISCOVERY_RELAY_URLS` during resolve |
| H4 | Alias present but `parseFriendCodeAliasEvent` rejects (label/`p` mismatch) | Capture raw EVENT; run parser |
| H5 | Hex “Unknown contact” is missing kind 0 only (softer) — identity OK, metadata fetch skipped | Author mode kind 0 for DemoUser hex |

## Non-goals

- Soft L3 / Tor / Matrix promote.
- Redesigning invite UX.
- Committing operator private keys into docs/repo.

## Result (2026-11-04)

| Check | Result |
|-------|--------|
| H1 empty relays | **Confirmed** — 0 events before republish |
| H2 31950 never published | **Confirmed** — `buildFriendCodeAliasUnsignedEvent` had no prod caller |
| Demo republish | **Pass** — kind 0 + 31950 for Tester1/2/DemoUser on nos.lol / primal / damus |
| Code fix | Publisher now emits 31950 + `inviteCode` in kind 0 JSON; hex/npub enrich via author query |

Operator: retry Discovery with `OBSCUR-WRLKPD` / hex (clearnet relays on). Desktop was restarted via `pnpm cache:clear && pnpm dev:desktop`.
