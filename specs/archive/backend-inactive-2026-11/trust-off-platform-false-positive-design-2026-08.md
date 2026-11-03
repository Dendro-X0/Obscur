# Design — Off-platform trust: weak inform, strong warn

**Date (UTC):** 2026-08-21  
**Investigation:** [trust-off-platform-false-positive-investigation-2026-08.md](./trust-off-platform-false-positive-investigation-2026-08.md)  
**Pairs:** [trust-non-ai-intelligence-design-2026-07.md](./trust-non-ai-intelligence-design-2026-07.md) §5 · ASE contract (no LLM)

---

## Invariants

- No LLM / no server scoring.
- Never block delivery on trust tier.
- Cold + SE still **elevated** (BUNDLE_SE_COLD).
- Accepted peer + **lone** off-platform → **info** (or none if pattern does not match).
- Accepted + off-platform **compounded** with financial / urgency / payment SE → **elevated**.

## Pattern tighten (EN + ES)

Require redirect **intent** (move/switch/continue/add me / let’s talk on …).  
**Remove** bare “telegram … chat/message/group” and Spanish bare `en|por telegram`.

## Assessment

After SE cold bundles:

1. If `thread.off_platform_redirect` and peer **accepted** and **not cold**:
   - If also any of: financial signals, urgency, gift_card, advance_fee, irreversible_payment, fake_escrow → **elevated**
   - Else → **info** (info strip, not purple elevated banner)
2. Other SE_STANDALONE (credential, remote access, …) unchanged.

## Corpus

- `se_off_platform_accepted_elevated` → rename/split: payment+WhatsApp stays elevated; add `se_off_platform_accepted_mention_info` for casual “I use Discord for game chat” → none or no elevated.
- Keep cold off-platform elevated.

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest `dm-kernel-trust-assessment` · SE signals · threat corpus |
