# Soak — P2 auth daily-door L3 (2026-11)

**Status:** Pass (L3)  
**Parent:** [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)  
**Fence:** `apps/pwa/app/features/auth/services/auth-daily-door-p2-fence.ts`  
**Artifact:** [platform-p2-daily-door-l3-soak-latest.md](../../docs/handoffs/platform-p2-daily-door-l3-soak-latest.md)

```text
HANDOFF ATOMIC STEP: P2 daily-door L3 copy soak — DONE Pass
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     Auth plane · auth-screen / LockScreen
PROOF:               Desktop CDP matrix all true (passphrase · Advanced · no OAuth · shell reentry)
```

## 1. Goal

Prove on live desktop that the **daily door** matches the P2 fence before claiming Auth plane freeze:

1. Auth gate shows password / passphrase as the primary unlock path.
2. Private key / Import Key is behind **Advanced** (hidden by default when passphrase-primary).
3. No OAuth-as-root on the gate.
4. Password unlock returns to shell (reuses FM1 reentry path).

## 2. Procedure

```text
OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build   # CDP :9230
node scripts/platform-p2-daily-door-l3-soak-cdp.mjs
```

## 3. Matrix

| Check | Pass when |
|-------|-----------|
| `passphrasePrimaryVisible` | Password input visible on gate without opening Advanced |
| `advancedTogglePresent` | Advanced / Hide Advanced private-key control exists |
| `privateKeyHiddenByDefault` | No `nsec` / private-key placeholder until Advanced opened |
| `privateKeyAfterAdvanced` | After Advanced click, key path appears |
| `noOauthOnGate` | Gate text has no OAuth / Sign in with Google (etc.) |
| `passwordReentryShell` | Password unlock reaches NETWORK/Chats/Settings shell |

## 4. Non-claims

- Soft L3 Fixed / Tor Verified / Matrix promote
- Continuity / recovery-plane completeness
- Biometric / PIN as sole daily door

## 5. Artifacts

- `docs/handoffs/platform-p2-daily-door-l3-soak-latest.json`
- `docs/handoffs/platform-p2-daily-door-l3-soak-latest.md`
