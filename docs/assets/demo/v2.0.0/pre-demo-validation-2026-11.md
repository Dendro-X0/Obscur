# Pre-demo validation — public feedback cut (2026-11)

**Purpose:** One cold-run validation **before** recording the public-feedback demo video.  
**Parents:** [presenter-checklist.md](./presenter-checklist.md) · [README.md](./README.md) · [platform-public-feedback-release-readiness-2026-11.md](../../../specs/backend/platform-public-feedback-release-readiness-2026-11.md) · [demo-recording-prod-preflight-design-2026-07.md](../../../specs/backend/demo-recording-prod-preflight-design-2026-07.md)  
**Surface:** Release exe / packaged NSIS — **not** default `dev:desktop` offline stub  
**Tor:** **OFF**  
**A1–A5:** Pass 2026-11-03 (gate docs) — this log is the **user-visible** cold run

```text
HANDOFF ATOMIC STEP: Pre-demo validation before public feedback video
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote · video usable
PROOF BEFORE RECORD: Agent preflight Pass · operator checklist Pass · no P0 hitch on camera path
SURFACE: obscur_desktop_app.exe (or Obscur_2.0.0_x64-setup.exe after smoke)
```

## 0. Claim bounds (say / do not say on camera)

| Say | Do not say / do not demo |
|-----|--------------------------|
| Native desktop · E2EE · clearnet private-trust | Tor Verified · Soft L3 Fixed · multi-protocol Verified |
| Obscur-Nostr DMs on clearnet relays | Matrix / Private DC as production carriers |
| **Hide on this device** (local) · managed workspace remove on sealed relays | Telegram-style erase-everywhere |
| 1:1 **audio** call optional | Camera / video conference usable |
| Unsigned / self-signed — verify SHA-256 | Play Store / App Store / signed enterprise installer |

## 1. Agent preflight (before operator sits down)

| # | Check | Command / action | Result |
|---|-------|------------------|--------|
| A | Demo L1 preflight | `pnpm desktop:demo-preflight` | **Pass 2026-11-03** — mesh Quiet tests realigned to `RELAY_WARMUP_PUBLIC_DIAL_CAP=2` |
| B | Feedback gates A1–A5 | Readiness checklist Pass | **Pass 2026-11-03** |
| C | Installer present | `release-assets/windows/Obscur_2.0.0_x64-setup.exe` (= GH `v2.0.0-beta.6`) | **Pass 2026-11-06** — synced from release asset |
| D | SHA-256 recorded | `sha256sum` → paste below | **Pass 2026-11-06** |
| E | Release exe smoke surface | `pnpm desktop:build:exe` | Prefer published NSIS for film |
| F | Honesty surfaces | `/download` hero · Settings Privacy/Protocols · `/limitations` | **Landed** (A5) — in beta.6 shell |
| G | Tor preference | Confirm Tor **OFF** for takes | _Operator_ |

**Installer SHA-256:** `dfc981309794e835a2101a3c67774c0771b9e6239717eb4c3c34d51fd53861db`  
**Installer source:** GitHub `v2.0.0-beta.6` / `Obscur_2.0.0_x64-setup.exe` (9 277 471 B)  
**Shell / build stamp:** `shell-from-ci-v2.0.0-beta.6`  
**Release exe:** prefer cold-run of published NSIS  
**Commit (short):** `41194f7b` (+ download sync)  
**Download site:** `https://obscur-website.vercel.app/download` (not `obscur.app` — that host is a different product)  
**Download hang note:** `/download` must **not** use `target="_blank"` on installer URLs. Spec: `specs/ci/2026-11-04-download-hang-investigation.md`.

## 2. Operator cold run (Tor OFF) — demo path

Mark Pass / Fail / Skip. Fail = fix before record (or cut segment).

| # | Step | Segment | Result | Notes |
|---|------|---------|--------|-------|
| 1 | Launch release exe · stamp visible · no crash | A/B | | |
| 2 | Unlock Tester1 (passphrase) → shell | B | | |
| 3 | Relays Clearnet · ≥1 open · Tor OFF | C | | |
| 4 | DM send/receive Tester1↔Tester2 | D/F | | |
| 5 | Say **Hide on this device** once (optional show menu) — no erase-everywhere claim | F / honesty | | |
| 6 | Multi-profile second window · Tester2 | E | | |
| 7 | Voice note **or** 1:1 audio dial · **no video** | H | Skip OK |
| 8 | Managed workspace / group chat (Docker or known private relay) **or** Skip with VO | I | Skip OK if stack down |
| 9 | Portable export sanity (Settings) | J | |
| 10 | Quit + relaunch · unlock restores shell | B close | |
| 11 | Spot-check `/download` + `/limitations` copy (browser) | A close | |

## 3. Hitch classes (if Fail)

| Class | Example | Action |
|-------|---------|--------|
| P0 camera-blocker | Unlock wipe · DM send dead · crash on launch | Stop — fix before any take |
| P1 segment-cut | Group stack unavailable · voice flaky | Skip segment · keep VO honest |
| P2 polish | Stamp mismatch · UI copy typo | Note · may still record |

## 4. Outcome

| Field | Value |
|-------|--------|
| **Validation verdict** | _Installer synced_ — use `v2.0.0-beta.6` NSIS; operator cold-run still open |
| **OK to record demo video** | ☐ Yes · ☐ No — after Tor-OFF cold-run on beta.6 NSIS |
| **Blockers** | none for installable fetch |
| **Segments to skip on camera** | Soft L3 · Tor · Matrix · video usable |
| **Maintainer sign-off** | |
| **Date (UTC)** | 2026-11-06 |

### Add Friend note (2026-11-05)

- Legacy vanity resolve **Pass** (`OBSCUR-8GC5XJ` → Exact Match Tester1 · fingerprint panel).  
- Prefer filming **Share contact** dual-lane (QR + OB2/link) from rebuild; vanity is honesty-labeled secondary.

## 5. After Pass → record

1. Use [phase-1-recording-script.md](./phase-1-recording-script.md) + segment briefs.  
2. Opening VO must include feedback non-claims (§0).  
3. File evidence under `docs/assets/demo/v2.0.0/evidence/` as `P5-<nn>-predemo-2026-11-<topic>.png` if useful.  
4. Public download refresh = **v2.0.0-beta.6** Full Release — do **not** retag beta.5.

_Last updated: 2026-11-06T09:35:00Z_
