# CI investigation — Obscur Full Release (v1.9.12)

**Status:** investigating · blocked on auth logs  
**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/29430070570  
**Workflow:** `.github/workflows/release.yml` · run #191  
**Commit:** `33d76be` · tag `v1.9.12` · 2026-07-15  
**Iteration:** 1

---

## Failure classification

- **Primary class:** native-build
- **Secondary (do not fix this iteration):** Node.js 20 deprecation warnings on Actions

---

## Job matrix (this run)

| Job | Conclusion | First failed step |
|-----|------------|-------------------|
| Resolve release version | success | — |
| Relay Runtime Smoke | success | — |
| Preflight Checks | success | — |
| Build Web/PWA | success | — |
| Build Desktop (macos) | success | — |
| Build Desktop (windows) | **failure** | Build Desktop Bundles (`pnpm -C apps/desktop tauri build`) |
| Build Desktop (ubuntu) | **failure** | Build Desktop Bundles |
| Build Android | **failure** | Build Android App |
| Build iOS | success | — |
| Verify Artifacts / Publish | **skipped** (needs failed) | — |

**Not failing:** `reliability-gates` on `main` (last green 2026-07-15, run 29430062187).

---

## First error

```text
Public API annotations only show: "Process completed with exit code 1."
Workflow logs require authenticated download (403 without admin token).
```

**Blocked:** agent has no `gh` / `GITHUB_TOKEN`. Maintainer must paste the **Build Desktop Bundles** stderr from Windows + Ubuntu, or run `gh run view 29430070570 --log-failed`.

---

## Context

| Field | Value |
|-------|--------|
| Local Windows package | **PASS** — `release-assets/manifest.json` @ 1.9.12 NSIS |
| GitHub Releases latest | Still **v1.8.11** (Publish never ran for 1.9.x) |
| Reliability pack CI | Green on main |

---

## Root cause hypothesis (max 1 primary)

- **Mechanism:** CI `tauri build` fails on Win/Linux runners while local maintainer package succeeds — likely env/deps/timeout, not product regression.
- **Files to change:** `.github/workflows/release.yml` and/or desktop build scripts — **after** log excerpt exists.

---

## Fix plan (one class)

- [ ] Maintainer pastes failed log excerpt (or auths `gh`)
- [ ] Fix **native-build** only
- [ ] Local tier: `pnpm -C apps/desktop tauri build` (or documented package cmd)
- [ ] Re-dispatch release workflow on tag / workflow_dispatch

**v2.0.0 fast-path alternative (maintainer-accepted):** treat local `pnpm desktop:package` + `release-assets/` as canonical distribution; do not block `v2.0.0` tag on Full Release matrix green. Publish GitHub Release assets manually from `release-assets/windows/`.

---

## Iteration log

| Iter | Result | Next |
|------|--------|------|
| 1 | Classified · logs blocked | Need auth logs or accept local-package path |
