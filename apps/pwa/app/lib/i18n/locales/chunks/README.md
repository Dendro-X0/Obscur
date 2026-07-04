# Locale chunk files (translation workflow)

The full `en.json` template is ~2,100 lines. Split it into **≤1,200 lines** per file for translation tools, then merge back.

## Layout

```
chunks/
  en/   ← source template chunks
  es/
  zh/
  fr/
  de/
```

Each folder uses the same chunk boundaries (key order matches `en.json`).

## Prepare all five languages

From `apps/pwa`:

```bash
pnpm i18n:prepare-chunks
```

This will:

1. Split `en.json` into `chunks/en/` (max **1,200 lines** per file)
2. Build `chunks/es/`, `chunks/zh/`, `chunks/fr/`, `chunks/de/` from existing locale files
   - Translated keys are kept
   - Missing keys fall back to English until you translate that chunk

## Translate

Open each chunk in your tool (e.g. `en.chunk-1-of-2.json` → save as `fr.chunk-1-of-2.json` under `chunks/fr/`).

## Merge

```bash
pnpm i18n:merge-chunks es
pnpm i18n:merge-chunks zh
pnpm i18n:merge-chunks fr
pnpm i18n:merge-chunks de
```

Reports any keys still missing vs `en.json`.

## Individual commands

```bash
pnpm i18n:split-chunks              # en only (default 1200 lines)
pnpm i18n:bootstrap-chunks fr       # one locale from en chunk boundaries
node scripts/i18n/split-locale-chunks.mjs --max-lines 1000
```

Re-run `pnpm i18n:prepare-chunks` after `en.json` grows.
