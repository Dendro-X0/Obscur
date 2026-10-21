# v2.0.0 presenter checklist — cold run

**Use with:** [README.md](./README.md) demo script  
**Sign-off:** Maintainer only — one successful cold run required for Phase 5 EXIT

---

## Before the session (T-30 min)

| # | Check | Command / link | Done |
|---|-------|----------------|------|
| 0 | Demo ladder (preflight → release exe smoke → **one** package) | [demo-recording-prod-preflight-design-2026-07.md](../../../specs/backend/demo-recording-prod-preflight-design-2026-07.md) · `pnpm desktop:demo-preflight` · `pnpm desktop:build:exe` | ☐ |
| 1 | Read limitations sheet | [obscur-v2-known-limitations.md](../../../program/obscur-v2-known-limitations.md) | ☐ |
| 2 | Installer artifact present | `release-assets/windows/Obscur_*_x64-setup.exe` after smoke-green `pnpm desktop:package` | ☐ |
| 3 | SHA-256 matches manifest | Verify against current `release-assets` / site manifest | ☐ |
| 4 | Demo script reviewed | [README.md](./README.md) · [phase-1-recording-script.md](./phase-1-recording-script.md) | ☐ |
| 5 | GIF inventory reviewed | [gif-inventory.md](./gif-inventory.md) — skip GIF path until maintainer re-capture | ☐ |

---

## Live group segment (optional — add 15 min prep) · Segment I / Part 9

**Brief:** [segment-i-community-group-chat-v1.9.16.md](./segment-i-community-group-chat-v1.9.16.md)  
**VO:** Docker for this demo · VPS / dedicated pool for production reliability.

| # | Check | Notes | Done |
|---|-------|-------|------|
| 6 | `.env.local` from example (dev shell) **or** Operator setup trust-local (packaged exe) | Copy `apps/pwa/.env.example` — not committed | ☐ |
| 7 | Coordination running | `pnpm dev:coordination` · `pnpm coordination:health` → `ok: true` | ☐ |
| 8 | Relay running (chat) | `pnpm dev:relay:docker` — Docker Desktop required | ☐ |
| 9 | Two profiles ready | DemoUser / Tester1 + Tester2 · two windows | ☐ |
| 10 | Fresh workspace or known fixture | Avoid stale roster from prior demos | ☐ |
| 11 | Relays: `ws://localhost:7000` Connected · public hosts off for create | See private-trust setup | ☐ |

**Coordination-only shortcut:** `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` — membership without relay; chat stays local-only — **not** for Segment I chat proof.

---

## During the demo — do / don't

| Do | Don't |
|----|-------|
| Say “native desktop · web disabled” | Open production PWA URL as product |
| Verify SHA before install | Skip SmartScreen / unsigned discussion |
| Show DM + group on **verified** paths | Demo roster mismatch as a surprise bug |
| Mention ACC-02 if Participants differ | Promise “we’ll fix roster next sprint” |
| Link limitations + download at close | Claim Play Store / signed installer |

---

## Segment timer (live path)

| Segment | Target | Script § |
|---------|--------|----------|
| Opening + limitations | 2 min | Opening |
| Install + trust | 3 min | §1 |
| Unlock | 3 min | §2 |
| DM | 3 min | §3 |
| Settings / relay | 2 min | §4 |
| Multi-profile | 2 min | §5 |
| Group (live) | 5 min | §6 |
| Media/voice (optional) | 2 min | §7 |
| Close | 2 min | Close |
| **Total** | **~18–24 min** | |

---

## Exit criteria (Phase 5 M5-1 + M5-4)

Record on first successful cold run:

| Field | Value |
|-------|--------|
| Date (UTC) | |
| Commit / installer version | e.g. `1.9.10` @ SHA |
| Path | ☐ Live full · ☐ GIF-backed · ☐ Hybrid |
| Group segment | ☐ Live dual-profile · ☐ Skipped (stack unavailable) |
| Viewer received limitations link | ☐ |
| Viewer received install + checksum | ☐ |
| Maintainer sign-off | |

**Evidence folder:** `docs/assets/demo/v2.0.0/evidence/` — add PNGs with `P5-<nn>-<topic>-<date>.png`.

---

## After the session

| # | Action | Done |
|---|--------|------|
| 1 | File any new screenshots to `evidence/` | ☐ |
| 2 | Update [gif-inventory.md](./gif-inventory.md) if captures added | ☐ |
| 3 | Note blockers in handoff if cold run failed | ☐ |
| 4 | Phase 5 EXIT → enable M5-3 website embed when Phase 4 deploy unblocks | ☐ |
