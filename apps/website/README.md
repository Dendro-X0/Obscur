# Obscur Website

Public release surface for Obscur — download links, limitations, and changelog grounded in repo truth.

## Local development

```bash
pnpm -C apps/website dev
```

Open `http://localhost:3000`. Smoke routes: `/`, `/download`, `/limitations`, `/changelog`.

## Production build

```bash
pnpm -C apps/website build
pnpm -C apps/website start
```

## Deploy (maintainer)

**Domain honesty (2026-07-17):** `https://obscur.app` currently serves a **different product** (face-blur Quasar SPA on Cloudflare Pages). It is **not** this `apps/website` app. Do not claim Phase 4 EXIT via that domain until DNS/hosting is cut over.

**Canonical download until site deploy:** `release-assets/manifest.json` on `main` (raw GitHub + GitHub Release assets). See [v2.0.0-fast-track-2026-07.md](../../specs/backend/v2.0.0-fast-track-2026-07.md).

Typical paths:

1. **Vercel** — import monorepo, set root directory to `apps/website`, build command `pnpm build`, output default. Use a **new** project name (do not assume `obscur.app` or `obscur-website.vercel.app` are this app).
   - Monorepo skip: if the latest push does not touch `apps/website/**` (or shared deps like `release-assets/manifest.json`), Vercel marks the project **Skipped — Not affected**. Push a website change or use **Redeploy** on the last successful/affected commit.
2. **Static export** — not configured today; app uses server components + `headers()` on `/download` for platform hint only.

After deploy, verify:

- `/download` shows Windows artifact from `release-assets/manifest.json`
- SHA-256 on page matches local manifest
- `/limitations` loads without placeholder copy

## Content sources

| Source | Use |
|--------|-----|
| `release-assets/manifest.json` | Download URLs, checksums, version |
| `CHANGELOG.md` | Release highlights |
| `docs/program/obscur-v2-known-limitations.md` | Limitations sheet (linked + summarized) |
| `docs/program/obscur-v2-phase3-signing-policy.md` | Unsigned installer copy |
| `docs/program/obscur-v2-install-build-guide.md` | Build-from-source links |

Charter: [obscur-v2-phase4-website-charter.md](../docs/program/obscur-v2-phase4-website-charter.md)  
Frontend spec: [docs/frontend-spec.md](./docs/frontend-spec.md)

## Rules

- Do not claim Play Store, App Store, or signed installers unless manifest + policy say so.
- Android debug APK is **local build output** — document checksum, not a hosted download.
- Keep copy aligned with canonical docs; this site is not a second product narrative.
