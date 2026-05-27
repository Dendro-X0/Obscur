# Warning & trust model — behavior-based, recipient-only

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19  
**Normative for:** Phase 3 implementation

---

## Core invariants (must never break)

1. **Delivery invariant:** If a warning fires, the message **still arrives** unless Party B has explicitly enabled a personal auto-filter (off by default).
2. **Sender silence invariant:** Party A is never notified that a warning was shown to B.
3. **No platform enforcement invariant:** Vendor-operated services never ban, throttle, or delete accounts/messages based on warning scores.
4. **Reproducibility invariant:** Given rule pack `R` version `v` and event log `E`, any conforming client computes the same tier `t`.
5. **Transparency invariant:** UI shows signal bundle and thresholds, not “AI says scam.”
6. **Neutrality invariant:** Political, religious, or niche hobby content never triggers a tier without a **non-ideological** behavior bundle (e.g. commerce-pressure, fan-out spam).

---

## Warning tiers

| Tier | UX | Typical use |
|------|-----|-------------|
| `none` | No banner | Baseline |
| `info` | Subtle indicator | New key, first contact |
| `elevated` | Banner + expandable rationale | Financial mention in young relationship |
| `critical` | Strong banner + suggested user actions | Commerce-pressure bundle in cold contact |

**Never** map tiers to automatic block, shadowban, or delivery drop at vendor layer.

---

## Signal catalog (behavior events)

Signals are **events**, not keywords. All signals are logged in the assessment payload shown to the recipient.

### Network / metadata (visible without decrypting body)

| Signal ID | Description | Example threshold |
|-----------|-------------|-------------------|
| `key.age` | Hours since first seen | `< 24h` → contributes to `info` |
| `contact.cold` | No mutual prior thread | `true` + financial → `elevated` |
| `msg.rate` | Outbound messages per minute | `> 10/min` → spam shape |
| `invite.fanout` | Distinct invites in window | `> 20/day` |
| `graph.wot_distance` | Hops from recipient WoT root | `none` increases weight |
| `key.rotation_after_block` | New key from cluster after block | suspicious pattern |
| `attachment.repeat_hash` | Same ciphertext hash to many peers | bulk campaign |

### Recipient-local (requires decrypt on B’s device only)

| Signal ID | Description |
|-----------|-------------|
| `commerce.payment_request` | Detected request to send funds (any currency) |
| `commerce.escrow_language` | Escrow / guarantee / “release on confirm” patterns |
| `commerce.urgency_pressure` | Time-bound payment pressure |
| `commerce.channel_shift` | “Continue on Telegram / wire” after warm-up |
| `thread.pivot_financial` | First financial mention within N minutes of first reply |

**Note:** Local detectors use **structural and behavioral** features (timing, payment identifiers, URL classes), not language-specific keyword lists. Multilingual text may use language-agnostic token classes (URLs, numbers, currency symbols, chain addresses).

### Explicitly excluded as global signals

- Single-word triggers (“drug”, “weapon”, political slurs).
- Server-side NLP on plaintext body.
- Sender reputation punishment.

---

## Financial activity policy

**Rule:** Any detected financial solicitation or payment request in conversation context contributes to recipient warning — **regardless of motive** (gift, investment, invoice, donation, crypto, fiat).

| Property | Value |
|----------|-------|
| In-app payments | **Forbidden** — no wallets, swaps, escrow |
| Warning target | Party B only |
| Claim wording | “Financial request detected in {context}” — not “money laundering” |
| Benign FP | Split bills, hobby fundraisers → usually `info` or `elevated`, not `critical`, via bundle rules |

### Example bundle: `BUNDLE_FIN_COLD`

Requires:

- `contact.cold = true`
- `thread.pivot_financial` within 48h of first message
- Optional: `commerce.urgency_pressure`

→ Tier `elevated` or `critical` based on count of commerce-local signals.

---

## Rule packs

```text
rules/
  2026-05-19/
    manifest.json      # version, hash, changelog
    signals.json       # signal definitions
    bundles.json       # AND/OR bundles → tier
    copy.json          # user-facing strings (no legal conclusions)
```

- Clients fetch packs from courier or ship embedded signed bundles.
- Users may pin version or increase personal threshold (stricter / looser).
- Conformance tests: fixture event streams → expected tier (T0-4, T0-6).

---

## User agency (required UI)

- Dismiss / snooze warning (per thread, per signal class).
- “Don’t warn me about financial mentions in this group” (local override).
- Block key / block cluster / leave group — always one gesture away.
- Export rule pack version and last assessment for support (no sender identity leak).

---

## Warning fatigue controls

- Cooldown after dismiss (same bundle, same thread).
- Default sensitivity: **low noise**.
- Metrics (private, local): dismiss rate, block-after-warning rate — tune bundles, not surveillance.

---

## Optional community attestations (Phase 3+)

Separate from vendor warnings:

- Signed statements: “key X sent payment spam to me” — **opt-in feed**, subscriber-controlled.
- Never default global ban list.
- Voucher stake loss on false vouch (see [identity doc](./03-identity-and-sybil.md)).
