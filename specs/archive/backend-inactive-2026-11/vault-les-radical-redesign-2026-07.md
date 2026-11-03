# Design — LES radical redesign (dismantle Vault impl · rebuild encrypted store)

**Status:** Design (R0/I1) — **approved direction** pending R1 impl  
**Date:** 2026-07-15  
**Charter:** [vault-intake-2-charter-2026-07.md](./vault-intake-2-charter-2026-07.md)  
**Feasibility:** [vault-chat-intake-feasibility-2026-07.md](./vault-chat-intake-feasibility-2026-07.md)  
**Principle:** Unconventional teardown — do **not** evolve `features/vault/**`. Build LES from zero in **Rust**; TypeScript is UI + thin SDK only. Cut over; delete the old owners.

**Language rule (maintainer 2026-07-15):** Functional rewrite → **Rust** (`libobscur::les` + Tauri commands). TS → components/hooks/SDK invoke wrappers only.

---

## 1. Problem restated

The existing Vault stack cannot be trusted as a substrate:

- Success toast without durable catalog (§F8, weeks of dogfood)
- Thread Media ≠ Vault catalog (two truths)
- Write / index / aggregator / hook form a coupled bog — patching prolongs abandonment risk

**Response:** dismantle that implementation. Reconstruct local encrypted storage under a new module boundary. Product capability stays; code does not.

---

## 2. Naming

| Layer | Name |
|-------|------|
| User-facing | **Vault** (keep after cutover — brand continuity) |
| Code / package | **LES** — Local Encrypted Store |
| Feature root | `apps/pwa/app/features/les/` |
| Object id | `lesObjectId` (opaque, profile-scoped) |
| Disk tree | `profiles/{profileId}/les/{kind}/{lesObjectId}.obscurvault` |

New on-disk root **`les/`** (not reuse of cursed `vault/` tree as authority). Optional later importer may read old `profiles/*/vault/**` blobs once — **out of R1–R4 scope**.

---

## 3. Architecture

```text
                    ┌─────────────────────┐
  Secure Upload ───►│                     │
                    │  les/intake         │──encrypt──► disk taxonomy
  Chat Save     ───►│  commit(profileId,  │──row─────► les/catalog (SQLite)
                    │         bytes, meta)│
                    └──────────┬──────────┘
                               │ returns LesCommitReceipt
                               │ only if disk+row OK
                    ┌──────────▼──────────┐
  Vault page    ◄───│  les/catalog.list   │  sole grid source
  preview/export ◄──│  les/catalog.get    │
                    └─────────────────────┘
```

**Forbidden:** message scan, CDN URL discovery, or “disk inventory merge” as the grid source of truth.

---

## 4. Contracts

### 4.1 `LesObjectMeta`

```typescript
type LesKind = "image" | "video" | "audio" | "file";

type LesObjectMeta = Readonly<{
  lesObjectId: string;          // ultraid / uuid — NOT content-hash alone
  profileId: string;
  kind: LesKind;
  displayName: string;
  contentType: string;
  byteLength: number;
  createdAtUnixMs: number;
  source: "secure_upload" | "chat_save";
  sourceAttachmentUrl?: string; // optional provenance; never grid primary key
}>;
```

### 4.2 `LesCommitReceipt`

```typescript
type LesCommitReceipt = Readonly<{
  lesObjectId: string;
  profileId: string;
  relativePath: string;         // profiles/{id}/les/{kind}/{id}.obscurvault
  catalogRevision: number;
}>;
```

`commit` **resolves only** when ciphertext file exists and catalog row is readable in the same profile store. Otherwise throw typed `LesCommitError` — callers must not toast success.

### 4.3 Intake API

```typescript
commitLesObject(input: {
  profileId: string;
  bytes: Uint8Array;
  meta: Omit<LesObjectMeta, "lesObjectId" | "createdAtUnixMs" | "byteLength"> & {
    displayName: string;
    contentType: string;
    kind: LesKind;
    source: LesObjectMeta["source"];
    sourceAttachmentUrl?: string;
  };
}): Promise<LesCommitReceipt>;
```

Mid-flight profile change → abort (snapshot `profileId` at start; refuse if active ≠ snapshot at end).

### 4.4 Catalog API

```typescript
listLesObjects(profileId: string): Promise<ReadonlyArray<LesObjectMeta & { relativePath: string }>>;
getLesObject(profileId: string, lesObjectId: string): Promise<… | null>;
openLesPreview(profileId: string, lesObjectId: string): Promise<blobUrl>; // revoke on lock / profile switch
exportLesDecryptedCopy(…): Promise<void>; // explicit path only
```

Catalog DB path: profile-scoped SQLite under data root, e.g. `profiles/{id}/les/catalog.sqlite` (encrypted at rest with same PDK regime as other profile SQLite, or sealed via existing storage-at-rest helpers — exact cipher binding specified in R1 impl notes, not inventing a third key system).

### 4.5 Success gate (UI)

```typescript
async function saveWithLesProof(...): Promise<"ok" | "failed"> {
  const receipt = await commitLesObject(...);
  const row = await getLesObject(receipt.profileId, receipt.lesObjectId);
  if (!row) return "failed";
  return "ok"; // only then toast
}
```

---

## 5. Disk taxonomy

```text
{dataRoot}/profiles/{profileId}/les/
  catalog.sqlite          # or .obscur-enc sibling per storage moat
  images/{lesObjectId}.obscurvault
  videos/...
  audio/...
  files/...
```

Kind mapping mirrors prior Phase 5b (`voice_note` → `audio`). Opaque filenames = `lesObjectId` (not content-hash primary) to avoid cross-profile key-collision confusion in URLs; content hash may be stored as metadata for dedupe later (R5+).

---

## 6. Encryption

- Reuse profile PDK session / AEAD envelope format already used for `.obscurvault` **as a crypto library**.
- New write path must not call `cacheAttachmentLocally` or old encrypt helpers that quietly no-op.
- Lock → revoke all LES preview blob URLs; catalog metadata may remain sealed.

---

## 7. UI cutover

| Phase | Vault route |
|-------|-------------|
| Pre-R2 | Honest empty / “Vault rebuilding” or frozen Secure Upload disabled — no false toast |
| R2–R4 | LES-backed Vault page behind flag |
| R5 | Default; old `features/vault` deleted |

Chat Save button: hidden until R4; then only `commitLesObject` + proof gate.

---

## 8. Teardown checklist (R5)

- [x] Shell `/vault` imports only LES for catalog/upload (legacy grid unwired)  
- [x] Messaging Save → LES (R4)  
- [x] Tombstone vault write/catalog owners (`RETIRED.md`); `local-media-store` kept as message-cache I/O only  
- [ ] Fully delete unused `use-vault-media` / aggregator / sqlite vault-index modules (follow-on cleanup)  
- [ ] Retire `verify:vault-sandbox-l1` or shrink to crypto-only tests under storage  
- [x] Add `pnpm verify:les-l1` + `verify:les-l3` (automated)  
- [ ] Archive old vault specs as historical; LES docs are authority  

**R5 landed 2026-07-15** — cutover + tombstones; physical purge of dead vault files deferred.

---

## 9. Mental simulation

1. **P** Secure-Uploads PNG → `commitLesObject` → file under `profiles/P/les/images/{id}.obscurvault` + catalog row → Vault grid lists one tile.  
2. Relaunch, unlock **P** → `listLesObjects(P)` returns same id — **no** message scan.  
3. **P** Save-from-chat MP4 → same `commitLesObject` with `source: "chat_save"` → second row; toast only after `getLesObject`.  
4. Switch to **Q** → empty or Q-only; open of P’s id fails closed.  
5. R5 deletes old vault services; behavior unchanged.

---

## 10. Proof plan

| Layer | Command / action |
|-------|------------------|
| **L1** | `pnpm verify:les-l1` — commit/list/isolation/fail-closed toast gate unit tests |
| **L2** | PDK / storage-at-rest suite (shared) |
| **L3** | `pnpm verify:les-l3` — commit → drop connections → fresh list/get/decrypt (`les_l3_cold_hydrate.rs`) · **PASS 2026-07-15** |
| **L4** | Maintainer: two profiles, chat + upload, refresh, lock |

Stop rule: if R1–R3 stall ≥3 substantial iterations on the **same** LES bug class → feasibility pause on LES (not a return to patching old vault).

---

## 11. Out of scope (for R1–R4)

- Importing legacy `profiles/*/vault/**` blobs (optional R6+)  
- Cloud sync  
- WASM viewer  
- Making thread Media modal identical to Vault  

---

## 12. Decision log

| Decision | Choice | Why |
|----------|--------|-----|
| Strategy | Radical dismantle + LES greenfield | Avoid month-long debug→abandon cycle |
| Product goal | Preserve encrypted local Vault | Not mediocre cancel |
| Disk root | New `les/` tree | Do not inherit cursed layout authority |
| Object id | Fresh id, not hash URL key | Break index-key collision class |
| Grid source | Catalog only | Break CDN∪local dual truth |
| Old module | Delete at R5 | “Remove vault” as implementation |