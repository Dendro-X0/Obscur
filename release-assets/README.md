# Release assets (local installers)

**Manifest:** [manifest.json](./manifest.json) — version, SHA-256, build commit.

| Platform | Artifact | Location |
|----------|----------|----------|
| Windows | `Obscur_1.9.10_x64-setup.exe` | `windows/` (tracked in repo) |
| Android debug | `app-universal-debug.apk` | Build output under `apps/desktop/src-tauri/gen/android/...` (local only; see manifest) |

Build commands from repo root — see [docs/program/obscur-v2-install-build-guide.md](../docs/program/obscur-v2-install-build-guide.md):

- Desktop: `pnpm desktop:package`
- Android (emulator, one ABI): `pnpm build:android:debug:emulator`

Installers are **unsigned** by default — policy: [obscur-v2-phase3-signing-policy.md](../docs/program/obscur-v2-phase3-signing-policy.md).
