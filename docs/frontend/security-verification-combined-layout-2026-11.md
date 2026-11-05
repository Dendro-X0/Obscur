# Frontend spec: Security & Verification — combined identity layout

- **Product:** Obscur desktop settings
- **Surface:** Settings → Security (`SecuritySettingsPanel`)
- **Reference:** Obscur in-app (existing zinc cards, indigo accent)
- **Status:** approved for implement
- **API:** none — layout-only; same `useIdentity` + demo contact hex

## Problem

Two stacked cards (“Your Identity” + “Contact Verification Preview”) teach the same idea — visual fingerprints — but read as separate features. Tip banner adds a third block.

## Goal

One composition: **you vs contact fingerprint**, with copy/status and a single tip. Demo verify action stays educational.

## Layout

```
[Header: shield + title + desc]

┌─ one card ─────────────────────────────────────┐
│  Identity fingerprints                         │
│  Share yours; compare theirs out-of-band.      │
│                                                │
│  ┌─────────────┐  ┌─────────────┐              │
│  │ You         │  │ Demo contact│  md: 2-col   │
│  │ Identicon   │  │ Identicon   │  sm: stack   │
│  │ Verified    │  │ Unverified  │              │
│  │ pubkey+copy │  │ key snippet │              │
│  └─────────────┘  └─────────────┘              │
│                                                │
│  [Verify Identity]  (demo only)                │
│  Ask them to confirm their fingerprint…        │
│                                                │
│  ─ tip row (amber, compact) ─                  │
└────────────────────────────────────────────────┘
```

## Rules

- One card, one job — no nested card for the demo contact.
- You column uses live pubkey; contact column stays fixed demo hex.
- Tip moves inside the card as a compact footer (not a third outer block).
- Preserve i18n keys where possible; add keys only for new combined title/lead.
- Keep `Identicon` / `IdentityVerificationCard` APIs usable elsewhere; panel may inline layout instead of nesting the full demo card chrome.

## Done when

- Settings Security shows a single fingerprint card (responsive 2-col).
- Copy public key + demo verify still work.
- Tip still visible, not a separate full-width card above the fold clutter.
