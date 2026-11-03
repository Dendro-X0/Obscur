# Investigation — i18n key leaks (presetPath + videoCall)

**Date (UTC):** 2026-10-25  
**Status:** Fixed (L1) — 30 keys added to en/zh/es/fr/de · chunks refreshed  
**Surface:** Packaged desktop (production) · Settings → Relays · DM chat header  
**Locales:** `en` · `zh` · `es` · `fr` · `de` (`apps/pwa/app/lib/i18n/locales/*.json`)

```text
HANDOFF ATOMIC STEP: user override — fix visible localization leaks (not B2 smoke)
PAUSED / CANCELLED: Soft L3 · Matrix · Tor Verified · video usable · Spaces
CLAIM RULE: Adding messaging.videoCall* strings ≠ claiming video usable
```

## Symptom

Production UI shows raw keys instead of copy:

- `settings.relays.presetPath.everyday` (+ Desc) · `.hybrid` · `.local` · `.tor`
- `messaging.videoCall` (chat header button)

Language picker correctly lists five voices (English / 简体中文 / Español / Français / Deutsch).

## Root cause

UI references keys that were never written into any of the five locale bundles.

| Source | Keys | Present in en.json? |
|--------|------|---------------------|
| `STANDARD_TRANSPORT_PRESET_GROUPS` (`transport-preset-catalog.ts`) | `settings.relays.presetPath.*` (8) | **No** — related `presetGroup.*` / `preset.*` exist |
| Chat header / mobile header / invite/dock/main-shell | `messaging.videoCall*` (+ `mediaConsent.videoCall`) | **No** — `messaging.voiceCall*` family exists |

i18next `returnNull: false` → missing key returns the key string → raw keys in UI.

Inline `t(key, default)` fallbacks work only when callers pass a default; chat header uses `t("messaging.videoCall")` with **no** default.

## Non-causes

- Wrong language selected (EN still leaks)
- Chunk merge / HMR (runtime loads full `locales/*.json` via `config.ts`)
- Five-locale registry incomplete (`supportedLngs` already has all five)

## Fix plan (smallest)

1. Add the 8 `presetPath.*` keys + the `messaging.videoCall*` / `mediaConsent.videoCall` keys used by shipped UI to **all five** locale files.
2. L1: script asserts keys exist in every locale; focused vitests still pass (they mock `t` → key).
3. Do **not** claim video usable; do **not** re-package unless maintainer asks.

## Out of scope

Full 388-key audit of every string literal in `apps/pwa` (many are telemetry / gate IDs, not UI).

_Last updated: 2026-10-25T14:20:00Z_
