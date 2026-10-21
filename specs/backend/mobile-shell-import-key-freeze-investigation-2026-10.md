# Investigation — mobile-shell Import Key Continue freezes UI

**Date (UTC):** 2026-10-19  
**Status:** CANCELLED by maintainer (2026-10-19) — host freezes during repro; do not resume without lighter method  
**Surface:** `pnpm dev:mobile-shell:online` → http://127.0.0.1:3340 (Chrome device mode)  
**Symptom:** After pasting a private key on Welcome Back → Import Key → Continue, the app freezes.

```text
HANDOFF ATOMIC STEP: Investigate Import Key freeze (mobile shell)
PAUSED / CANCELLED: Soft L3 Fixed · Matrix launch · claim video usable
CANONICAL OWNER:     AuthScreen · auth-kernel import · runtime activation
PROOF BEFORE DONE:   timed repro + root cause; L1 test for the fix class
SURFACE:             browser mobile shell (not APK)
```

## Observed

- UI: Import Key tab, key filled, primary CTA **Continue** (means `hasStoredIdentity === false`).
- First `GET /` under Turbopack was ~18s compile — cold-module cost is real on this surface.

## Hypotheses (ranked)

| ID | Hypothesis | How to falsify |
|----|------------|----------------|
| H1 | Sync Argon2id (64 MiB) on main thread when a passphrase is present | Time `encryptPrivateKeyHex` / Continue with empty vs non-empty password |
| H2 | Post-unlock shell remount + Turbopack compile blocks paint for tens of seconds | Continue with empty passphrase; watch network/compiles and whether spinner clears before freeze |
| H3 | `clearOrphanProfileSlotWorkspace` / IndexedDB wipe hangs | Instrument wipe duration |
| H4 | `activating_runtime` startup overlay until 12s fail-open | Overlay visible; interaction blocked until timeout |
| H5 | Import promise never settles → `isLoading` stuck | Spinner never clears; no toast |

## Flow under Continue (greenfield)

`handleContinueImportKey` → `handleLoginFinal(..., skipPassword)` → `runImportKeyLogin` → `runAuthKernelBoundProfileImport` → `importIdentity` → `promoteUnlockedSession` (`activating_runtime`).

Empty passphrase skips Argon2 encrypt (passwordless sentinel). Non-empty passphrase runs **synchronous** `argon2id` on the UI thread.

## Next

Reproduce with timed Playwright script against :3340; record which hypothesis matches before coding a fix.
