# CU-UX-4 steward roles L3 soak

**At:** 2026-10-21T03:44:00Z  
**Claim:** L3-stack+policy+CDP-attach Pass · dual-profile steward promote UI still Skipped

| Check | Result | Detail |
|-------|--------|--------|
| L3-stack-relay | Pass | `ws://127.0.0.1:7000` |
| L3-stack-coordination | Pass | `/health` 200 |
| L3-shell-steward-ui | Pass | badge + Make steward in static shell |
| L3-policy-contract | Pass | vitest steward promote/demote/last_steward |
| L3-cdp-attach | Pass | Tester1 unlocked · Relays private mesh present |
| L3-ui-dual-profile-promote | Skipped | CDP New Group clicks hang — operator finish |

## Operator finish (dual-profile promote)

1. Profile A: Settings → Relays — keep `ws://localhost:7000` enabled; coordination `http://127.0.0.1:8787`.
2. **New Group** → **My team relay** → create on `localhost:7000`.
3. Invite Profile B; B joins.
4. A → Members → **Make steward** on B; confirm Steward badge.
5. Demote last steward → blocked toast.

## Evidence

- JSON: `docs/handoffs/cu-ux-4-steward-roles-l3-soak-latest.json`
- Script: `scripts/cu-ux-4-steward-roles-l3-soak.mjs`
- CDP session: `csess-0fc3c320ca26`
