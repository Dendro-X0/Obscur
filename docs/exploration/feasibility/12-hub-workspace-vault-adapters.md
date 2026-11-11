# Feasibility — Hub workspace · encrypted vault · multi-protocol apps

**ID:** F-hub  
**Status:** draft (product architecture exploration)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** `00-aggregator-adaptation-law.md` · `01-relationship-authority.md` · `09-ideal-stack-thought-experiment.md` · `11-performance-security-encryption-standards.md` · `specs/backend/sandboxed-storage-security-design-2026-11.md`  
**Claim language:** **explored design** ≠ shipped hub · ≠ Tor Verified · ≠ multi-protocol Pass

## 1. Scope

- **In:** How **one encrypted database + one user profile/workspace** can host **many communication apps** (Nostr, Matrix, private mesh, …) without forcing their design patterns into each other; how the **vault** encrypts content and the **sandbox** contains hostile files.
- **Out:** Implementing the hub this session; Soft L3 contact Pass; claiming S1–S5 already equal the full vault product story below.

## 2. Basics

### Hub (platform)

Obscur is a **workspace hub**, not a single-protocol client:

```text
┌─────────────────────────────────────────────────────────────┐
│  Primary workspace (one profile / account door)             │
│  · auth unlock · encrypted SQLite · relationship graph      │
│  · vault (encrypted blobs) · sandbox / quarantine           │
│  · app registry (enabled carriers / “apps”)                 │
└────────────┬───────────────────────────┬────────────────────┘
             │ linked identity           │ linked identity
             ▼                           ▼
      ┌──────────────┐            ┌──────────────┐
      │ Nostr app    │            │ Matrix app   │  … private /
      │ (adapter)    │            │ (adapter)    │    mesh apps
      └──────────────┘            └──────────────┘
```

| Concept | Meaning |
|---------|---------|
| **Primary workspace** | The human’s Obscur profile: unlock, DB, vault, CRM, prefs |
| **App (carrier module)** | A pluggable communication surface with its own wire model |
| **Linked identity** | Per-app credentials / pubkeys / MXID bound to the workspace — **not** a replacement for the workspace |
| **Vault** | Encrypted object store for files the user keeps inside Obscur |
| **Sandbox** | Policy + quarantine + constrained preview for **untrusted** inbound bytes |

**Conflict resolution:** Nostr event kinds and Matrix room state **never** become the workspace schema. Each app maps to canonical hub DTOs (message, invite intent, media descriptor). Incompatibilities stay inside the adapter.

### Vault + sandbox (storage security)

| Path | Behavior |
|------|----------|
| **Ingest into vault** | Any file the user (or trusted export path) places in the vault is **encrypted at rest** under profile key material |
| **View in vault** | Decrypt **ephemerally** for controlled preview inside the app — ciphertext remains canonical on disk |
| **Download to local disk** | Explicit export: decrypt → user-chosen path (consent); leaves hub custody |
| **Inbound from carriers** | Lands in **sandbox / quarantine** first (not vault-as-trusted); no auto-execute; hostile scripts/MIME contained |
| **Promote quarantine → vault** | Only after policy + explicit user action (optional product step) |

Existing design already covers inbound quarantine / preview / consent export / cross-profile deny (`sandboxed-storage-security-design` S1–S5). This note **extends the product story**: vault as encrypted home for kept files; sandbox as the hostile front door.

## 3. Capabilities map

| Need for Obscur | Hub answer | Notes |
|-----------------|------------|-------|
| One DB for many protocols | Yes — workspace SQLite owns canonical state | Adapters store wire ids as **foreign keys / mappings**, not as CRM truth |
| One profile, many apps | Yes — app registry + linked identities | Enable/disable apps without wiping workspace |
| Nostr ≠ Matrix patterns | Contained in adapters | Hub never imports `kind` or `m.room.*` as relationship law |
| Encrypted files at rest | Vault encrypt-on-write | Aligns with F-PSE at-rest open question (F8 detail) |
| View without full export | In-vault preview | Ephemeral decrypt in sandbox renderer |
| Export to OS disk | Consent download | Same posture as S4 export |
| Malicious inbound | Sandbox quarantine | Not antivirus; contain execute / traversal / type confusion |
| Performance | One DB; lazy apps | Disabled apps ≈ zero sync cost (F-PSE) |

## 4. Fit to planes

| Plane | Hub rule |
|-------|----------|
| Auth | One door unlocks the workspace; apps inherit session capability, not separate “login replaces profile” |
| Profile | Hard isolation between workspaces; linked identities are **children** of the profile |
| Storage / DB | Encrypted SQLite + vault blob store; carrier caches are disposable / secondary |
| Relationship | Workspace-owned graph; apps propose invite/accept/remove envelopes only (F1) |
| Message | Canonical conversation rows; app encodes/decodes |
| Transport | Per-app underlay prefs (relays, homeserver, Tor) |

## 5. Libraries / stacks

Deferred to F5/F8/F9. Constraints from this note:

- Vault crypto and DB-at-rest live in the **Rust kernel** (F-stack), not duplicated in each app.
- Sandbox policy is **shared platform code**; apps only submit descriptors + bytes.
- Prefer one CAS / blob layer keyed by profile + content hash (as-built direction).

## 6. Feasibility verdict

`fit-with-adapter` — A **hub + linked-identity apps + encrypted vault + inbound sandbox** is the coherent answer to “one DB/profile across Nostr and Matrix” **if** adapters stay subordinate and vault/sandbox ownership stays in the platform plane.

Why: Protocol design-pattern conflicts are inevitable at the wire. They are **not** solvable by merging schemas. They are solvable by a workspace hub that owns identity, storage, CRM, and security policy while apps plug in.

## 7. Risks / traps

- Letting “Nostr app” own the only profile key or vault root.
- Auto-promoting quarantine files into the vault (turns sandbox into a malware inbox).
- Viewing vault files via unconstrained WebView/`file://` (breaks sandbox).
- Syncing the entire vault to every carrier.
- One shared Matrix+Nostr “contact list” inferred from either network’s history.
- UI that looks like five separate products with five unlock doors (destroys hub UX).

## 8. Open questions

1. Vault encryption: same PDK/SQLCipher-class as DB, or separate blob DEKs wrapped by profile key (F8)?
2. Is “view in vault” always sandboxed renderer, even for user-originated files?
3. Linked identity UX: one pubkey/MXID per app, or multiple personas per app under one workspace?
4. Cross-app conversations: single hub thread with multi-carrier delivery vs strictly separate app inboxes?
5. How much of S1–S5 as-built carries into the Rust-kernel rewrite cut vs re-spec?

## 9. References

- `specs/backend/sandboxed-storage-security-design-2026-11.md` (quarantine · preview · export · cross-profile)
- `docs/exploration/feasibility/00-aggregator-adaptation-law.md`
- `docs/exploration/feasibility/01-relationship-authority.md`
- `docs/exploration/feasibility/11-performance-security-encryption-standards.md` (tiers · bridge tax)
- `docs/exploration/feasibility/09-ideal-stack-thought-experiment.md`
- `specs/backend/obscur-platform-service-vision-2026-10.md` (parent vision)
