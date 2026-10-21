# Investigation — Friend code discovery unresolvable (2026-08-17)

**Status:** Root cause found · design required before more kind-0 lottery patches  
**Parents:** [discovery-friend-code-private-key-2026-07.md](./discovery-friend-code-private-key-2026-07.md)

```text
HANDOFF ATOMIC STEP:  PAUSED — dialect research · optional next was Segment C (now recorded)
PAUSED / CANCELLED:   dialect impl · Tor Verified · groups/** · AUTH-SESSION
CANONICAL OWNER:      identity-resolver · relay-discovery-query · use-profile-publisher · invite-code-format
PROOF BEFORE DONE:    L1 resolver + publisher tests · L3: Tester2 code resolves from DemoUser on clearnet
OUT OF SCOPE:         Searching nsec · Tor Verified · groups/**
```

## Maintainer evidence (Segment D prep)

| Surface | Observation |
|---------|-------------|
| Profile settings | Friend Code = `OBSCUR-` + 6-char suffix (editable · Random · Copy) |
| Tester2 bio | `Find me on Obscur with this code: OBSCUR-GBKMBC` |
| Discovery · Add Friend · `OBSCUR-GBKMBC` | **Fail:** “Invite code could not be resolved. Ask for QR/contact link/npub.” |
| Same flow · Tester2 **npub** | **Pass:** Exact match Tester2 · Send Invitation |

## Parallel owners (subtract, don’t add a fourth)

| Format | Prefix | Resolves how | Long-lived? |
|--------|--------|----------------|-------------|
| Settings UI “Friend Code” | `OBSCUR-XXXXXX` | Relay hunt kind **0** (`#i` / `#code` / NIP-50 / last 180d × 320 events) | Intended yes |
| Friend Code v2 | `OB2-…` | Code **encodes pubkey** (offline) | Yes, but UI does not show it |
| Friend Code v3 | `OB3-…` | Encodes pubkey · **TTL ~10 min** · single-use | **No** — conflicts with “valid long term” |

Settings publish still writes kind 0 tags `code` + `i` and injects the code into `about`. Search classifies `OBSCUR-*` as `invite_code` → `resolveIdentity` step 5 (`legacy_code`).

## Why npub works and `OBSCUR-GBKMBC` does not

npub **is** the identity (32-byte key). No directory needed.

A 6-character suffix **cannot** encode a pubkey. Lookup must find a published mapping. Current mapping is stuffed into **kind 0**, then queried with:

- `#code` / `#i` — most public relays **do not index** arbitrary tags  
- `search` (NIP-50) — often unsupported  
- `{ kinds:[0], since: 180d, limit: 320 }` — lottery on busy public pools  
- timeout **4.5s** (`identity-resolver`) / **5.5s** (query default)

So Tester2 can be perfectly published and still invisible to DemoUser. The 2026-07 fix (merge profile relays into lookup) does not make public relays index `#code`.

## Product invariants (maintainer)

| Invariant | Meaning |
|-----------|---------|
| Private key never in discovery | Already: `parsePublicKeyInput` rejects `nsec` / hex-as-nsec |
| Friend code mutable | Settings suffix is user-owned |
| Public identity mutable | **npub is derived from nsec** and cannot rotate independently; what *can* rotate is the **alias** (friend code) that *points at* the current npub |
| Long-lived friend code | Must not be v3 TTL |

If “change public key, keep private key” means a future overlay key, the alias document stores **whatever pubkey we publish**, still never the nsec.

## Do not patch

- Raise kind-0 `limit` / timeout (still lottery)  
- Default-on discovery index URL (central directory)  
- Make v3 the Settings code (expires)  
- Allow nsec in the search box
