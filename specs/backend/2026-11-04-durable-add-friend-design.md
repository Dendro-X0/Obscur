# Design: Durable Add Friend (replace fragile OBSCUR-* as primary)

```text
HANDOFF ATOMIC STEP: RECORD DEMO FIRST — add-friend must work on camera
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote
CANONICAL OWNER: Discovery / identity-resolver · profile share surfaces
PROOF BEFORE DONE: L1 contracts · L2 resolve each primary token offline-capable · L3 two-account invite
SURFACE: Tauri desktop Discovery → Add Friend
```

## Problem (operator evidence)

Short `OBSCUR-XXXXXX` “friend codes” feel like stable handles, but they are **not**:

| Property | Reality today |
|----------|----------------|
| Persistence | Random suffix stored in local profile; **not** derived from pubkey |
| Resolution | Needs kind 0 `#i` and/or kind **31950** on **public** discovery relays |
| Replaceability | User (or Random) can mint a new code anytime → old codes orphan |
| Offline / private-trust | Fail when discovery relays are empty, dial-capped, or filter-hostile |
| Expiry UX | Codes don’t TTL, but **appear** “outdated” when relay mirror is missing |

Recent failures (`OBSCUR-5KMPFN`, `OBSCUR-PS2S5E`, `OBSCUR-GBKMBC`) mixed true relay-empty cases, REQ filter bugs, and Safe Mode paths — reinforcing the wrong product lesson: “friend codes are unreliable.”

**Root product issue:** We marketed a short directory alias as if it were identity.

## What already exists (do not reinvent)

| Token | Durable? | Needs relays to resolve? | Role |
|-------|----------|---------------------------|------|
| **npub / hex** | Yes (is the identity) | No for resolve; yes for metadata | Canonical |
| **Contact card** (`obscur-card:` / `obscur://contact?card=`) | Yes while unexpired (default 30d) + optional sig | No | Signed share packet (pubkey + relays + label) |
| **Friend Code v2 `OB2-…`** | Yes (embeds pubkey + relays) | No | Compact self-describing code |
| **Friend Code v3 `OB3-…`** | Intentionally **ephemeral** (TTL / single-use) | No | Pairing / in-person short window |
| **Legacy `OBSCUR-…`** | Soft alias only | **Yes** | Human-memorable vanity — secondary |

Resolver order today already prefers card → OB3 → OB2 → npub/hex → legacy. The **UI** still centers the fragile token.

## Design decision

**Primary add-friend path = self-describing tokens** (card / QR / OB2 / npub).  
**Legacy `OBSCUR-*` = optional vanity**, never the only way to add someone, never claimed “permanent.”

No new directory service, no OAuth, no Matrix promote. Private-trust stays: identity is the key; share packets carry keys, not usernames-as-accounts.

**Why (positioning):** Obscur optimizes for **selective, high-satisfaction** connection — depth / interest / trust — not high-attention low-satisfaction stranger graphs. Friction to add is intentional. See [selective-friendship-positioning-2026-11.md](../../docs/program/selective-friendship-positioning-2026-11.md).

## Dual channel (required)

Obscur must support **both** convenient in-person add **and** remote online add. Same identity payload; different affordances.

| Channel | Job | Primary affordances | Must not depend on |
|---------|-----|---------------------|--------------------|
| **In person** | Fast, same-room introduction | **Scan QR** (contact-card deep link); optional short **OB3** pairing (~10 min) | Public discovery relays, vanity `OBSCUR-*` |
| **Remote / online** | Add when not co-located | **Copy link / card**, **OB2**, npub (chat/email/elsewhere) | Being physically present; QR camera |

**Rules**

1. In-person QR payload = **durable contact card** (`obscur://contact?card=…` / `obscur-card:`), never `/invite/OBSCUR-*` vanity URL.  
2. Remote share defaults to the **same card** + **OB2** (“works without searching the network”).  
3. OB3 is **in-person / temporary only** — not the remote hero.  
4. Vanity `OBSCUR-*` stays Advanced / optional for both channels.  
5. Add surface stays **one paste/scan field** that accepts all token kinds (channel is how you obtained the token, not a second product).

## Target UX (Add Friend)

### Share (you → peer)

One action: **Share contact** — two labeled lanes (not two products):

**In person**

1. **QR** — contact-card deep link (default, always visible)  
2. Optional collapsed: **Pairing code** `OB3-…` (~10 min, “expires soon”)

**Remote**

1. **Copy link / card** — same durable payload as QR  
2. **Copy durable code** — `OB2-…`  
3. Advanced (collapsed): npub, hex, optional vanity `OBSCUR-*` with honesty chip:  
   “Needs discovery relays · can change if you regenerate”

### Add (peer → you)

Paste/scan **one** field that accepts, in order:

1. Contact card / deep link / QR decode  
2. `OB2` / `OB3`  
3. npub / hex  
4. Legacy `OBSCUR-*` (best-effort; failure copy points to QR/OB2, not “code outdated”)

Exact Match empty state copy (honesty):

> No durable token found. Ask for a QR, contact link, or OB2 code — short OBSCUR codes only work when both sides published to discovery relays.

### Diagnostics

- Lookups that run via invite/resolve must increment the same diagnostics as text search (fix Safe Mode blind spot).  
- Show **resolve path** on Exact Match: `card | ob2 | ob3 | npub | hex | legacy_alias`.

## Persistence rules

| Token | Persist how |
|-------|-------------|
| Identity | Local key material (unchanged) |
| Contact after accept | Local peer trust / DM connection (unchanged) |
| Share packet | Regenerable anytime from pubkey + enabled relays — **no server state** |
| Vanity `OBSCUR-*` | Optional; on change, publish new 31950 + kind 0 `#i`; old aliases may linger until replaceable NIP-33 overwrite |

**Do not** invent a global short-name registry. That recreates usernames and surveillance surface.

## Demo / near-term sequencing

1. **UI dual-lane:** Implement [frontend-spec-discovery-dual-channel-add-friend-2026-11.md](../frontend/frontend-spec-discovery-dual-channel-add-friend-2026-11.md) — In person (QR) + Remote (link/OB2); demote OB3/vanity.  
2. **Demo film:** Show both channels once (QR scan *or* remote OB2/link) Tester1↔Tester2; never depend on `OBSCUR-*` on camera.  
3. **Keep** relay filter fix + 31950 publish so vanity still works when operators want it.  
4. **Rewrite band later:** Single “Share contact” component reused in onboarding + Discovery + profile; delete duplicate invite UX.

## Non-goals

- Soft L3 / Tor Verified claims  
- Matrix / Private DC as add-friend transport  
- Central username directory  
- Claiming video usable  

## Proof plan

| Layer | Check |
|-------|--------|
| L1 | Resolver tests: card/OB2/npub succeed without pool events; legacy still optional |
| L2 | Two cold profiles: paste OB2 / scan QR → Exact Match with pubkey |
| L3 | Demo segment: Add Friend without typing `OBSCUR-*` |
| L4 | Vanity path: after profile save, `#i` + 31950 resolve (regression only) |

## Claim language

- Say: “Share a contact QR or OB2 code — it carries their public key.”  
- Do **not** say: “Friend codes never expire / always find anyone on the network.”
