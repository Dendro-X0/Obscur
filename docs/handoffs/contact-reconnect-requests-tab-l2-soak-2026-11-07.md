# L2 soak — reconnect Requests pending card (2026-11-07)

- **Verdict:** **L2 Pass** (Requests pending card after post-remove reconnect)
- **Shell:** `pnpm dev:desktop -- --rebuild` · stamp `shell-2026-11-07T11:29:25Z`
- **CDP:** `:9230` Tester1 · `:9231` Tester2 (profile-2)
- **Sessions:** `csess-a0d09c84ec09` · `csess-2b0864a7dcc1`
- **JSON:** [`contact-reconnect-requests-tab-l2-soak-2026-11-07.json`](./contact-reconnect-requests-tab-l2-soak-2026-11-07.json)
- **Fix L1:** handshake `accepted→CANCEL` · cancel prefers `remove` · merge prefers projection incoming pending

## Setup honesty

Prior delete/reconnect soak left Tester1↔Tester2 as strangers with DM thread residue (`Connection removed` + older Hello). This soak sent a **fresh** invitation on the rebuilt shell that includes the Requests-tab fix.

## Results

| Step | Result |
|------|--------|
| Tester1 Discovery Exact Match OBSCUR-99RKDH | Pass |
| Send Invitation | Pass — **Invitation delivered** (`cap-eb3e48fb9cd6`) |
| Tester2 Requests tab | Pass — **Requests (1)** · Tester 1 “New Just now” (`cap-ffa9a0d34cb3`) |
| Tester2 thread Accept/Decline | Pass — connection-request chrome + Hello Just now |
| Not empty while Hello in thread | Pass — closes prior Partial |

## Ladder

Dual webview2-cdp sessions. Soft L3 / Tor / Matrix **not** claimed.

## Claim language

- May say: L2 Pass — reconnect invitation surfaces Requests pending card on rebuilt static-dev
- Must not say: Soft L3 / Tor Verified / packaged NSIS L2
