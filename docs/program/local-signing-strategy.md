# Local self-signing strategy (desktop + Android)

**Status:** Active · **Implementation:** **Deferred** (2026-06-01 maintainer decision) — focus **functionality first**; return here before v2.0 demo publish  
**Program:** [version-roadmap-scope.md](./version-roadmap-scope.md) · [v1.9.4-scope.md](./v1.9.4-scope.md)  
**Policy:** [maintainer-distribution-policy.md](./maintainer-distribution-policy.md) · [mobile-desktop-version-policy.md](./mobile-desktop-version-policy.md)

---

## Maintainer decision (2026-06-01)

| Surface | Now | Later (pre–v2.0 demo) |
|---------|-----|------------------------|
| **Desktop** | **Unsigned** NSIS installer is enough. Windows “unknown publisher” is expected; users can skip; **public repo** is the trust foundation. | Minisign + optional repo update channel |
| **Android** | **Debug APK** for functional smoke (`pnpm build:android:debug:emulator`). | Release JKS + sideload trust copy |

**Do not block** feature work on `TAURI_SIGNING_PRIVATE_KEY` or release keystore setup.

### If `pnpm desktop:package` fails on signing

Errors like `Missing comment in secret key` or `incorrect updater private key password` mean **`.env.signing.local` has a bad or partial key** — not that the build is broken.

**Fix for unsigned builds:** remove or rename `.env.signing.local`, or leave `TAURI_SIGNING_PRIVATE_KEY` empty. The installer still lands under `release-assets/windows/` when the log says “Continuing copy.”

---

## Goal (when signing is resumed)

Ship **installable, locally signed** desktop and Android artifacts for the v2.0.0 production demo **without** commercial code-signing programs (no Apple Developer, no Play Console EV/OV certs). Users install via **sideload** (desktop `.exe`, Android APK) and trust via **documented fingerprints** + honest copy—not via store badges.

---

## Policy

| Rule | Detail |
|------|--------|
| **Secrets never in git** | Private keys, keystores, passwords live on maintainer machine only |
| **Public keys in repo** | Desktop updater pubkey in `tauri.conf.json`; Android SHA-256 fingerprint published in docs/website when release APK exists |
| **No CI signing secrets required** | Local build → `release-assets/` → optional repo channel push on `main` |
| **Honest UX** | Copy says self-signed / sideload; no “verified publisher” claims |
| **Out of scope** | iOS, Play/App Store upload, purchased Authenticode EV certs (optional later) |

Distribution truth: [unified-version-source.md](./unified-version-source.md).

---

## Two surfaces, two mechanisms

```text
Desktop                         Android
────────                        ───────
Layer A: Tauri minisign         APK signing (JKS)
  → .sig next to installer        → apksigner / Gradle
  → in-app updater verifies       → install + Obtainium / USB sideload
Layer B: Authenticode (optional)
  → NSIS .exe SmartScreen
  → NOT required for v1.9.4
```

| Layer | Desktop | Android | Required for v1.9.4? |
|-------|---------|---------|---------------------|
| **A — Artifact signature** | Minisign (updater + `.sig`) | Release keystore (JKS) | **Yes** for channel + release APK story |
| **B — OS installer trust** | Authenticode on `setup.exe` | Play Protect heuristics | **No** (document “unsigned publisher” on Windows) |

---

## Desktop — Tauri minisign (Layer A)

### What it signs

- Updater payloads and sidecar **`.sig`** files produced during `tauri build` when `bundle.createUpdaterArtifacts` is true.
- Clients verify against the **pubkey** in `apps/desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).

### What it does **not** sign

- The NSIS **installer `.exe`** itself (unless you add separate Authenticode — Layer B).

Local install works from `Obscur_*_x64-setup.exe` **without** the private key. The key is required for:

- Clean `tauri build` exit (no post-bundle signing error)
- `pnpm desktop:package --publish-channel`
- In-app updates from [repo channel](../../apps/desktop/release/channel/stable/README.md)

### Key custody

| Item | Location | Action |
|------|----------|--------|
| **Public key** | `tauri.conf.json` | **Do not change** without a coordinated release that updates all installed clients |
| **Private key** | Maintainer only — password manager + encrypted backup | Never commit; gitignore `updater-key.txt`, `.env.signing.local` |

**If the private key matching the embedded pubkey is lost:** generate a **new** keypair, update `pubkey` in `tauri.conf.json`, bump semver, and treat it as a breaking update for in-app updater users. Do not publish channel manifests with a mismatched keypair.

### Setup (first time or new machine)

1. **Prefer recovering** an existing private key from backup (same pubkey as `tauri.conf.json`).

2. **If generating fresh** (only when re-chartering keys):

   ```bash
   pnpm -C apps/desktop tauri signer generate -w ~/.obscur/updater-key.txt
   ```

   Follow CLI prompts. Store the **password** in your password manager.

3. **Export private key for builds** (Tauri expects env, not a file path in CI):

   ```bash
   pnpm -C apps/desktop tauri signer sign -f ~/.obscur/updater-key.txt --password "…" /dev/null
   # Or read Tauri docs for `TAURI_SIGNING_PRIVATE_KEY` export format
   ```

   Set in `.env.signing.local` (see [`.env.signing.local.example`](../../.env.signing.local.example) at repo root).

4. **Verify pubkey matches config** before publishing channel:

   ```bash
   pnpm -C apps/desktop tauri signer sign -f ~/.obscur/updater-key.txt --password "…" --public-key
   ```

   Compare output to `tauri.conf.json` → `plugins.updater.pubkey`.

### Build workflow

```bash
# Load secrets (bash — or use scripts/load-maintainer-signing-env.mjs via desktop:package)
set -a && source .env.signing.local && set +a

pnpm desktop:ensure-nsis    # Windows only
pnpm desktop:package      # Expect exit 0; .sig beside installer in release-assets/
pnpm desktop:package --publish-channel   # Updates channel/stable/*.json on disk
```

`pnpm desktop:package` loads `.env.signing.local` automatically when present.

**Windows without key:** Installer may still build; script continues copy if only signing step fails — see [local-desktop-packaging.md](./local-desktop-packaging.md).

### Publish in-app updates

After signed artifacts exist under `release-assets/`:

```bash
git add apps/desktop/release/channel/stable version.json
git commit -m "chore(desktop): publish stable update channel"
git push origin main
```

Runbook: [local-desktop-packaging.md](./local-desktop-packaging.md) · channel [README](../../apps/desktop/release/channel/stable/README.md).

---

## Android — release keystore (Layer A)

Canonical detail: [android-p1-signing-runbook.md](./android-p1-signing-runbook.md) § Release APK.

### Summary

| Step | Command / action |
|------|------------------|
| Generate JKS once | `keytool -genkeypair …` → store **outside repo** (e.g. `~/.obscur/obscur-release.jks`) |
| Configure env | `TAURI_ANDROID_KEYSTORE_PATH`, `TAURI_ANDROID_KEYSTORE_PASSWORD`, `TAURI_ANDROID_KEY_ALIAS`, `TAURI_ANDROID_KEY_PASSWORD` in `.env.signing.local` |
| Build | `pnpm build:android:release` |
| Verify | `apksigner verify --verbose …/app-universal-release.apk` |
| Publish fingerprint | SHA-256 cert fingerprint in website/download docs (not the keystore) |

**Debug APK** uses Gradle debug keystore — no maintainer secret; use for Tier 1 smoke before release signing.

**Smoke:** [android-p1-smoke-checklist.md](./android-p1-smoke-checklist.md) Tier 3 (R-1…R-4) once per machine.

### Antivirus

Some tools flag `nsis_tauri_utils.dll` (desktop) or freshly built APKs. Restore from quarantine or add maintainer exception; see [binary-releases NSIS guide](https://github.com/tauri-apps/binary-releases/issues/4).

---

## Maintainer env file

Copy the template:

```bash
cp .env.signing.local.example .env.signing.local
# Edit .env.signing.local — never commit
```

| Variable | Surface |
|----------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Desktop updater |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Desktop (if key encrypted) |
| `TAURI_ANDROID_KEYSTORE_PATH` | Android release |
| `TAURI_ANDROID_KEYSTORE_PASSWORD` | Android |
| `TAURI_ANDROID_KEY_ALIAS` | Android |
| `TAURI_ANDROID_KEY_PASSWORD` | Android |

`.env.signing.local` is gitignored via `.env.*`. Template is committed as `.env.signing.local.example`.

---

## Trust copy (website / demo / B2B)

Use consistent language:

- **Desktop:** “Installer is locally built and self-signed. Windows may show an unknown publisher warning. Verify SHA-256 of the download if we publish a checksum.”
- **Android:** “APK is signed with the maintainer release key (not Play Store). Install via USB or Obtainium; compare certificate fingerprint to the value on our download page.”
- **In-app updates:** “Updates are signed with the key embedded in the app; feed is served from the public Git repo channel.”

Do **not** claim store verification, “relay-confirmed security,” or delete-for-me durability beyond [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md).

---

## Optional — Windows Authenticode (Layer B)

For fewer SmartScreen prompts on `Obscur_*_x64-setup.exe`:

- Create a **self-signed** code-signing cert (PowerShell `New-SelfSignedCertificate` or `signtool`).
- Sign the installer after NSIS build.
- Publish cert fingerprint alongside minisign pubkey.

**Not required** for v1.9.4 exit. Track under v1.9.5+ or v2.0 polish if needed.

`tauri.conf.json` → `bundle.windows.certificateThumbprint` remains `null` until chartered.

---

## Exit criteria (v1.9.4 / v1.9.5)

| ID | Done when |
|----|-----------|
| SIGN-1 | `.env.signing.local.example` in repo; strategy doc linked from scope + packaging |
| SIGN-2 | Desktop: `pnpm desktop:package` exit **0** with `.sig` in `release-assets/windows/` |
| SIGN-3 | Optional v1.9.5: `pnpm desktop:package --publish-channel` + push `main` |
| SIGN-4 | Android: one `pnpm build:android:release` + `apksigner verify` Pass |
| SIGN-5 | Fingerprint / checksum published for demo download page (website or `docs/assets/demo/`) |

Record **Verify** in [version-roadmap-scope.md](./version-roadmap-scope.md) row **P-sign**.

---

## Related commands

```bash
pnpm desktop:ensure-nsis
pnpm desktop:package
pnpm desktop:package --publish-channel
pnpm build:android:release
pnpm build:android:debug:emulator
```

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | Initial strategy — minisign + Android JKS; env template; v1.9.4 exit rows |
