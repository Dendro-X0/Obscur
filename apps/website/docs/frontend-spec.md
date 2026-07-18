# Obscur website — frontend spec (editorial lane)

**Status:** Active (2026-07-17)  
**App:** `apps/website`  
**Charter:** [obscur-v2-phase4-website-charter.md](../../../docs/program/obscur-v2-phase4-website-charter.md)

---

## Brand direction

**Evidence-led cinematic editorial** — not SaaS template. Landing reads like a short novel on warm paper: cream, teal, Fraunces display, calm chapter pacing.

| Layer | In-app (Obscur) | Website |
|-------|-----------------|---------|
| Mood | Dark, cool, “underground signal” | Light, warm, gallery / independent press |
| Voice | Operational | Declarative, artifact-named |
| Motion | Functional | Calm, one-shot + scroll reveal, `prefers-reduced-motion` safe |

Palette (keep): cream `#f4efe6`, teal `#0f766e`, warm `#b45309`, ink `#21180f`.  
Typography: Fraunces (headlines) + Space Grotesk (body).

---

## Page archetypes

| Route | Archetype | Priority |
|-------|-----------|----------|
| `/` | **Cinematic editorial theater** + proof ladder | **P0** — this spec |
| `/download` | Utilitarian install surface | P0 — crisp, not artistic |
| `/guide` | User how-to + demo media | **P0** — paginated |
| `/limitations` | Honest scope sheet | P1 — match tone, less decoration |
| `/changelog` | Reference index with pagination + timestamps | **P1** |

---

## User guide (`/guide`) — active band

**Charter:** [website-user-guide-charter-2026-07.md](../../../specs/backend/website-user-guide-charter-2026-07.md)

### Purpose

Stranger-facing **how to use Obscur** after install — not the maintainer encyclopedia. Paginated how-to; each feature page: short copy + demos (`<video>` from web-compressed assets).

### Layout

1. **`/guide`** — index of feature cards  
2. **`/guide/[slug]`** — single feature: explanation + demos only  
3. **Left sidebar** — sticky feature nav  
4. **Feature page** — chapter meter + prev/next pager  
5. **Right rail (desktop)** — overview + per-demo anchors  

Landing “Open in guide” links point at `/guide/<slug>`.

### Media rules

- Prefer bundled `public/guide-media/<stem>.mp4` (+ `.poster.jpg`)  
- Guide demos: `autoplay muted loop playsInline`; poster when available  
- `@media (prefers-reduced-motion: reduce)` → poster only  
- Do not embed 10+ MB archive GIFs on this route  

---

## Homepage — cinematic theater

### Hero fold (viewport 1) — one composition

| Element | Rule |
|---------|------|
| Brand | Wordmark + mark at **hero scale** (survives “remove the nav” test) |
| Copy | One headline + one short supporting sentence |
| CTAs | Download (primary) · Guide (secondary) |
| Stage | Full-bleed dominant visual plane — **no glass cards in hero** |
| Release | Slim chip / caption under CTAs — not a side panel |

### Below fold (chapters)

1. Quiet proof strip (secondary; does not compete with brand)  
2. Release snapshot — quiet chapter  
3. Feature **stages** — large media-led alternating bands (not dense card grid)  
4. Platform boundaries  
5. Verification status  
6. Docs + download closing CTA  

Body measure ~38–42rem on chapter copy. Wider vertical rhythm than the old editorial fold.

### Hero media / future audio demo

| Path | Role |
|------|------|
| `public/hero-media/showcase.mp4` | Preferred hero stage when present |
| `public/hero-media/showcase.poster.jpg` | Poster companion |
| Fallback | Strong guide stem (e.g. `auth_unlock_1`) muted ambient |

**When showcase is present (audio-capable):** `<video controls>` — sound only after user play. **Never autoplay with sound.**  
**Fallback / silent ambient:** muted loop + playsInline; reduced-motion → static poster only.

Drop-in later: place your narrated demo at `public/hero-media/showcase.mp4` (+ poster). Resolver in `site-content.ts` (`resolveHeroShowcase`) picks it up automatically.

---

## CodaCtrl verification hooks (2026-07-04)

| Attribute | Example | Route |
|-----------|---------|-------|
| `data-codactrl-surface` | `download-checksums` | `/download` checksum section |
| `data-codactrl-sha256` | full hex from manifest | each checksum `<code>` |

Runbook: [codactrl-obscur-agent-runbook-2026-07.md](../../../docs/program/codactrl-obscur-agent-runbook-2026-07.md)

---

## Motion rules

| Allowed | Forbidden |
|---------|-----------|
| Hero brand/copy one-shot rise/fade on load | Scroll-jacking |
| IntersectionObserver one-shot band/stage reveal | Multi-layer parallax |
| Soft media scale ≤1.02 on hover (in-view stages) | Infinite gradient animation |
| Slow Ken Burns on **in-view muted** ambient only | Autoplay **with sound** |
| `scroll-behavior: smooth` | Framer Motion / Three.js stacks |

Always honor `@media (prefers-reduced-motion: reduce)` — static posters, no transforms/animation.

Implementation: CSS keyframes + tiny `RevealScope` client island — no Framer Motion.

---

## Atmosphere (implementation)

- Fixed grain overlay (`body::before`) — paper depth  
- Cream/teal/warm radial gradients — keep  
- Hero: soft vignette over full-bleed stage  
- Chapters: less glass-card chrome on media; caption typography  
- Nav stays sticky and light so it does not fight the theater  

---

## Proof / verification

| Layer | Command |
|-------|---------|
| L1 build | `pnpm -C apps/website build` |
| Local smoke | `/` first viewport = one composition; `/download`, `/guide` unchanged |
| Visual | Hard-refresh localhost; brand test without nav |

---

## Out of scope

- SaaS-style animation stack (Framer Motion hero chains)  
- Dark mode toggle (website stays light editorial)  
- In-app UI parity (no import of PWA chrome)  
- Inventing a placeholder audio trailer before maintainer supplies `hero-media/showcase.mp4`

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-17 | `/changelog` pagination + timestamp components · editorial restyle |
| 2026-07-17 | `/guide` paginated docs shell |
| 2026-07-17 | `/guide` user how-to band · web media budgets · nav Guide |
| 2026-07-04 | Editorial lane opened; hero layout fixes; atmosphere slice |
| 2026-07-04 | Gallery + proof-wall bands; section leads; CodaCtrl WEB-2/3/4 validated |
| 2026-07-04 | Hero fold (#1); `/download` editorial utilitarian pass (#2) |
| 2026-07-04 | CodaCtrl chain `chain-phase4-website-2026-07-04` — 4 nodes, deploy smoke t2 |
