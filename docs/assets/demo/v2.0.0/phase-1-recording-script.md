# Phase 1 demo recording — intro · download · account creation

**Status:** Active template (2026-07-26)  
**Audience:** Maintainer recording clips (ScreenToGif / short MP4) for a stitched demo  
**Pairs with:** [README.md](./README.md) · [presenter-checklist.md](./presenter-checklist.md) · [gif-inventory.md](./gif-inventory.md) · charter [obscur-ecosystem-charter.md](../../../program/obscur-ecosystem-charter.md)

Record **three separate clips**. Trim dead air in the editor; stitch later. Target **45–90 s** total for all three.

---

## Positioning (read before recording)

**Problem:** A checklist intro (“privacy app, verify hash, create identity”) sounds like every federated client. Viewers never see what makes Obscur different.

**What Obscur actually is** (from [design goals](../../../program/design-goals-and-constraints.md)): a **protocol-level communications stack** — Rust kernel, pluggable transports, private relay + coordination — built for **operators who run their own infrastructure**, not renters of a central service. Nostr is one optional adapter, not the product definition.

**Tone ladder** — pick one per audience; all stay honest:

| Tier | For whom | Job |
|------|----------|-----|
| **A — Stack** | Builders, self-hosters, datacenter-adjacent | Convey **depth + ownership** in 20 s |
| **B — Operator** | Small orgs, NGOs, privacy teams | Convey **deploy on your metal** without Signal comparisons |
| **C — Minimal** | Legal-safe default when unsure | Facts only — use sparingly; feels flat |

Phase 1 clips are **user onboarding on screen**, but the **intro voice** should carry tier A or B so the demo does not undersell the engineering.

**Do not confuse with:** mass-market growth story, “better than Signal,” blockchain/token pitch, or Play Store distribution.

---

## Before you record (once per session)

**Do not** start ScreenToGif on a fresh `desktop:package` until the **parity contract** is green on the **release exe**. Default `pnpm dev:desktop` matches packaged online contract; Next HMR (`dev:desktop:live`) is not a release proof. Spec: [production-dev-parity-recovery-2026-07.md](../../../specs/backend/production-dev-parity-recovery-2026-07.md).

| # | Check | Done |
|---|--------|------|
| 0a | `pnpm desktop:demo-preflight` (L1 + shell gate) exits 0 | ☐ |
| 0b | `pnpm desktop:build:exe` → smoke `obscur_desktop_app.exe`: account, relays online (Tor off), F5 ≤2.5s | ☐ |
| 0c | **Only then** `pnpm desktop:package` (one installer for download/install clip) | ☐ |
| 1 | Version on site matches installer you will run (`/download` → **1.9.16**) | ☐ |
| 2 | Browser tab: site `/download` + optional GitHub Release v1.9.16 Assets | ☐ |
| 3 | Windows installer already downloaded **or** ready to download on camera | ☐ |
| 4 | Obscur **not** running yet (clean welcome card for segment 3) | ☐ |
| 5 | ScreenToGif: **Window Capture** → Obscur window (not full desktop + taskbar) | ☐ |
| 6 | Mic on · Desktop Audio muted (unless you want UI clicks) | ☐ |
| 7 | Read [limitations](../../../program/obscur-v2-known-limitations.md) — know what not to promise | ☐ |

**Output naming:**

| Clip | Suggested file |
|------|----------------|
| Intro | `demo_01_intro.mp4` or B-roll still + voice later |
| Download | `demo_02_download.mp4` |
| Account | `auth_create_1.gif` / `demo_03_account_create.mp4` |

---

## Segment 1 — Introduction

**Goal:** Say what Obscur is in plain language — no feature tour yet.  
**Duration:** 20–40 s (can be voiceover over website hero or title card later).  
**Capture:** Website home or `/guide` hero **or** static title slide — **not** required to show the app yet.

### On-screen (optional B-roll)

| Beat | Action | Frame must show |
|------|--------|-----------------|
| 1 | Open site home or `/guide` | Product name + one line of positioning |
| 2 | Optional: scroll to one feature card | Hints at desktop / privacy — no deep dive |
| 3 | Hold 2 s | Clean frame for edit |

### Voiceover — Tier A (stack) **recommended**

> Obscur is a full encrypted communications stack — not a hosted chat app and not a thin Nostr skin.  
> There’s a native client, a Rust kernel, and transports you can point at **your own relay and coordination** — your keys, your servers, your rules.  
> This first clip is the front door: download, verify, and create a local identity. The operator story comes next.

### Voiceover — Tier B (operator)

> If you run infrastructure — a VPS, a homelab, a small datacenter — Obscur is built so you can **own the comms layer** instead of renting Slack or Signal’s trust model.  
> End-to-end encrypted, local-first identity, deployable on hardware you control.  
> Here’s how to install and create your first profile on this machine.

### Voiceover — Tier C (minimal)

> Obscur is privacy-first desktop software. Messages stay local by default.  
> Verify the download hash, then create a local identity. Unsigned builds — SmartScreen is expected.

### On-screen B-roll that sells depth (optional, 5–10 s)

Show **one** of these during Tier A/B intro — not all:

- Monorepo / `packages/` tree in IDE (blur paths if needed) — “custom engine, not a wrapper”
- Settings → relay / coordination URL fields — “you point it at your stack”
- `relay-gateway` or coordination dev stack terminal — “operator path exists”

### Do not say

- “Better than Signal/WhatsApp”
- “Just another Nostr client” (undersells; Nostr is optional)
- Play Store / App Store / signed publisher
- “Fully anonymous” or “uncrackable”
- “Everyone should switch today”
- Blockchain / token / “Web3 messenger”

### Pass when

Viewer knows: **stack not rental**, **self-host path exists**, **this clip is identity onboarding** — not the whole product story.

---

## Segment 2 — Downloading & install

**Goal:** Show **both** public channels: website `/download` (primary) and GitHub Releases (secondary), then start the installer.  
**Duration:** 45–90 s.  
**Canonical brief (v1.9.16):** [segment-a-download-install-v1.9.16.md](./segment-a-download-install-v1.9.16.md)  
**Prereq:** Browser ready · Release **v1.9.16** assets live.

### On-screen workflow

| Step | Action | Pass when |
|------|--------|-----------|
| 2.1 | Site home → **Download** | `/download` — “Download Obscur” |
| 2.2 | Point at **Windows** (or your OS) card | Filename e.g. `Obscur_1.9.16_x64-setup.exe` · Ready |
| 2.3 | Scroll **Verification / Checksums** | SHA-256 visible |
| 2.4 | Click **Download** | Download starts or file present |
| 2.5 | Brief cut to [GitHub Release v1.9.16](https://github.com/Dendro-X0/Obscur/releases/tag/v1.9.16) Assets | Same version listed |
| 2.6 | Run installer · SmartScreen if shown | Installer runs — cut before Create Identity |

**Skip on camera:** Full NSIS wizard unless a separate “install” take.

### Voiceover script (relaxed)

> Two places to get Obscur: the **website download page** is primary — checksums included.  
> The same build is also on **GitHub Releases** for the version tag.  
> Builds are unsigned, so SmartScreen is expected — verify the hash, then install.

### Do not say

- “Official Microsoft-approved”
- “No security warnings”
- “Android is on Play Store”
- “GitHub is the only channel” / “website not deployed”

### Pass when

Viewer sees: **website primary**, **GitHub secondary**, **unsigned + checksum**, **installer starts**.

---

## Segment 3 — Account creation (first identity)

**Goal:** Create a **new** local profile and land on the main shell.  
**Duration:** 40–60 s.  
**Canonical brief (v1.9.16):** [segment-b-create-identity-v1.9.16.md](./segment-b-create-identity-v1.9.16.md)  
**Prereq:** Fresh Obscur launch (welcome card) **or** use a throwaway profile name you can delete later.

### On-screen workflow

| Step | Action | Pass when |
|------|--------|-----------|
| 3.1 | Launch Obscur | Welcome card: **Create New Identity** · Log In · Restore |
| 3.2 | Click **Create New Identity** | Create / passphrase flow opens |
| 3.3 | Set display name + passphrase (use demo values) | Fields filled — do not read passphrase aloud if recorded |
| 3.4 | Confirm / complete create | Returns to unlock or enters app per current UI |
| 3.5 | Unlock if prompted | Main shell visible (chats / home) |
| 3.6 | Hold 2 s on main UI | Stable frame — end clip |

**Alternate path (second take):** **Log In with Key** / **Restore from backup** — record separately; not this segment.

### Voiceover script (relaxed)

> First launch — I’m creating a new local identity.  
> This passphrase unlocks the profile on this device; it isn’t a cloud account.  
> …set the passphrase… unlock… and we’re in.  
> Everything from here is this profile’s local workspace.

### Do not say

- “Account registered on our servers”
- “Email verification”
- “Forgot password recovery” (unless you show backup restore in another clip)

### Pass when

Viewer sees: **Create New Identity → passphrase → main app shell**.

---

## Operational workflow (recording day)

```text
SESSION START
  ├─ Preflight checklist (above)
  ├─ Clip 1: Intro (voice + site B-roll OR record voice-only)
  ├─ Clip 2: Download (/download + checksum + optional installer start)
  ├─ Clip 3: Account create (welcome → Create New Identity → main shell)
  └─ Rename files · note version + date in filename or sidecar txt

EDIT (later)
  ├─ Trim start/end silence on each clip
  ├─ Order: 1 → 2 → 3
  ├─ Optional lower-third: "v1.9.14 · unsigned · verify SHA-256"
  └─ Export one master MP4; keep raw clips

NEXT PHASE (not this session)
  ├─ Unlock-only take (cold start)
  ├─ Settings / relays
  └─ DM send — see README.md §3
```

---

## Stitch order for “Phase 1 complete” video

| Order | Segment | ~Length |
|-------|---------|---------|
| 1 | Introduction | 20–40 s |
| 2 | Downloading | 30–60 s |
| 3 | Account creation | 30–60 s |
| **Total** | | **~1.5–2.5 min** |

---

## Honest limits (one line in intro or end card)

- Native **desktop** product; web PWA is not the ship path.  
- **Unsigned** installers; verify checksums.  
- **No** Play / Apple Developer Program listing.  
- Full scope: [limitations](../../../program/obscur-v2-known-limitations.md).

---

## After capture

| # | Action | Done |
|---|--------|------|
| 1 | Register new files in [gif-inventory.md](./gif-inventory.md) if replacing `auth_create_1.gif` | ☐ |
| 2 | Optional: `node scripts/compress-demo-gifs.mjs --only <file.gif>` | ☐ |
| 3 | Note version + commit in `docs/assets/demo/v2.0.0/evidence/` if keeping PNG stills | ☐ |
