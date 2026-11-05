# CI investigation — Full Release 42003472823 (v2.0.0-beta.5)

**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/42003472823  
**Verdict:** Publish skipped — desktop assert + Android build failed  
**Class (primary):** workflow / version assert (marketing tag vs package semver)

## Primary failure

**Job:** Build Desktop (all matrix)  
**Step:** Assert tag matches package version  
**Error:** `Version mismatch: tag=2.0.0-beta.5 package.json=2.0.0 tauri.conf=2.0.0`

**Cause:** Dispatch used `--ref v2.0.0-beta.5`, so `github.ref` is `refs/tags/…` and the assert requires **exact** equality with `package.json` (2.0.0). Marketing tags `2.0.0-beta.N` are allowed in `resolve-release-version` but not in this desktop assert.

**Working pattern (beta.4):** `workflow_dispatch` from **`main`** with `release_tag=v2.0.0-beta.4` — assert step is skipped (`if: startsWith(github.ref, 'refs/tags/v')`).

## Secondary failure

**Job:** Build Android  
**Error:** Gradle `:app:rustBuildArm64Release` / BuildTask configuration (`value not set`)  
May reproduce on main dispatch; triage after desktop path green if needed.

## Fix plan (iterate one class)

1. Align desktop assert with resolve job (allow `${PKG}-*` marketing tags).  
2. After `tauri android init`, `git checkout -- …/buildSrc` so init cannot leave a half-new BuildTask (`projectDir` required). Mark BuildTask `@Optional` for Gradle 8.14.  
3. **Retry 42030064706 failed Preflight:** `docs:check` stale-path-ref to local `obscur_desktop_app.exe` — ignore `target/release` in docs-check; keep handoff free of CI-absent paths.  
4. Re-dispatch Full Release from **`main`** with `release_tag=v2.0.0-beta.5` + `publish_release=true`.
