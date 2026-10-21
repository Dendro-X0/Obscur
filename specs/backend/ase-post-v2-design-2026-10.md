# Design — ASE depth after v2 (ASE-2)

**Date (UTC):** 2026-10-10  
**Status:** Design shelf · **no implement** until post-v2 handoff opens ASE-2  
**Parent:** [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md)  
**Roadmap:** [pre-b2b-capability-and-media-roadmap-2026-10.md](../../docs/program/pre-b2b-capability-and-media-roadmap-2026-10.md)

---

```text
NEXT ATOMIC STEP:     None — shelf until v2.0 gate / explicit ASE-2 atomic
PAUSED / CANCELLED:   Anti-scam GTM mission · central message scanning SaaS
CANONICAL OWNER:      dm-kernel trust · m10-shared-intel-policy · privacy settings
PROOF BEFORE DONE:    L1 signal packs · L3 dual-profile banner honesty
SURFACE:              Desktop / PWA after decrypt (recipient-local)
```

---

## 1. Thesis (unchanged)

Technology sets the floor; humans set the ceiling. Friction is explainable. Never blame the user. **Never** ask for nsec/passphrase outside canonical unlock.

ASE remains **on-device assistance** after decrypt — not a moderation plane, not Flowsint-style stranger enrichment.

## 2. ASE-1 floor (already landed — do not regress)

| Surface | Owner |
|---------|--------|
| SE pattern packs + locale | `dm-kernel-trust-social-engineering-*.ts` |
| Trust banner tiers | `use-dm-kernel-trust-banner.ts` |
| Attack mode standard/strict | privacy settings + M10 shared intel |
| Friction L0–L4 model | ASE contract §3 |

Business kill: “anti-scam clean chat” as **mission** — ASE-2 must not revive that GTM.

## 3. ASE-2 slices (post-v2)

### ASE-2a — Pattern / cold-contact packs

| Work | Done when |
|------|-----------|
| Expand locale packs (keep false-positive budget) | L1 corpus tests; L3 benign rapid chat stays ≤ info |
| Cold-contact + payment/urgency bundles | Scores match ASE contract weights |

### ASE-2b — Step-up on secrets / export

| Work | Done when |
|------|-----------|
| L4 on pasted nsec / private scalar in compose | Hard block + teach copy |
| L2–L3 on export / backup flows | Confirm fingerprint / purpose |

### ASE-2c — Link safety integration

| Work | Done when |
|------|-----------|
| Strict profile can default **link_safety** on | Uses PB2 contract; body never leaves device |
| Standard profile opt-in only | Settings honesty |

Depends on [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §7.

### ASE-2d — Shared intel (optional)

| Work | Done when |
|------|-----------|
| Peer-signed risk signals stay local-first | M10 policy; no vendor “protection” backend |

## 4. Non-goals

| Item | Why |
|------|-----|
| Central NLP / cloud scoring of chats | Breaks sovereignty story |
| Username / breach / wallet OSINT in messenger | Flowsint domain; gray adjacency |
| Guaranteeing fraud elimination | Greenfield honesty — assist, don’t police the net |
| Replacing ASE Shield (web/freelance) | Sibling product; no merge |

## 5. Proof plan (per slice)

| Layer | Command / ritual |
|-------|------------------|
| L1 | `pnpm` vitest on dm-kernel trust + M10 policy packs |
| L2 | Fixture streams F-scam vs F-benign (existing trust L3 docs) |
| L3 | Dual-profile: elevated only on seeded SE; benign chat quiet |
| L4 | Optional — second locale pack soak |

## 6. Sequencing vs media

ASE-2 **parallel-ok** with M1 (DM video) only if separate owners and no shared consent regression. Prefer finish ASE-2a/b before M1 if energy is scarce — cheaper hitch differentiator than video.

## 7. Out of scope until chartered

Full “unique anti-SE module” rewrite · importing ase-shield as hard dependency · Web3 scam-mission branding  

---

_Last updated: 2026-10-10_
