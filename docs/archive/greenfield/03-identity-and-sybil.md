# Identity & anti-abuse — without mandatory real-world ID

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19

---

## Design stance

| Goal | Mechanism |
|------|-----------|
| Easy new identities for legitimate users | Keys are cheap; display names are claims |
| Expensive abuse at scale | Rates + invites + WoT + optional economic cost |
| Optional higher trust | Attestations (email, phone, passkey cluster) as **badges**, not roots |
| No vendor ban hammer | User blocks; warnings only inform |

There is **no** configuration that achieves: anonymous + zero friction + zero bots + zero Sybil.

---

## Identity roots

```text
Account
 └── Profile (human-facing)
      └── Device key(s)
           └── Session / prekeys for E2EE
```

- Registration = generate key material locally.
- **No** email/phone required for `account.create`.
- Optional: `attestation.email_verified` → UI badge only.

---

## Contact establishment (anti-spam by default)

| Mode | Default | Description |
|------|---------|-------------|
| Invite artifact | **On** | QR, short code, deep link — out-of-band |
| Cold DM | **Off** or strict | Stranger must pass PoW / fee / manual accept |
| Public username lookup | Phase 4+ | Hashed directory on chosen courier, opt-in |

---

## Sybil / bot friction ladder

### Tier A — Always on (low user cost)

- Per-key rate limits (messages, new chats, group joins).
- Exponential backoff on repeated cold contact failures.
- Block list is local-first, syncs via courier signed state.

### Tier B — Social cost (recommended default)

- **Web of trust (WoT):** depth from user’s trusted roots.
- Messages from `wot_distance = ∞` (outside web) use stricter rate + warning weights.
- **Invite tree:** group admission may require `depth ≤ 2` or admin approval.

### Tier C — Economic cost (optional per deployment)

- Proof-of-work on first cold message (delay bots).
- One-time creation voucher (anonymous payment token) — raises farm cost without naming users.
- CAPTCHA at **courier edge** only (weak alone).

### Tier D — Strong optional anchors

- Passkey / secure enclave binding (“this device cluster”).
- Email/phone verification badge (user opts in).
- Never required for basic 1:1 among invited humans.

---

## Vouching with stake (anti-poisoned WoT)

- Party V signs `vouch(key_B, stake= reputation_points)`.
- If B is reported by multiple opted-in peers for payment-spam pattern, V loses stake (signed ledger).
- Prevents infinite fresh keys inside trusted subgraph without cost.

---

## Impersonation

- Safety numbers / key transparency for high-stakes chats.
- UI: **display name ≠ verified identity** always visible.
- Out-of-band re-confirm (QR) before suppressing `critical` financial warnings.

---

## Group admission policy object (signed)

```json
{
  "version": 1,
  "rules": {
    "min_wot_depth": 1,
    "require_pow": false,
    "admin_approve": true,
    "max_joins_per_day": 50
  }
}
```

Enforced by clients; courier stores signed head; relays are hints only.

---

## Relationship to warnings

| Identity signal | Effect on warnings |
|-----------------|-------------------|
| `key.age` low | +weight |
| `wot_distance` high | +weight |
| `attestation.*` present | −weight (never zero commerce checks in cold fraud) |
| User dismiss prior | cooldown |

---

## Metrics (Phase 3 tuning)

- Messages per new key before rate limit.
- % cold contacts that trigger `elevated+` warnings.
- False positive reports on benign financial fixtures.
- Block rate after warning (user choice, not vendor action).
