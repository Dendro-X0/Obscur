# Feasibility — Universal auth · profile · DB candidates

**ID:** F8  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-auth-schemes-solution · F-auth-profile · F-hub · F-stack · F-sync · F-PSE · F4 · F7 · sandboxed-storage design  
**As-built lean:** single-door + PDK bind · profile-scoped paths · vault envelope v1 (`.obscurvault`) · SQLite message/thread stores on native · desktop profile isolation  
**Claim language:** **candidates recorded** ≠ Cut 0 shipped · ≠ Continuity Pass · ≠ SQLCipher adopted

## 1. Scope

- **In:** Candidate architecture for the **universal account plane** — auth door, hard profiles, durable DB/vault — so one workspace serves switchable carriers (aggregator law).
- **Out:** Implementing Rust auth crate this phase; Soft L3; OAuth-as-root; picking a second database engine to replace SQLite.

## 2. Basics

The platform hinge (charter) is:

> One Obscur account plane (**auth · profiles · database**) with **switchable carriers**.

| Subsystem | Job | Non-job |
|-----------|-----|---------|
| **Auth** | Prove human may open **this** workspace | Carrier login; Continuity history |
| **Profile** | Hard-isolated workspace slot (keys, paths, prefs) | Protocol display name as root |
| **DB / vault** | Durable canonical state + encrypted blobs | Relay/HS as CRM truth |

Auth **face** is already decided in [`15b-auth-schemes-solution-record.md`](./15b-auth-schemes-solution-record.md) (password-wrap + optional passkey/keystore; raw keys Advanced). This note locks **storage candidates** and how the three fit the hub.

```text
┌─────────────────────────────────────────────┐
│ Auth door (Plane 1–2)                       │
│  password / passkey → unwrap root + PDK     │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Profile workspace                           │
│  profileId · registry · window binding      │
│  linked identities (Nostr / Matrix / …)     │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Durability                                  │
│  SQLite (graph · messages · settings)       │
│  Vault CAS (encrypted media envelopes)      │
│  Continuity sealed snapshots (F-sync)       │
└─────────────────────────────────────────────┘
```

## 3. Capabilities map

| Need for Obscur | Candidate answer | Notes |
|-----------------|------------------|-------|
| Universal unlock | Password-wrapped root + PDK (15b) | Optional WebAuthn/OS keystore unwrap same DEKs |
| Hard profile isolation | Per-`profileId` DB path + vault dir + keychain entries | Cross-profile deny (S5) stays law |
| Carrier-agnostic CRM | Relationship tables in workspace SQLite | F1 — no Nostr event PK as sole TRUSTED key |
| Message durability | SQLite threads (as-built native direction) | Bodies in Continuity backup (gap to close) |
| Encrypted files | Vault envelope v1 + opaque names (as-built) | Promote quarantine → vault with consent |
| Multi-protocol under one account | Linked-identity rows + app registry | F-hub |
| Cross-device | Sealed snapshot of DB+manifests → file/DC (F-sync) | Not live CRDT required for GO |
| At-rest DB confidentiality | See §5 candidates | OS disk encryption alone = weak if device unlocked |

## 4. Fit to planes

| Plane | Universal owner | Carrier may… |
|-------|-----------------|--------------|
| Auth | Kernel session machine | Hold linked tokens after shell_ready |
| Profile | Registry + isolation snapshot | Publish display hints only |
| Storage / DB | SQLite schema + vault CAS | Cache disposable wire indexes |
| Relationship | Graph tables | Deliver signed intents |
| Message | Thread tables + tier policy | Encode/decode |
| Transport | Prefs + homes | Dial |

## 5. Libraries / stacks (candidates)

### 5.1 Auth / key custody

| Candidate | Role | Verdict lean |
|-----------|------|--------------|
| As-built PDK + device password bind | Plane 1–2 | **Keep / harden** |
| OS keychain / Secure Enclave / TPM | Wrap PDK / stay-signed-in | **Prefer** (H in 15b) |
| WebAuthn passkeys | Optional unlock of same wrap | **Optional enhancer** |
| OPAQUE / SVR | Blind recovery server | Lab until Continuity server chartered |
| OAuth / email root | — | **Reject** |

### 5.2 Profile registry

| Candidate | Role | Verdict lean |
|-----------|------|--------------|
| Desktop profile registry + window binding | Multi-profile | **Keep**; one id oracle (F-auth-profile P0) |
| Linked-identity table (pubkey, MXID, tokens) | Hub apps | **Add** in schema (not localStorage-only) |
| Per-profile keychain items | Secrets | **Prefer** over web localStorage for Matrix tokens |

### 5.3 Database engine

| Candidate | Pros | Cons | Verdict lean |
|-----------|------|------|--------------|
| **SQLite** (status quo) | Known, portable, F-stack, Continuity-friendly | Need explicit at-rest story | **Keep as engine** |
| **SQLCipher / SEE** | Transparent page encryption | License/ops; migration | **Candidate** for native Cut |
| **App-level AEAD** of rows/files (envelope v1 style) | Already in vault; flexible | Easy to miss a table; perf | **Keep for vault blobs**; optional for sensitive columns |
| **OS file encryption only** (BitLocker/FileVault) | Zero app code | Fails if OS session unlocked; weak laptop theft after login | **Insufficient alone** |
| Postgres/remote DB | Multi-writer server | Breaks sovereign default; not Cut 0 | **Reject for workspace core** |

**Recommendation:** SQLite remains the workspace DB. At-rest = **PDK-wrapped DB key** (SQLCipher-class **or** encrypt-on-open app envelope for the DB file) + existing vault envelopes for media. Exact SQLCipher vs file-AEAD pick is an F9 cut design item — both fit.

### 5.4 Schema ownership (logical modules in one DB)

| Schema area | Contents |
|-------------|----------|
| `auth_meta` | KDF params, wrap versions (no raw keys) |
| `profile` | display, isolation flags |
| `linked_identity` | carrier, external id, sealed secret ref |
| `relationship_edge` | sticky CRM (F1/F16) |
| `conversation` / `message` | canonical threads |
| `group` / `membership` | hub groups + pin home id |
| `home` / `network_pref` | named homes (F-netconfig) |
| `vault_index` | CAS descriptors |
| `continuity_cursor` | backup generations |

Migrations versioned in kernel; carriers never own migrations.

## 6. Feasibility verdict

**`fit-with-adapter`** — A universal auth · profile · SQLite(+vault) plane is **feasible** and is the correct Cut 0 of the staged hub: carriers plug in; DB schema stays carrier-agnostic; auth face follows 15b; Continuity seals the same DB/manifests.

**`reject-for-core`:** Per-carrier databases as source of truth; OAuth root; replacing SQLite with a cloud DB for the personal workspace; CRM tables keyed only by Nostr event ids.

### Cut alignment (when F9 opens)

| Cut | Auth / Profile / DB |
|-----|---------------------|
| **Cut 0** | One profile-id owner · session orchestrator · schema spine · vault · **PDK `.obscur-enc` at-rest** · thin H-dc · T3 hooks — see `cut0-account-spine-design-2026-11-09.md` |
| **Cut 0b** | Secrets/tokens → keychain/kernel; Matrix session out of plain localStorage |
| **Later** | SQLCipher optional study; Continuity sealed snapshot includes SQLite bodies |
| **Later** | Rust auth/profile crates (F-stack); optional passkeys |

## 7. Risks / traps

- Dual writers (chat-state + SQLite) resurrecting Soft L3-class drift.  
- Encrypting vault but leaving CRM/message SQLite plaintext on disk.  
- Profile switch without tearing down open DB handles.  
- Continuity backup omitting native SQLite (known gap).  
- “Universal DB” interpreted as Obscur-hosted cloud Postgres.

## 8. Open questions

1. SQLCipher-class vs whole-file AEAD for SQLite — license and mobile story?  
2. Single SQLite file per profile vs split (messages / graph) files?  
3. Linked-identity secrets: vault sealed blobs vs OS keychain items (prefer keychain for tokens)?  
4. Web/PWA without native SQLCipher — degraded clear DB + vault-only encryption acceptable?  
5. F9 GO: is Cut 0 (schema+oracle+orchestrator) enough without at-rest DB encryption in the same release?

## 9. References

- `docs/exploration/feasibility/15b-auth-schemes-solution-record.md`  
- `docs/exploration/feasibility/14-auth-profile-improvement-exploration.md`  
- `docs/exploration/feasibility/12-hub-workspace-vault-adapters.md`  
- `docs/exploration/feasibility/09-ideal-stack-thought-experiment.md`  
- `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- `specs/backend/sandboxed-storage-security-design-2026-11.md`  
- `apps/pwa/app/features/storage/services/vault-at-rest.ts`  
