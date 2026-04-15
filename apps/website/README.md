# Obscur Website

The website app is the planned public-facing surface for Obscur release distribution and product presentation.

Intended responsibilities:

- publish feature overviews and product positioning,
- surface production GIF demos sourced from `docs/assets/gifs/`,
- present changelog and release-note summaries grounded in `CHANGELOG.md`,
- link users to downloadable release artifacts published through GitHub
  Releases,
- stay aligned with the canonical engineering docs under `docs/`.

## Getting Started

Run the development server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Build

```bash
pnpm build
pnpm start
```

## Content Sources

- Product and release summary: `README.md`
- Canonical changelog: `CHANGELOG.md`
- Engineering docs index: `docs/README.md`
- Release evidence and demo assets: `docs/assets/demo/`
- Production GIF library: `docs/assets/gifs/`

## Notes

- Keep website copy aligned with canonical docs rather than inventing a
  second product narrative.
- Do not claim a release flow works on the website unless the corresponding
  GitHub release artifacts and runtime evidence exist.
