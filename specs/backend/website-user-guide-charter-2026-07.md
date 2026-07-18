# Website band — user guide + web GIF assets (2026-07-17)

**Status:** Active · supersedes immediate `v2.0.0` tag push  
**App:** `apps/website`  
**Parent:** [obscur-v2-phase4-website-charter.md](../../docs/program/obscur-v2-phase4-website-charter.md)  
**Frontend spec:** [apps/website/docs/frontend-spec.md](../../apps/website/docs/frontend-spec.md) § User guide  
**Assets:** `docs/assets/gifs/` · inventory [gif-inventory.md](../../docs/assets/demo/v2.0.0/gif-inventory.md)

---

## Why this band (before v2.0.0)

Maintainer assessment gate:

1. **Official website completeness** — download + limitations exist; strangers still lack a **how-to** surface with the ~20 demo GIFs.
2. **Relay reliability** — product assessment (not this band’s code); do not claim “relay complete” from website work alone.
3. **`v2.0.0` tag** — **paused** until website guide MVP + honest download path + maintainer relay comfort.

Domain truth remains: `obscur.app` is **not** this messenger site ([v2.0.0-fast-track](./v2.0.0-fast-track-2026-07.md)).

---

## Goals

| ID | Outcome |
|----|---------|
| **G1** | `/guide` — user documentation page (how to use Obscur) with section TOC + GIF demos |
| **G2** | Nav **Guide** replaces external “Docs” as primary user path (GitHub encyclopedia stays secondary) |
| **G3** | Web-friendly media: compressed copies under `docs/assets/gifs/web/` (or site `public/`); originals stay archival |
| **G4** | Naming hygiene: no `*.gif.gif`; inventory sizes + web budgets documented |

---

## GIF strategy

**Problem:** Library ≈ **208 MB** total; several captures **16–45 MB** — unsuitable for homepage / guide embeds.

| Tier | Location | Role | Budget |
|------|----------|------|--------|
| **Archive** | `docs/assets/gifs/*.gif` | Capture truth / README / presenter | Prefer ≤30 MB; large OK temporarily |
| **Web** | `docs/assets/gifs/web/<stem>.{mp4,webp}` (+ optional small `.gif`) | Site embeds | **≤1.5 MB** preferred · hard cap **3 MB** per asset |

**Compression pipeline (preferred):**

1. Rename `*.gif.gif` → `*.gif`
2. `ffmpeg` → **H.264 MP4** (or WebM) @ 720p, ~8–12 fps, CRF 28–32, no audio  
3. Optional poster frame PNG/WebP for `poster=` / reduced-motion  
4. Site uses `<video autoplay muted loop playsInline>` with `prefers-reduced-motion` → static poster

GIF→GIF via `gifsicle --lossy` is fallback only when ffmpeg unavailable (worse quality/size tradeoff).

Script: `scripts/compress-demo-gifs.mjs` (installs/uses portable ffmpeg when missing).

---

## Guide IA (MVP)

Ordered for a new desktop user:

1. Create / unlock profile  
2. Relays & connectivity (honest: adapters carry ciphertext)  
3. Contacts  
4. Direct messages  
5. Groups / communities (note ACC-02 roster limitation)  
6. Media, voice notes, calls  
7. Multi-profile export/import  
8. Settings & privacy surfaces  

Each section: 1–3 short sentences + one demo media + optional “Limitations” callout.

**Voice:** Match [obscur-ecosystem-charter.md](../../docs/program/obscur-ecosystem-charter.md) — no mass-market chat claims; encryption on client.

---

## Sequencing

```text
1. Spec + inventory refresh + rename double extensions
2. Compress → docs/assets/gifs/web/ (size report)
3. Implement /guide from frontend-spec + wire site-content
4. Local smoke: pnpm -C apps/website build + /guide
5. Maintainer: relay comfort assessment (separate) → then resume v2 gate
```

---

## Out of scope

- Tagging `v2.0.0`  
- Reclaiming `obscur.app` DNS  
- Community roster patches (PAUSED)  
- Full encyclopedia port into the website  
- Claiming relay “production proven” from GIF embeds  

---

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `pnpm -C apps/website build` · `/guide` 200 |
| Assets | `node scripts/compress-demo-gifs.mjs --report` — all web assets ≤3 MB |
| L3 | Maintainer local smoke of guide sections |

---

## Revision

| Date | Change |
|------|--------|
| 2026-07-17 | Initial charter — pause v2 tag · /guide · web compress tiers |
