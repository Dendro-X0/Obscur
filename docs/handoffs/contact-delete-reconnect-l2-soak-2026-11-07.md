# L2 soak — contact delete / reconnect + Discovery clear (2026-11-07)

- **Verdict:** **L2 Pass** (handshake residue) · Requests-tab pending card **Partial**
- **Shell:** `pnpm dev:desktop -- --rebuild` · stamp `shell-2026-11-07T04:28:28Z`
- **CDP:** `:9230` Tester1 · `:9231` Tester2
- **JSON:** [`contact-delete-reconnect-l2-soak-2026-11-07.json`](./contact-delete-reconnect-l2-soak-2026-11-07.json)

## Setup honesty

Device slot had **Tester1** only (no DemoUser). Soak used **Tester1 → Remove/Connect → Tester2** for the same bilateral claim as the DemoUser↔Tester1 verify plan.

## Results

| Step | Result |
|------|--------|
| Trusted → Remove | Pass — Network 0 · toast Connection removed |
| Peer sees cancel | Pass — thread **Connection removed** · Network 0 |
| Discovery → Send Invitation | Pass — **Invitation delivered** |
| Not silent ignore | Pass — peer thread shows new Hello after remove |
| Requests inbox pending card | Partial — reconnect arrived in existing DM thread; Requests/Invitations empty |
| Clear history | Pass — Recent Searches cleared (`cap-442b544cd8df`) |

## Ladder

`clientSatisfied=true` on dual webview2-cdp sessions (OFP2). Soft L3 / Tor / Matrix **not** claimed.

## Follow-ups (optional)

1. Requests-tab surface for post-remove reconnect when a DM thread already exists.
2. Repeat on packaged NSIS once shell stamp ships.
3. DemoUser fixture restore if operator wants literal DemoUser↔Tester1 labels.
