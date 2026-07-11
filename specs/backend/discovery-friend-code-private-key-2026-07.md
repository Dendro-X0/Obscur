# Discovery — friend code + private key hardening (2026-07)

**Status:** Implemented  
**Owners:** `identity-resolver.ts`, `relay-discovery-query.ts`, `parse-public-key-input.ts`  
**Parent band:** [private-key-technical-moat-2026-07.md](./private-key-technical-moat-2026-07.md) Phase 1 (Discovery slice)

## Symptoms

1. `OBSCUR-*` friend codes return no match while npub/nprofile/hex pubkey work.
2. Pasting a 64-char **private key** shows "Unknown contact" (hex resolver path).

## Root causes

| ID | Cause | Fix |
|----|-------|-----|
| RC-1 | Invite relay lookup primed **global relays only** (`damus`, `nos.lol`, `primal`) — local/private-trust profiles on `ws://localhost:7000` never queried | Merge profile **enabled relay URLs** into invite lookup |
| RC-2 | `parsePublicKeyInput` accepts any 64-hex as pubkey — indistinguishable from private key material | Reject `nsec`/`ncryptsec` at parse time; **relay disambiguation** for hex (no profile at hex, profile at `derive(hex)` → `private_key_forbidden`) |
| RC-3 | `discoveryInviteCodeV1` defaults **off** — confusing diagnostics; legacy codes should resolve regardless | Default **on** |

## Proof

- `pnpm test:run app/features/profile/utils/parse-public-key-input.test.ts`
- `pnpm test:run app/features/search/services/identity-resolver.test.ts`
- `pnpm test:run app/features/search/services/relay-discovery-query.test.ts`
