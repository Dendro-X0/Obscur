# Design — Cut 1 Replacement authority (backend-first)

**Date:** 2026-11-09  
**Status:** **CLOSED 1.0–1.6** (L1 + lab checklist; desktop L2 operator soaks optional; Soft L3 not claimed)  
**Parents:** [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md) · Cut 0 spine · F9 NARROW · F1 CRM

```text
HANDOFF ATOMIC STEP: Cut 1 CLOSED — next NARROW cut via maintainer charter
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · unscoped mega-delete
CANONICAL OWNER:     relationship_edge + SQLite messages + kernel outbox + T3/H-dc; chat-state UI cache
PROOF:               L1 per slice · cut1-lab-milestone-checklist · cut1-lab-new-path-soak.mjs
SURFACE:             Tauri desktop primary; browser degraded
```

## 1. Goal

Make **one owner per lifecycle** the product path:

> Sticky CRM · message durability · outbox/retry · private-trust send — all through kernel / `privateTrust` + H-dc (T3), **not** parallel localStorage / IndexedDB / Nostr-default product face.

NARROW product cut unchanged. **Code preservation is not a goal.** Line count is irrelevant.

## 2. Non-goals

- Soft L3 Fixed / contact Pass (B4)  
- Tor Verified · Matrix promote  
- Day-one peer-equal Nostr+Matrix hub  
- Mass-delete safety/quarantine/profile isolation  
- Silent beta wipe · global skills wipe  
- Full Vite UI migrate (Cut UI — after authority cutover unless shell blocks proof)  
- Continuity live multi-device (F-sync Plane 3)

## 3. Keep vs replace (authority map)

### Keep (Cut 0 wedge — become sole writers)

| Lifecycle | Canonical owner |
|-----------|-----------------|
| `profileId` oracle | Desktop window / registry (0.2) |
| PDK open/close | Session orchestrator + `DbState` (0.3–0.4) |
| Sticky CRM | SQLite `relationship_edge` + `privateTrust` CRM methods (0.5) |
| At-rest DB | PDK + `.obscur-enc` (B6) |
| Outbox / home ACK | SQLite `outbox` + `apply_home_ack` / `completeT3HomeAck` (0.7–glue) |
| T3 seal | `t3_hdc_pipeline` + `dr_session` (0.8–glue) |
| H-dc wire | `private-dc-client` v0.1 ciphertext + lab server (0.6) |
| Vault media refs | `vault_media_index` + validate refs-only (0.9) |
| Carrier façade | `ProtocolAdaptationLayer` (adapters only — never CRM/message PK owner) |

### Kill / demote (old owners — Cut 1 target)

| ID | Current owner (as-built) | Why unviable | Replacement | Cutover |
|----|--------------------------|--------------|-------------|---------|
| **K-CRM** | `usePeerTrust` / peer-trust `localStorage` + chat-state `connectionRequests` / removedPeers projections | Dual truth vs `relationship_edge`; Soft L3 class residue | Read/write only via `privateTrust` CRM ports → SQLite | 1.1 |
| **K-MSG-DUR** | IndexedDB `MessageQueue` + chat-state message maps + SQLite `messages` | Dual durability; hydrate races | Native: SQLite only via `dm`/`privateTrust` engine; browser: degraded stub | 1.2 |
| **K-OUTBOX-LS** | `dm-message-queue` (`dm_message_queue_v1` localStorage) + plaintext private keys in queue | Secrets in LS; bypasses kernel outbox | Kernel `outbox` + `prepareT3Outbound` / carrier send ACK | 1.3 |
| **K-SEND-FACE** | Product default send still Nostr (`sendDm` / `sendDmNostrOnly` paths); `private_dc` plaintext body | Contradicts private-trust primary + T3 | Lab/desktop private-trust: `prepareT3Outbound` → H-dc envelope → `completeT3HomeAck`; Nostr = adapter-only when selected | 1.4 |
| **K-CHATSTATE-AUTH** | `chat-state-store-legacy` as authority for social graph + messages | localStorage as backend | Demote to **UI cache / non-authoritative mirror** or delete once readers move | 1.5 |
| **K-PROTO-PLAIN** | `privateDcAdapter.sendMessage({ body })` plaintext wire | Breaks T3 private-trust honesty | Adapter send = envelope path (or refuse plaintext when `crypto_tier=t3`) | 1.4 |

**Explicitly not killed this cut:** Tauri shell chrome, vault quarantine FS, auth single-door screens, Obscur-Nostr module *as optional adapter*, Matrix lab adapter (still non-promoted).

## 4. Cutover law

```text
1. New path writes first (kernel already can).
2. Readers flip to kernel (fail-closed if DB locked).
3. Old writers subtracted (import ban / dead code / throw).
4. Old stores ignored or one-shot migrated into SQLite — never dual-write forever.
5. Proof names L1 owner-uniqueness contracts before claiming slice Pass.
```

**Forbidden:** “Bridge both stores until Soft L3 Pass.” Soft L3 is paused proof debt, not an architecture gate.

## 5. Impl slices (order)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **1.0** | This design **ACK** | Maintainer ACK in handoff |
| **1.1** | CRM: UI/trust directory reads+writes `relationship_edge` via `privateTrust`; subtract peer-trust LS as authority | L1: no product write to peer-trust key for TRUSTED/PENDING; L2: restart sticky edge |
| **1.2** | Message durability: native DM list/send persist only SQLite; IndexedDB MessageQueue fail-closed or unused on Tauri | L1 contract: native path never opens message IDB; L2: message survives restart |
| **1.3** | Outbox: subtract `dm_message_queue_v1`; retries via kernel outbox | L1: grep/ban `QUEUE_KEY`; prepare→ACK path only |
| **1.4** | Private-trust send face: when home=`hdc` / protocol private-trust lab, send = T3 envelope H-dc; refuse plaintext body; Nostr not default | L1: adapter refuse plaintext for T3; soak 6–8 + prepare/ACK; L2 desktop send |
| **1.5** | Chat-state demotion: no longer authority for CRM/messages; delete or quarantine writers | L1: import boundary forbids chat-state CRM/message mutations from social/send paths |
| **1.6** | Lab checklist update — desktop L2 on **new path only**; document old path removed | **Documented** — [cut1-lab-milestone-checklist](./cut1-lab-milestone-checklist-2026-11-09.md) + `scripts/cut1-lab-new-path-soak.mjs`; **≠ Soft L3 Fixed** |

Do not start UI Vite migrate as a substitute for 1.1–1.5.

## 6. Migration (one-shot, optional)

| From | To | Rule |
|------|----|------|
| peer-trust LS trusted set | `relationship_edge` state=trusted | Import once per profile; then ignore LS |
| chat-state connectionRequests | pending edges / request table later | Prefer re-invite over inventing TRUSTED |
| IndexedDB messages | SQLite messages | Native only; browser may stay empty |

Never invent TRUSTED from message lookback (F1).

## 7. Proof plan

| Layer | Cut 1 “done” |
|-------|----------------|
| **L1** | Owner-uniqueness vitest/Rust per slice; `privateTrust` + dm ports; plaintext H-dc rejected for T3 |
| **L2** | Desktop: unlock → CRM edge in SQLite → T3 send/receive on loopback H-dc → lock leaves `.obscur-enc` only; old LS/IDB not required |
| **L3** | Optional dual-profile private-trust soak (**not** Soft L3 contact matrix) |
| **L4** | Packaged optional |

**Forbidden claims:** Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · “rewrite finished” after design-only.

## 8. Risks

- Soft L3 soak scripts still assert LS trust → update or quarantine scripts, do not keep LS authority to satisfy them.  
- `sendDmNostrOnly` used by delete/retry — carve **wire-only** Nostr helpers without making Nostr the product default.  
- Partial 1.1 without 1.5 leaves chat-state resurrecting edges.  
- Scope pile-up (UI+MLS+Tor) — enforce slice order.

## 9. Open items (non-blocking for 1.0 ACK)

1. Exact TS client wrapper for `privateTrust` engine methods (thin port under protocol-adaptation or persistence-engine).  
2. Whether browser Cut 1 is unsupported (lean: **desktop-first**, browser degraded).  
3. One-shot migration UI vs silent import.

## 10. References

- `specs/backend/rewrite-replacement-posture-2026-11-09.md`  
- `specs/backend/cut0-account-spine-design-2026-11-09.md`  
- `specs/backend/cut0-private-trust-glue-design-2026-11-09.md`  
- `docs/exploration/feasibility/01-relationship-authority.md`  
- `apps/pwa/.../peer-trust` · `chat-state-store-legacy` · `dm-message-queue` · `message-queue` · `protocol-adaptation/layer.ts`  
- Archive (historical dual-owner): `specs/archive/backend-inactive-2026-11/dm-persist-dual-owner-*.md`  
