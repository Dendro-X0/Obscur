# Design / log — Pre-demo validation (public feedback cut · 2026-11)

**Status:** In progress · cold-run before demo video  
**Parent:** [platform-public-feedback-release-readiness-2026-11.md](./platform-public-feedback-release-readiness-2026-11.md) · [presenter-checklist.md](../../docs/assets/demo/v2.0.0/presenter-checklist.md) · [demo-recording-prod-preflight-design-2026-07.md](./demo-recording-prod-preflight-design-2026-07.md)

```text
HANDOFF ATOMIC STEP: Pre-demo validation — Pass before recording public feedback video
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote · video usable
CANONICAL OWNER:     Maintainer · desktop release surface + dual-profile DM
PROOF:               Sections 2–4 marked Pass · no P0 blockers · honesty VO rehearsed
SURFACE:             Release exe preferred (parity-desktop) · Tor OFF · clearnet private-trust
```

## 1. Why this round

A1–A5 feedback gates are Pass. Before filming the public demo / ask video, run one **prod-parity** cold run so recording does not discover unlock, relay, DM, or honesty-copy failures on camera.

Preflight green ≠ demo-ready. Demo-ready = this log Pass on the binary you will record against.

## 2. Agent L1 ladder (before operator)

| # | Step | Pass when | Result |
|---|------|-----------|--------|
| L1 | `pnpm desktop:demo-preflight` | Script exits 0 | _Pending_ |
| L2 | Build or locate release exe (`pnpm desktop:build:exe` or existing `obscur_desktop_app.exe`) | Exe present · stamp noted | _Pending_ |
| L3 | Honesty surfaces present in tree | download hero · Settings Privacy/Protocols · `/limitations` § feedback non-claims | **Pass 2026-11-03** (A5) |
| L4 | A4 pack already green | focused vitest + allow-dirty preflight | **Pass 2026-11-03** |

## 3. Operator cold run (Tor OFF) — record Pass/Fail

Use two profiles (Tester1 / Tester2) when possible. Mark hitch class on Fail.

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | Launch release exe · unlock → shell · no Import Key loop on warm path | | |
| 2 | Relays Clearnet · ≥1 open · Tor **OFF** | | |
| 3 | DM send/receive dual-profile (or self-thread honesty) | | |
| 4 | Settings → Protocols: Obscur-Nostr production · Matrix/Private DC lab wording | | |
| 5 | Settings → Privacy: Hide-on-this-device / retention local-only wording | | |
| 6 | Hide one DM locally · peer still has copy (honesty beat — do not claim erase-everywhere) | | |
| 7 | Optional: 1:1 **voice** dial · dock usable · **do not** open camera/video as product | | Skip OK |
| 8 | Optional: Managed workspace create/invite on Docker/VPS stack · or Skip if stack down | | Skip OK |
| 9 | Soft nav · quit + relaunch · session restore honesty | | |
| 10 | Rehearse opening VO: clearnet private-trust · E2EE · hide-local · not Tor/Soft L3/video/Matrix Verified | | |

## 4. Demo-video claim bounds (must stay true on camera)

| Say | Do not say / show |
|-----|-------------------|
| Sovereign desktop · keys on device · E2EE | Multi-protocol Verified · Matrix production |
| Clearnet private-trust · Tor optional underlay | Tor Ready / Tor Verified |
| Hide on this device for DMs | Telegram-style delete-everywhere |
| Voice notes / 1:1 audio | Video calls usable |
| Open beta feedback · known limitations | Soft L3 Fixed · Continuity promote |

Script shelf: [docs/assets/demo/v2.0.0/README.md](../../docs/assets/demo/v2.0.0/README.md) — refresh Opening VO with §3b hide/permanence before record.

## 5. Outcome

| Field | Value |
|-------|--------|
| **Verdict** | _Pending_ |
| **Binary / stamp** | |
| **Blockers** | |
| **Accepted skips** | Video · Tor Verified · Matrix promote |
| **Next** | Pass → record demo · Fail → fix P0 then re-run §3 |

_Last updated: 2026-11-03T08:15:00Z_
