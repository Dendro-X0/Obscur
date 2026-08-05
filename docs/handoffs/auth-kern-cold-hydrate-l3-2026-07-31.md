# AUTH-KERN cold hydrate L3 — release exe

- **When:** 2026-07-31T03:47:39.706Z
- **Outcome:** **Pass**
- **Settle:** `shell` · shell=true · gate=false
- **Recipe:** `node scripts/r-account-cold-hydrate-l3-cdp.mjs`

## Matrix

| Check | Result |
|-------|--------|
| Shell without password | Pass |
| Session active | Pass |
| Boot unlocked | Pass |
| Keychain present | Pass |
| Stored ≡ session pubkey | Pass |
| Digest restore succeeded | no |
| Digest restore exhausted | no |

## Claim

| May say | |
|---------|---|
| Cold hydrate fixed (L3) | Yes |
| P2 package verified | **No** — separate re-soak |

JSON: [`auth-kern-cold-hydrate-l3-2026-07-31.json`](./auth-kern-cold-hydrate-l3-2026-07-31.json)
