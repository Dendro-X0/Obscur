# Design — Cut 0 account spine (NARROW rewrite)

**Date:** 2026-11-09  
**Status:** draft — **0.1–0.10 documented** · Cut 0 L1 spine closed (lab L2 soak operator-owned)  
 
 
 
 
 
**Parents:** F9 NARROW · F-confirm A (recorded) · F-msg · F8 · F5 · F4 · 15b · P4b private_dc wire · single-door unlock  
**Feasibility shelf:** `docs/exploration/feasibility/99-synthesis-decision.md` · `23-cut0-confirmation-gate.md` · `24-messaging-plane-skim.md`

```text
HANDOFF ATOMIC STEP: Cut 0 design → then impl slices (spine → DB encrypt harden → H-dc → T3 1:1)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · UI migrate-as-salvage · payments/zaps
CANONICAL OWNER:     platform kernel planes (profile oracle · session · SQLite schema · message ports)
PROOF BEFORE DONE:   per-slice L1; lab L2 on thin H-dc; no Soft L3 claim
SURFACE:             Tauri desktop primary (WebView); browser degraded
```

## 1. Goal

Ship the **NARROW Cut 0** universal account spine so a lab milestone can run:

> **One unlock · one profile · encrypted SQLite · sticky CRM · vault/sandbox · thin H-dc home · T3 1:1 messaging** — **without** public Nostr/Matrix as peers (F-confirm A7).

## 2. Maintainer locks (quote — do not re-litigate)

| ID | Decision |
|----|----------|
| A1 | Message tables after messaging skim (**done** → freeze schema here) |
| A2 | MVP home = **thin H-dc** |
| A3 | S1 reference compose = **later** |
| A4 | Launch crypto = **T3** (Obscur DR / F5 E2) |
| A5 | At-rest DB encrypt = **same band as spine** |
| A6 | Linked-identity secrets = **OS keychain** |
| A7 | Lab without public carrier = **yes** |
| A8 | Payments/zaps = **non-goal** |

**B4 assumed:** Soft L3 contact Pass stays **paused** through Cut 0 ship (schema ≠ Pass).

## 3. Non-goals

- Soft L3 Fixed / contact Pass  
- Tor Verified · Matrix promote  
- Peer-equal Nostr/Matrix apps  
- T4 MLS groups · calls · notifications product  
- Next.js → Vite migration (Cut UI)  
- SQLCipher adoption (see B6)  
- Continuity live multi-device CRDT  
- Payments / zaps  
- OAuth root  

## 4. Architecture

```text
┌─ TS UI (thin; Next kept) ─────────────────────────────────┐
│  Auth door screens · read models (TanStack Query)           │
└──────────────────────────┬────────────────────────────────┘
                           │ one-hop IPC
┌──────────────────────────▼────────────────────────────────┐
│  Kernel (Rust + existing native commands → crate-bound)     │
│  profile oracle · session orchestrator · PDK/keychain       │
│  SQLite schema · relationship · conversation/message/outbox │
│  vault index · home registry · DR sessions (T3)             │
└───────┬─────────────────────────────┬─────────────────────┘
        │                             │
   vault CAS                    thin H-dc adapter
   (envelopes)                  (ciphertext transport)
```

**Law:** carriers never own CRM or message PKs; H-dc delivers opaque blobs; UI never holds long-term secrets.

## 5. B6 — At-rest mechanism pick (**decided in this design**)

| Option | Verdict |
|--------|---------|
| SQLCipher / SEE | **Defer** — license/ops; not required for A5 |
| **Whole-file AEAD (PDK + `.obscur-enc`)** | **Cut 0 choose** — already in `libobscur::storage_at_rest` + `DbState::unlock_with_key` |
| OS disk encryption only | Reject as sole control |
| Per-row AEAD inside clear SQLite | Optional later; not Cut 0 default |

**Cut 0 rule:** every profile workspace DB **must** open only via PDK unlock; plaintext SQLite on disk after lock/quit is a **defect**. Harden existing envelope path (encrypt-on-close / decrypt-on-unlock); no parallel clear-DB product path for desktop lab.

**B3 lean:** **single SQLite file per profile** (graph + messages + homes together). Split files = later if Continuity payload size forces it.

**Body storage lean (F-msg Q1):** plaintext rows **inside** the unlocked DB process; confidentiality = file envelope + vault for media. No second per-row AEAD in Cut 0.

## 6. Schema spine (frozen shape)

Migrations owned by kernel. Carrier event ids = secondary indexes only.

| Table | Purpose |
|-------|---------|
| `auth_meta` | KDF/wrap versions (no raw keys) |
| `profile` | display · isolation flags |
| `linked_identity` | carrier · external id · **keychain secret ref** (A6) |
| `relationship_edge` | sticky CRM (F1) |
| `home` | named homes; Cut 0 default kind = `hdc` |
| `conversation` | `kind` dm\|group · `peer_or_group_key` · `home_id` · `crypto_tier` |
| `message` | canonical body · `status` · timestamps · `deleted_at?` · optional `home_message_id` |
| `outbox` | retry schedule · attempt_count · last_error |
| `vault_index` | CAS descriptors |
| `dr_session` | T3 ratchet opaque blob (per conversation / device) |
| `continuity_cursor` | stub OK |

**Status enum (frozen):** `sending | queued | accepted | rejected | delivered | failed`  
Home ACK → `accepted` only. Never map home OK → `delivered`.

**Group rows:** allowed as stubs; `crypto_tier` must not claim T3/T4 until MLS cut.

## 7. Thin H-dc wire (A2) — Cut 0 contract

Extend P4b v0 into **ciphertext-aware** v0.1 (plaintext `body` **rejected** for private-trust T3 paths):

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/v1/health` | liveness |
| `GET` | `/v1/conversations` | id + opaque metadata only |
| `GET` | `/v1/conversations/{id}/messages` | returns **ciphertext envelopes** + ids + sentAt |
| `POST` | `/v1/conversations/{id}/messages` | `{ "envelope": <opaque>, "clientMessageId" }` → home id ACK |

**Auth to home:** Bearer token stored in **OS keychain** via `linked_identity` / home secret ref (A6).  
**Receive MVP lean:** **poll** `GET …/messages?since=` for Cut 0 (F-msg Q2); websocket push later.  
**Fail-closed:** no silent fallback to public Nostr.

S1 compose (Docker/Caddy) = **after** this contract (A3).

## 8. T3 / E2 hooks (A4)

| Requirement | Cut 0 expectation |
|-------------|-------------------|
| Obscur Double Ratchet for private-trust 1:1 | **In band** — session in `dr_session`; seal message payloads before H-dc POST |
| Multi-device Sesame enroll | **Single-device T3 first** for lab; multi-device = later Continuity/M5 |
| NIP-17 / gift-wrap | Adapter-only later; **must not** be labeled T3 |
| UI tier badge | Show T3 only when DR path active; otherwise block “secure private-trust” launch copy |

Sequence dependency: schema + PDK envelope **before** DR send path.

## 9. Profile oracle + session (B1 / B2)

| Concern | Owner (Cut 0) | UI may |
|---------|---------------|--------|
| `profileId` oracle | Desktop native profile registry / window binding (one writer) | Display switcher only |
| Session orchestrator | Native/auth kernel commands (Planes 1–2 per 15b + single-door) | Screens + events; **no** parallel PDK open in React feature modules |
| Keychain PDK + home tokens | `native_keychain` + profile-scoped names | Never read raw tokens into JS logs |

Subtract: any second profile-id string inventing paths in feature code.

## 10. Impl slices (order)

| Slice | Deliver | Proof gate |
|-------|---------|------------|
| **0.0** | Design accepted (this doc) | **ACK 2026-11-09** |
| **0.1** | Schema migrations for spine tables in kernel DB | **L1 Pass** — `cargo test -p libobscur --lib db::` (49) · SCHEMA_V5 |
| **0.2** | Profile oracle single-writer audit + subtract dupes | **L1 Pass** — kill global `last_known.v1`; window-label only; contract ratchet |
| **0.3** | Session orchestrator fence (PDK open only via unlock commands) | **L1 Pass** — `session-storage-orchestrator` · feature rebind/probe · contract ratchet |
| **0.4** | At-rest **mandatory** envelope on lock/quit; no clear durable path | **L1 Pass** — lock always encrypts w/ PDK; bootstrap/ensure refuse clear reopen |
| **0.5** | CRM `relationship_edge` read/write ports (no history invent) | **L1 Pass** — `relationships` upsert/get/list/removed · messages never invent edges · Soft L3 **not** claimed |
| **0.6** | Thin H-dc v0.1 client (ciphertext) + poll receive | **L1 Pass** — `privateDcHealth` / `SendEnvelope` / `ListMessageEnvelopes?since=` · plaintext-only rows dropped · lab `/v1/health`+envelope |
| **0.7** | Outbox + status machine wired to H-dc ACK | **L1 Pass** — outbox enqueue/due/bump · `apply_home_ack` → accepted≠delivered · TS `mapHomeAckToStatus` |
| **0.8** | T3 DR send/receive 1:1 over H-dc | **L1 Pass** — `seal_t3_hdc_envelope`/`open` · `dr_session` persist · Alice→Bob vectors (NIP-17 ≠ T3) |
| **0.9** | Vault envelopes kept; media refs on messages | **L1 Pass** — SCHEMA_V6 `content_hash` · reject data:/blob: URLs · refs only |
| **0.10** | Lab milestone checklist (A7) | **Documented** — `cut0-lab-milestone-checklist-2026-11-09.md` · still ≠ Soft L3 |

Do not start 0.8 before 0.4 + 0.6.

## 11. Proof plan (B5)

| Layer | What “Cut 0 done” requires |
|-------|----------------------------|
| **L1** | Vitest/Rust tests per slice 0.1–0.9; status machine; H-dc fail-closed; DR unit vectors |
| **L2** | Desktop: unlock → encrypted DB open → send/receive 1:1 on local thin H-dc → lock leaves `.obscur-enc` only |
| **L3** | Optional dual-profile private-trust soak (not Soft L3 contact matrix) |
| **L4** | Packaged build optional; not required to close design |

**Forbidden claims:** Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · “E2EE” without T3 path.

## 12. Risks

- Scope pile-up (A2+A4+A5): enforce slice order.  
- P4b plaintext body leaking into T3 path.  
- Dual message owners (chat-state + SQLite).  
- Calling lab messaging Soft L3.  
- Starting impl before 0.0 ACK.

## 13. Open items (non-blocking for 0.1)

1. Exact DR crate/API (existing vs new module under `libobscur`).  
2. H-dc envelope byte format (version byte + nonce + ciphertext).  
3. Whether web/PWA Cut 0 lab is unsupported (lean: **desktop-only lab**).  

## 14. References

- `docs/exploration/feasibility/23-cut0-confirmation-gate.md`  
- `docs/exploration/feasibility/24-messaging-plane-skim.md`  
- `docs/exploration/feasibility/99-synthesis-decision.md`  
- `specs/backend/platform-p4b-private-dc-http-wire-design-2026-11.md`  
- `specs/backend/single-door-unlock-design-2026-11.md`  
- `packages/libobscur/src/storage_at_rest.rs` · `apps/desktop/src-tauri/src/commands/db.rs`  
