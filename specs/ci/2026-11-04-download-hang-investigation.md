# Investigation: Download CTA hangs / installer appears corrupted

- Date: 2026-11-04
- Symptom: `/download` primary CTA opens a blank Chrome tab titled **Loading…** on
  `github.com/.../releases/download/v2.0.0-beta.4/Obscur_2.0.0_x64-setup.exe`.
  Demo recording / install then fails (“corrupted”).
- Handoff atomic step: cold-run published Windows NSIS → film demo.

## Evidence

1. **Asset on GitHub is intact**
   - API: `size=9292670`, `digest=sha256:a4eb927840aa3d7873477777cb9fd4349b364be82d28b9f49b552d43229365a7`
   - HEAD → 302 → `release-assets.githubusercontent.com` with
     `Content-Disposition: attachment; filename=Obscur_2.0.0_x64-setup.exe`
     and `Content-Length: 9292670`.

2. **Transfer from this network is extremely slow**
   - Public curl ~20–25 KiB/s; 300s timeout left ~7.2 / 9.3 MB (truncated).
   - Truncated file still starts with `MZ` / “Nullsoft Installer” → OS may open it
     then fail as corrupt (matches “recording corrupted” after a hung download).

3. **Site UX amplifies the hang**
   - `apps/website/src/app/download/page.tsx` uses `target="_blank"` on every
     installer/APK href.
   - Navigating an attachment URL in a **new tab** makes Chrome treat the stream as
     document navigation → blank grey page + indefinite **Loading…** while bytes
     crawl (or stall). Same URL without `_blank` typically triggers the download
     shelf and leaves the download page visible.

## Root cause (ranked)

1. **Primary (product):** `target="_blank"` on binary attachment URLs → stuck tab.
2. **Contributing (ops/CDN):** slow/unstable GitHub release-asset CDN → partial files
   look like valid PE/NSIS headers but are truncated → “corrupt installer.”

## Non-causes

- Wrong release tag / missing asset (beta.4 Windows NSIS is published).
- Wrong SHA in API (digest matches manifest once a full transfer completes).
- Local `release-assets/windows/Obscur_2.0.0_x64-setup.exe` is an **older** tree
  copy (9 413 195 B / different SHA) — not the published beta.4 bit-for-bit.

## Fix plan (subtraction first)

1. Stop opening installer/APK links in a new tab; keep doc links on `_blank`.
2. Set `download={assetName}` on installer anchors (best-effort; cross-origin may
   ignore filename but still avoids blank-tab navigation).
3. Demo proof: full download → sha256 match → cold install (Tor OFF) before film.

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | Diff: installer `<a>` has no `target="_blank"`; `download` attr present |
| L2 | `curl -sI -L` asset → `Content-Disposition: attachment`, size 9292670 |
| L3 | Full file sha256 == `a4eb927840aa…` |
| L4 | Cold-run NSIS on Windows (demo checklist) |
