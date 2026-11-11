# Cut 0.10 — Lab milestone checklist (A7)

**Date:** 2026-11-09  
**Status:** documented + headless H-dc soak script · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut0-account-spine-design-2026-11-09.md](./cut0-account-spine-design-2026-11-09.md) · glue [cut0-private-trust-glue-design-2026-11-09.md](./cut0-private-trust-glue-design-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 0.10 lab checklist — document soak; operator runs L2
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     ENGINE-LAB / desktop private-trust lab
PROOF:               checklist below · L1 already green for 0.1–0.9
```

## Goal

Operator can run a **private-trust lab** (no public Nostr/Matrix peers) against thin H-dc and prove Cut 0 spine honesty — without claiming Soft L3 contact Pass.

## Preconditions

- [ ] Desktop build with libobscur SCHEMA_V6+
- [ ] PDK unlock path only opens DB (0.3/0.4)
- [ ] Local thin H-dc lab server (`scripts/lib/private-dc-lab-server.mjs`) or equivalent on loopback
- [ ] Soft L3 contact Pass remains **paused** (B4)

## Soak steps (L2)

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | Unlock profile with passphrase / keychain PDK | Shell ready; SQLite open | Continuity |
| 2 | Lock / quit | Only `.obscur-enc` durable on disk | SQLCipher |
| 3 | Re-unlock | Decrypt → same profile workspace | — |
| 4 | Upsert sticky CRM edge (trusted) via kernel ports | Edge survives restart; **not** invented from messages | Soft L3 Fixed |
| 5 | Configure home kind=`hdc` + Bearer in keychain | Session binds to loopback H-dc | Public carrier |
| 6 | Health `GET /v1/health` | `ok` + wire `hdc-v0.1` | — |
| 7 | Seal T3 payload → `POST` envelope | Home ACK → message **accepted** (never auto-delivered) | Peer read receipt |
| 8 | Poll `GET …/messages?since=` | Cipher envelopes only; plaintext rows ignored | NIP-17 as T3 |
| 9 | Vault media index upsert | Ref + `content_hash` only; data: URL rejected | Plaintext media in DB |
| 10 | Dual-profile optional | Same machine two profiles isolated | Soft L3 dual CDP |

## L1 evidence already landed

| Slice | Proof |
|-------|-------|
| 0.1–0.4 | SCHEMA_V5 · profile oracle · session fence · mandatory encrypt |
| 0.5 | `db::repositories::relationships` |
| 0.6 | `private-dc-hdc-v01` vitest |
| 0.7 | outbox + `hdc-outbox-status` |
| 0.8 | `t3_hdc` + `dr_sessions` |
| 0.9 | vault ref validation + SCHEMA_V6 |
| Glue | `privateTrust` engine · `t3_hdc_pipeline` · `scripts/cut0-lab-hdc-t3-soak.mjs` (steps 6–8 headless) |

### Headless command (steps 6–8)

```bash
node scripts/cut0-lab-hdc-t3-soak.mjs
```

## Forbidden claims after soak

- Soft L3 Fixed / contact Pass  
- Tor Verified  
- Matrix promote  
- “E2EE done” without T3 path active  
- Packaged production Pass from lab alone  

## NEXT after 0.10

Maintainer may charter Cut UI (Vite) or S1 compose / outbox IPC glue — still under NARROW rewrite band.
