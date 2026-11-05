# Frontend spec — Discovery dual-channel Add Friend

**Date:** 2026-11-04  
**Surface:** Discovery (`search-page-client`) Share dialog + Exact Match paste; onboarding `ShareInviteCard` follow-up  
**Parents:** [durable-add-friend design](../backend/2026-11-04-durable-add-friend-design.md) · [selective-friendship positioning](../../docs/program/selective-friendship-positioning-2026-11.md)  
**API / owners:** contact-card · friend-code-v2/v3 · identity-resolver (already landed)  
**Spec status:** implemented 2026-11-04 — Discovery Share dual-lane + ShareInviteCard durable QR; demo film still open

```text
HANDOFF ATOMIC STEP: RECORD DEMO FIRST — durable Add Friend on camera
PAUSED: Soft L3 · Tor Verified · Matrix promote
PROOF: L2 paste OB2 + L3 QR scan / remote copy between Tester1↔Tester2
```

## Purpose

Make **in-person** (QR / optional OB3) and **remote** (link / OB2 / npub) equally obvious, with durable tokens as hero and vanity demoted.

## Current gap

Discovery Share already builds contact-card QR + OB2/OB3, but the dialog **leads with OB3** and lists codes as a flat stack. Onboarding `ShareInviteCard` still QR-encodes `/invite/{OBSCUR-*}` vanity — wrong payload for in-person.

## Share dialog composition

```
[eyebrow] Share contact
[title]   Add you on purpose
[desc]    Scan in person, or send a durable link online.

┌─ In person ─────────────────┐  ┌─ Remote ──────────────────┐
│  QR (card deep link)        │  │  Copy link                 │
│  large, always visible      │  │  Copy OB2                  │
│  [Show pairing code OB3]    │  │  Advanced ▸ npub / vanity  │
│  collapsed by default       │  │                            │
└─────────────────────────────┘  └────────────────────────────┘
```

### Hierarchy rules

| Priority | Control | Notes |
|----------|---------|--------|
| P0 | QR from contact-card deep link | Never vanity invite URL |
| P0 | Copy link / Copy OB2 | Remote path |
| P1 | OB3 “Pairing code” | Collapsed; expiry visible when open |
| P2 | npub / hex | Advanced |
| P3 | `OBSCUR-*` | Advanced + honesty chip |

### Copy

- In person lane label: “In person”  
- Remote lane label: “Send online”  
- OB2 helper: “Works without searching the network”  
- Vanity helper: “Needs discovery relays · can change if you regenerate”  
- Do not say friend codes “always work” or “meet anyone”

## Add (Exact Match) composition

Keep **one** input. Placeholder / helper:

> Paste a link, OB2, npub — or scan a contact QR

Empty / legacy-fail honesty (unchanged intent):

> Ask for a QR, contact link, or OB2 — short OBSCUR codes need discovery relays.

Show resolve path chip when matched: `card | ob2 | ob3 | npub | hex | legacy_alias`.

## Onboarding follow-up (same band, second slice)

`ShareInviteCard`: switch QR + magic link to **contact-card / OB2** (reuse Discovery encode helpers). Do not ship a second vanity-only share product.

## Non-goals

- Separate “In person app” vs “Remote app”  
- Camera scanner polish beyond what desktop already has for demo  
- Soft L3 / Tor / Matrix / username directory  
- Redesigning whole Discovery page chrome

## Acceptance

- [x] Share dialog: QR + remote copy are first-screen; OB3 and vanity not primary  
- [x] QR payload = contact-card deep link (Discovery + ShareInviteCard)  
- [x] Remote: Copy link / card / OB2 first-screen; vanity under Advanced  
- [x] Exact Match placeholders + legacy-fail copy updated  
- [ ] Demo cold-run: in-person QR **or** remote OB2/link between Tester accounts (no `OBSCUR-*` on camera)  
- L1: `vitest` contact-card + friend-code-v2 + identity-resolver — Pass 2026-11-04
