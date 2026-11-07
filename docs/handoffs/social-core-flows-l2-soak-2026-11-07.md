# L2 soak — Social core flows (2026-11-07)

- **Verdict:** **Partial** (4 Pass · 1 Fail · 1 Blocked/Partial) — **superseded for Fail/Blocked by** [`social-core-trust-directory-heal-l2-2026-11-07.md`](./social-core-trust-directory-heal-l2-2026-11-07.md) (Connections/Trusted/Remove Pass after heal)
- **Shell:** `pnpm dev:desktop -- --rebuild` · stamp `shell-2026-11-07T11:31:56Z`
- **CDP:** `:9230` Tester1 · `:9231` Tester2 (profile-2)
- **Sessions:** `csess-3cc275fd0267` / `csess-a0d09c84ec09` · `csess-2b0864a7dcc1`
- **JSON:** [`social-core-flows-l2-soak-2026-11-07.json`](./social-core-flows-l2-soak-2026-11-07.json)
- **Plan:** `specs/backend/2026-11-07-social-core-flows-verify.md`

## L1

19 files / **101 Pass** (DM send · requests/handshake · peer-trust · invite dialog · leave · membership join).

## L2 matrix

| # | Flow | Result | Evidence |
|---|------|--------|----------|
| 1 | Add contact | **Pass** | Invitation delivered → Tester2 Accept (fingerprint confirm) → Requests empty · DM compose open |
| 2 | DM | **Pass** | `mcp-dm-verify-1794052700` visible Tester1 + Tester2 (`cap-05a5510ded10` · `cap-fd69f7506c95`) |
| 3 | Group chat | **Pass** | Create `SocialCoreVerify` (nos.lol Quiet) · send `mcp-group-verify-1794053300` Just now |
| 4 | Invite to group | **Fail** | Invite Connections dialog: **No connections found**; Network Directory Connections **0** while DM thread exists |
| 5 | Leave group | **Partial** | Leave published (`groups.leave_outbox_updated` status=published) · Network Groups count cleared · chat still shows open thread with **0 members** residue |
| 6 | Remove contact | **Blocked** | After accept+DM, Connection Profile shows **Stranger / Connect disabled** · no Remove control (`cap-d681117c0af6`) |

## Findings (honest)

1. **Trust directory mismatch:** Messaging/accept works, but Network Connections list and Invite-from-connections stay empty; profile chrome can show Stranger while DM history remains.
2. **Leave residue:** Creator leave clears membership count / directory group chip but can leave an open group thread pane.

## Ladder

Dual webview2-cdp · Tor OFF. Soft L3 / Tor / Matrix **not** claimed.

## Claim language

- May say: L1 Pass · L2 Partial — add+accept, DM, create/send group, leave publish work on static-dev; invite-from-connections Fail; remove not exercisable this soak
- Must not say: Soft L3 · all six flows Pass · packaged NSIS verified
