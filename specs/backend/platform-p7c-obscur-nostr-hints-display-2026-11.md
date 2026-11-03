# Design — P7c Obscur-Nostr display + migration hints (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-p7b-obscur-nostr-capabilities-extract-2026-11.md](./platform-p7b-obscur-nostr-capabilities-extract-2026-11.md)

```text
HANDOFF ATOMIC STEP: P7c Obscur-Nostr display + migration hints — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote · mass folder rename
CANONICAL OWNER:     @obscur/protocol-nostr
PROOF:               Package owns display name + nostr migration hints · pwa re-exports/uses · contract Pass
```

## 1. Goal

Third body leaf: module **display name** and **Obscur-Nostr switch/migration hint copy** live in `@obscur/protocol-nostr` so Settings/PAL do not own Nostr product copy.

## 2. Cut

1. `display-name.ts` — `OBSCUR_NOSTR_DISPLAY_NAME`
2. `migration-hints.ts` — `getObscurNostrMigrationHints` · `getObscurNostrSwitchSummary`
3. `module-display-names.ts` + `migration-hints.ts` (pwa) import from package for the nostr branch
4. Matrix / private_dc hints stay in PAL (not this package)

## 3. Non-claims

- Not Matrix promote / Soft L3 / Tor Verified
- Not full adapter extract
