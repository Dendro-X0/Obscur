# Obscur website — frontend spec (editorial lane)

**Status:** Active (2026-07-04)  
**App:** `apps/website`  
**Charter:** [obscur-v2-phase4-website-charter.md](../../../docs/program/obscur-v2-phase4-website-charter.md)

---

## Brand direction

**Evidence-led editorial** — not SaaS template.

| Layer | In-app (Obscur) | Website |
|-------|-----------------|---------|
| Mood | Dark, cool, “underground signal” | Light, warm, gallery / independent press |
| Voice | Operational | Declarative, artifact-named |
| Motion | Functional | Calm, one-shot, `prefers-reduced-motion` safe |

Palette (keep): cream `#f4efe6`, teal `#0f766e`, warm `#b45309`, ink `#21180f`.  
Typography: Fraunces (headlines) + Space Grotesk (body).

---

## Page archetypes

| Route | Archetype | Priority |
|-------|-----------|----------|
| `/` | Editorial landing + proof ladder | **P0** — this spec |
| `/download` | Utilitarian install surface | P0 — crisp, not artistic |
| `/limitations` | Honest scope sheet | P1 — match tone, less decoration |
| `/changelog` | Reference index | P2 |

---

## Homepage sections (top → bottom)

1. **Hero** — one thesis sentence, summary, primary download, release panel
2. **Proof strip** — limitations, changelog, build guide, docs (pill links)
3. **Release snapshot** — what shipped (from CHANGELOG highlights)
4. **Feature gallery** — demo GIFs, slow vertical rhythm
5. **Platform boundaries** — pwa / desktop / packages
6. **Verification status** — pass / partial / pending (differentiator)
7. **Docs + download CTA** — split layout

**Above-the-fold goal:** Read thesis → trust proof strip → download path visible without scroll on desktop.

---

## Motion rules

| Allowed | Forbidden |
|---------|-----------|
| Hero fade-in once on load (CSS) | Scroll-jacking |
| Card hover lift 1px | Parallax layers |
| Feature card stagger on first paint | Infinite gradient animation |
| `scroll-behavior: smooth` | Auto-play video hero |

Always honor `@media (prefers-reduced-motion: reduce)` — disable transforms and animation.

---

## Atmosphere (implementation)

- Fixed grain overlay (`body::before`) — subtle paper depth
- Existing radial gradients — keep
- Glass cards — keep blur + soft shadow
- Section rhythm — increase vertical spacing between major bands

---

## Proof / verification

| Layer | Command |
|-------|---------|
| L1 build | `pnpm -C apps/website build` |
| Local smoke | `/`, `/download`, `/limitations` HTTP 200; SHA on `/download` |
| Visual | CodaCtrl `client_screenshot_capture` `{ provider: "playwright-chromium", url }` |
| Design chain | `chain-phase4-website-2026-07-04` — hero before/after, download after, deploy smoke |

---

## Out of scope

- SaaS-style animation stack (Framer Motion hero chains)
- Dark mode toggle (website stays light editorial)
- In-app UI parity (no import of PWA chrome)

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-04 | Editorial lane opened; hero layout fixes; atmosphere slice |
| 2026-07-04 | Gallery + proof-wall bands; section leads; CodaCtrl WEB-2/3/4 validated |
| 2026-07-04 | Hero fold (#1); `/download` editorial utilitarian pass (#2) |
| 2026-07-04 | CodaCtrl chain `chain-phase4-website-2026-07-04` — 4 nodes, deploy smoke t2 |
