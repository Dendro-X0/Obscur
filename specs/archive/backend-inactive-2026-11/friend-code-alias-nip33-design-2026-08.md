# Design — Long-lived friend code alias (NIP-33)

**Status:** Design Ready · Segment D blocker  
**Parents:** [friend-code-discovery-unresolvable-investigation-2026-08.md](./friend-code-discovery-unresolvable-investigation-2026-08.md)

```text
CANONICAL OWNER:      friend-code-alias.ts (new) · use-profile-publisher · relay-discovery-query · identity-resolver
SUBTRACT:             Kind-0 lottery as the *primary* invite lookup (keep as fallback only)
PROOF:                L1 alias parse/publish filters · L3 two-profile: save code on A → resolve from B
```

## Decision

Keep the human handle **`OBSCUR-` + 6 characters**. Do **not** replace Settings with `OB2`/`OB3`.

Bind that handle to the **current published npub** with a **parameterized replaceable event** (NIP-33), whose `d` tag **is** the friend code. Relays index `#d`. Lookup is exact, not a 320-event scan.

Kind **31950** (dedicated — do **not** reuse 30078; that kind already means backup / leave-proof / invite-request in this repo).

## Event contract

```text
kind: 31950
tags:
  ["d", "OBSCUR-GBKMBC"]          // lookup key (indexed)
  ["p", "<64-hex npub>"]         // current discovery pubkey
  ["l", "obscur-friend-code"]
content: {"v":1,"code":"OBSCUR-GBKMBC","pubkey":"<64-hex>"}
signed by: the account nsec (same signer as kind 0)
```

| User action | Event |
|-------------|--------|
| Set / change friend code | Replaceable upsert: new `d` = new code. Previous `d` is simply unused (optional later: empty tombstone). |
| Change published profile / “public identity” | Same `d`; update `p` + content to the **current** npub. nsec unchanged. |
| Private key | Never in tags, content, or search parsers |

## Resolve order (Add Friend)

1. Reject nsec / private-key hex (unchanged).  
2. npub / nprofile / contact card / OB2 / OB3 (unchanged).  
3. Canonical `OBSCUR-XXXXXX`:  
   **a.** `REQ` `{ kinds:[31950], "#d":[code], limit:8 }` — pick newest `created_at` with `l=obscur-friend-code` · author pubkey must equal content/`p` pubkey.  
   **b.** Fallback: existing kind-0 `#i`/`#code`/about match (old clients).  
4. Fail honestly if both miss.

## Publish

On successful profile save that includes an invite code, publish **kind 0** (existing) **and** kind **31950**. Alias event: **no** NIP-13 difficulty-12 mine (kind 0 already pays that cost).

Both DemoUser and Tester2 must **Save profile** once after this lands so Segment D can resolve codes.

## Non-goals

- Global uniqueness oracle (two people can collide; newest-on-overlapping-relays wins; Settings “availability check” stays best-effort).  
- Discovery index service.  
- Searching by nsec.  
- Claiming Tor discovery.

## Proof

| Layer | Command / soak |
|-------|----------------|
| L1 | `friend-code-alias.test.ts` · `relay-discovery-query.test.ts` invite `#d` filter · publisher includes kind 31950 |
| L3 | Profile A save `OBSCUR-XXXXXX` → Profile B Discovery Add Friend → Exact match → Send Invitation |
