# Agent standard — docs shelf + silent feature GIFs

**Status:** Canonical for Obscur · portable pattern for other products  
**Audience:** Agents producing documentation and feature demos  
**Reference shelf:** [`docs/assets/gifs/`](../assets/gifs/) · [`docs/assets/demo/`](../assets/demo/)  
**Companion:** [gif-inventory.md](../assets/demo/v2.0.0/gif-inventory.md) · [website-user-guide-charter](../../specs/backend/website-user-guide-charter-2026-07.md) · [DOC-MAINTENANCE.md](../DOC-MAINTENANCE.md)

```text
GOAL: High-quality silent GIFs of real product usage + MD usage guides
NOT: Short aimless recordings · simulated/stub theater · messy slug dumps
```

---

## 1. Shelf layout (required)

Every product that ships demos uses **this** layout — not `docs/demos/<random-slug>/` dumps.

```text
docs/
  assets/
    gifs/                         # Named GIF library (replace in place)
      <feature_snake>_1.gif
      web/                        # Optional compressed MP4 for site embeds
    demo/
      <version>/                  # e.g. v2.0.0
        README.md                 # Demo / guide index (segments + GIF links)
        gif-inventory.md          # Map file → feature → status
        segment-<id>-<slug>.md    # One feature: usage steps + GIF link
        presenter-checklist.md    # Optional cold-run checklist
```

| Path | Owns |
|------|------|
| `docs/assets/gifs/` | Visual library — **stable names**, overwrite on redo |
| `docs/assets/demo/<version>/` | Instructions, inventory, shot lists |
| `docs/assets/gifs/web/` | Site/size ladder only — not capture truth |

**Forbidden:** scattering GIFs under `.codectx/`, `docs/demos/<slug>/` as the publishing shelf, or version folders without inventory.

---

## 2. GIF quality bar (silent feature demos)

| Rule | Requirement |
|------|-------------|
| **Silence** | **No audio** — silent GIF (or silent webm/mp4). No VO track required for the GIF itself. |
| **Frame rate** | **15–30 FPS** for archive GIFs under `docs/assets/gifs/` (prefer **24**; web tier may use **20**). |
| **Motion** | **Continuous** — fixed-timestep capture while driving UI (see §5). **Not** a slideshow of held stills. |
| **Surface** | Product UI / CLI stage only — **not** IDE chrome, Cursor, or agent panels. |
| **One job** | One named feature (or one tight ritual) per file. |
| **Completeness** | Intro hold → clear user actions → **soft-no end** (finished state held ≥2–3 s **in-stream**). Not a mid-click cut. |
| **Duration** | Prefer **~20–90 s** trimmed for a single feature. Reject aimless &lt;8 s flashes unless explicitly a micro-beat. Encode duration ≈ capture wall-clock. |
| **Honesty** | Captions/MD must not claim Fixed / signed / “always works” beyond known limitations. |
| **Replace** | Bad take → **overwrite the same filename** + update inventory. Do not invent a new meaningless slug. |

**Web embeds:** `scripts/compress-demo-gifs.mjs` may downsample for site (`docs/assets/gifs/web/`). That is a **delivery** tier; archive GIFs remain **15–30 FPS** capture truth.

---

## 3. Naming

```text
<feature_or_ritual>_<n>.gif
```

Examples (Obscur): `auth_unlock_1.gif` · `e2e-dm-base_1.gif` · `relay_enable_disable_1.gif`

| Do | Don’t |
|----|--------|
| Stable snake_case feature names | `demo-2026-09-07-tmp.gif` |
| `_1`, `_2` for deliberate variants | Duplicate `*.gif.gif` |
| Match inventory + segment links | Orphan files with no MD row |

---

## 4. Markdown usage guide (per feature)

Minimum for each key feature:

**A. Inventory row** in `docs/assets/demo/<version>/gif-inventory.md`:

| File | Feature / guide section | Status | Notes |
|------|-------------------------|--------|-------|
| `auth_unlock_1.gif` | Unlock | Captured | Link from segment B |

**B. Segment MD** `segment-<id>-<slug>.md` (or a section in `README.md`) with:

1. **What this shows** (one sentence)  
2. **Prereqs** (build, profile, ports)  
3. **Usage steps** (numbered — what the user does on screen)  
4. **Pass when** (observable outcome)  
5. **GIF link** to `../../gifs/<name>.gif`  
6. **Does not claim** (honesty)

Template:

```markdown
# Feature — <Name>

**GIF:** [`<name>_1.gif`](../../gifs/<name>_1.gif)  
**Status:** Captured | Pending | Redo  

## What this shows
…

## Prereqs
1. …

## Usage steps
1. …
2. …
3. Soft-no: hold finished UI ≥2 s

## Pass when
…

## Does not claim
…
```

---

## 5. Agent workflow (produce, don’t fake)

```text
1. Pick ONE key feature (from product guide / release scope)
2. Write or update segment MD + inventory row (Pending)
3. Drive the REAL product (installed app / live URL / real CLI)
4. Capture CONTINUOUS silent motion at 15–30 FPS (prefer 24):
   parallel fixed-timestep screenshots WHILE hovering/clicking/scrolling
   → encode with ffmpeg (fps + sierra2_4a) → docs/assets/gifs/<name>_1.gif
5. Probe encode duration ≈ capture wall-clock
6. If quality fails bar → DELETE/overwrite same name (redo) — do not keep junk
7. Mark inventory Captured · link from demo/<version>/README.md
8. Optional: web tier at 20 FPS under docs/assets/gifs/web/
```

**Canonical capture method:** continuous **fixed-timestep** screenshots (JPEG ok) during the ritual — not stitched held stills. Portable helper: CodaCtrl `scripts/lib/docs-gif-smooth-capture.mjs` · standard: CodaCtrl `docs/studio/AGENT-DOCS-GIF-STANDARD.md` §3.

### Capture environments (simulate live ritual)

| Id | Surface |
|----|---------|
| `web` | Web / PWA |
| `desktop` | Desktop app (CDP / Tauri webview) |
| `mobile_sim` | Simulated mobile UI (390×844) — not physical-device lab |
| `tui` | TUI / terminal (vhs preferred) |

Detail: CodaCtrl `AGENT-DOCS-GIF-STANDARD.md` §3.1 · MCP `client_docs_gif_shelf` guide → `environments`.

**Also allowed** when they yield continuous 15–30 FPS: Antigravity `/record`, Playwright `recordVideo`, CDP screencast.  
**Not allowed as “done”:** regenerating stub/vhs theater; Demo Desk stub `record_gif`; slideshow stills.

---

## 6. Acceptance (agent may stop only when)

- [ ] GIF lives under `docs/assets/gifs/` with a **stable** name  
- [ ] **Silent** · **15–30 FPS** · **continuous motion** · soft-no ending · one feature  
- [ ] Encode duration ≈ capture wall-clock  
- [ ] Segment MD has **usage steps** + GIF link  
- [ ] `gif-inventory.md` row updated  
- [ ] `demo/<version>/README.md` indexes the feature  
- [ ] Redo used overwrite — no parallel junk files  

**Does not prove:** Soft L3 Fixed · product Fixed · marketing VO quality · that every feature has a GIF.

---

## 7. Explicit non-goals

- Automating a full Obscur-week of presenter VO + multi-segment stitch as a default agent task  
- Claiming CodaCtrl Demo Desk `docs/demos/<slug>/` packs equal this shelf  
- Short aimless recordings that are “extremely hard to implement” for viewers  
- Stitched held screenshots presented as continuous motion  

---

## Portable copy (other repos)

Other products (Signet, Orbit, Assess, …) should mirror:

```text
docs/assets/gifs/
docs/assets/demo/<version>/
```

and obey §§2–6. Obscur remains the reference implementation.
