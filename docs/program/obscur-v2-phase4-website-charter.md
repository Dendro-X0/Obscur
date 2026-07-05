# Obscur v2 — Phase 4 website charter

**Status:** Local deploy smoke PASS (2026-07-04) — Vercel preview gate for **EXIT**  
**Prerequisite:** ~~Runtime repair band exits~~ **met** (R1–R5 VERIFIED t4 · R4 A)  
**App:** `apps/website`  
**Pipeline:** [v2.0-release-pipeline.md](../archive/program/inactive-2026-06/v2.0-release-pipeline.md) § Phase 4

---

## Goal

Public-facing website: trustworthy download surface, honest limitations, no false store claims.

**Exit criterion:** A stranger can install Windows from `/download`, verify SHA-256, and read scope/limitations without reading the repo.

---

## Rows

| ID | Deliverable | Status | Proof |
|----|-------------|--------|-------|
| W4-1 | `/download` — Phase 3 manifest artifacts + build-from-source honesty | **Done** | Reads `release-assets/manifest.json` · checksum table |
| W4-2 | Trust copy — unsigned policy, limitations, no Play/App Store claims | **Done** | `/limitations` · signing policy links |
| W4-3 | Build/deploy path documented | **Done** · local smoke PASS | [apps/website/README.md](../../apps/website/README.md) · `chain-phase4-website-2026-07-04` |
| W4-4 | Nav: product, download, limitations, docs pointer | **Done** | `site-nav.tsx` in layout |

---

## Content sources (canonical)

| Source | Website use |
|--------|-------------|
| `release-assets/manifest.json` | Download URLs, SHA-256, version |
| `docs/program/obscur-v2-known-limitations.md` | `/limitations` summary + link |
| `docs/program/obscur-v2-phase3-signing-policy.md` | Unsigned trust banner |
| `docs/program/obscur-v2-install-build-guide.md` | Android / macOS / Linux build-from-source |
| `CHANGELOG.md` | `/changelog` + homepage highlights |

---

## Verification (L1)

```bash
pnpm -C apps/website build
pnpm -C apps/website dev   # smoke: /, /download, /limitations
```

Manual: Windows download link resolves to GitHub raw `release-assets/windows/Obscur_1.9.10_x64-setup.exe`; checksum matches manifest.

**Local deploy smoke (2026-07-04):** `/`, `/download`, `/limitations` HTTP 200 · SHA in `/download` HTML · CodaCtrl `chain-phase4-website-2026-07-04` (t2).

**EXIT gate:** Vercel preview URL smoke — stranger-facing install path without reading the repo.

---

## Out of scope (Phase 5+)

- Demo GIF embeds and presenter script on site (Phase 5)
- `v2.0.0` tag and gate doc (Phase 6)
- In-app updater policy sync (`streaming-update-policy.json`) — separate maintainer lane

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-04 | Local deploy smoke PASS · editorial P0 · design chain · Vercel preview = EXIT gate |
