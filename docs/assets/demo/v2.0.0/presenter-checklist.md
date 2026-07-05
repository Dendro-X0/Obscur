# v2.0.0 presenter checklist — cold run

**Use with:** [README.md](./README.md) demo script  
**Sign-off:** Maintainer only — one successful cold run required for Phase 5 EXIT

---

## Before the session (T-30 min)

| # | Check | Command / link | Done |
|---|-------|----------------|------|
| 1 | Read limitations sheet | [obscur-v2-known-limitations.md](../../../program/obscur-v2-known-limitations.md) | ☐ |
| 2 | Installer artifact present | `release-assets/windows/Obscur_1.9.10_x64-setup.exe` or fresh `pnpm desktop:package` | ☐ |
| 3 | SHA-256 matches manifest | `d814ab21c9b927644ec567c9e305bde482a53c1b1b9069b357aa10bdc990813f` | ☐ |
| 4 | Demo script reviewed | [README.md](./README.md) — **live install path** (GIF segments optional until re-capture) | ☐ |
| 5 | GIF inventory reviewed | [gif-inventory.md](./gif-inventory.md) — **v1.3.15-era assets; skip GIF path until maintainer re-capture** | ☐ |

---

## Live group segment (optional — add 15 min prep)

| # | Check | Notes | Done |
|---|-------|-------|------|
| 6 | `.env.local` from example | Copy `apps/pwa/.env.example` — not committed | ☐ |
| 7 | Coordination running | `pnpm dev:coordination` · `pnpm coordination:health` → `ok: true` | ☐ |
| 8 | Relay running (chat) | `pnpm dev:relay:docker` — Docker Desktop required | ☐ |
| 9 | Two profiles ready | Tester1 + Tester2 · two windows | ☐ |
| 10 | Fresh workspace or known fixture | Avoid stale roster from prior demos | ☐ |

**Coordination-only shortcut:** `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` — membership without relay; chat stays local-only.

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
