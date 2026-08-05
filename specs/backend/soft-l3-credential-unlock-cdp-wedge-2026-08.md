# Soft L3 credential unlock attempt — CDP wedge

**Date (UTC):** 2026-08-04  
**Parent:** [core-relay-operational-status-2026-08.md](./core-relay-operational-status-2026-08.md)  
**Accounts:** Tester1 / Tester2 (fixture passwords via maintainer)

---

## Progress before wedge

| Step | Result |
|------|--------|
| MCP attach | Connected; snapshot/auth timed out under toast load |
| False “locked” chrome | Fixed: session `stored_locked` + network chrome ≠ Soft L3 unlocked |
| Soft-nav `/` → Profiles | Recovered **real** unlock (`identityStatus: unlocked`, pubkey `e07f67dc…`) |
| Soft L3 mid-run | Tester1 shell OK · agreed relay `:7000` · Row C Pass · Tester2 Edge unlock + compose ready |
| Row A | Weak (lab-only publish path while remotes still in pool history) |
| Row B | Hung on `openPeer` (toast-heavy CDP evaluate) → **CDP :9230 wedged** |

Harness fixes kept: profile route `/network/profile?pubkey=` · sliced shell text · softNavigate 8s timeout · session_locked gate · Profiles “Sign in here”.

---

## Result

**Blocked** — dual-profile Soft L3 not completed; desktop CDP died and was restarted.

**Not claimed:** Soft L3 Pass · delivery fixed · public Nostr SLA.

---

## Next

1. Wait for `pnpm dev:desktop:online` CDP `:9230` healthy.
2. Soft-nav `/` → Tester1 Sign in (password if gate) → `pnpm verify:s-pool-delivery-l3`.
3. If Row A blocks on remotes: lab-only dial (`labOnly` already patched) or disable public remotes for Soft L3 honesty.
