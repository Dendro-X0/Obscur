# Design — Phase 6 chat→vault re-enable (row-proof gate)

**Status:** Approved for implementation (2026-07-13)  
**Band:** `VAULT-SANDBOX-1` · Phase 6  
**Investigation:** [vault-chat-save-re-enable-investigation-2026-07.md](./vault-chat-save-re-enable-investigation-2026-07.md)  
**Prerequisite:** G8 L3/L4 sign-off before **flag flip** (implementation may land with flag false)

---

## Decision

Adopt **Option C — row-proof gate** from investigation §Remediation:

> Persist through canonical owners → **await index row visible** → emit refresh → **then** success toast.

No parallel write path. Chat save delegates to `saveFileToLocalVault` / `cacheAttachmentLocally` only.

---

## API

### `awaitVaultIndexRowForKey`

**Owner:** `local-media-store.ts`

```typescript
awaitVaultIndexRowForKey(params: {
  indexKey: string;           // remote url or obscur://vault/local/… hash url
  timeoutMs?: number;         // default 5000
  pollIntervalMs?: number;    // default 50
}): Promise<boolean>
```

**True when** `getLocalMediaIndexSnapshot()[indexKey]` exists with non-empty `relativePath`.

**False on timeout** — caller must **not** show success toast.

### `saveChatAttachmentAndAwaitVaultRow`

**Owner:** `save-chat-attachment-to-vault.ts`

```typescript
saveChatAttachmentAndAwaitVaultRow(
  attachment: Attachment,
  t: TranslateFn,
): Promise<boolean>
```

Flow:

1. Guards: native runtime, URL class, encryption session (`isVaultEncryptionSessionReady`)
2. Try `saveFileToLocalVault` after fetch (native HTTP stack — not webview `fetch` for CDN)
3. Else `persistAttachmentToLocalVault` with `explicitChatSave: true`
4. `awaitVaultIndexRowForKey` on resulting index key (`vaultUrl` or normalized attachment url)
5. `emitLocalMediaIndexChanged()` already fired by store — optional second emit OK
6. Success toast **only if** step 4 true

---

## Subtraction rules

| Rule | Detail |
|------|--------|
| Single filesystem owner | All bytes through `local-media-store.ts` |
| Single index owner | SQLite `vault_media_index` via store helpers |
| No toast on partial | Encryption errors throw `VaultWriteEncryptionRequiredError` → error toast |
| Flag gate | `VAULT_SAVE_FROM_CHAT_ENABLED` remains false until G8 + L3 chain |

---

## Failure mapping

| Condition | UX |
|-----------|-----|
| Locked / no PDK | Error: unlock required to save |
| CDN fetch blocked | Error: blocked host / fetch failed |
| Write OK, index timeout | Error: save incomplete (no success toast) |
| Row visible | Success toast |

---

## Tests (L1)

New file: `save-chat-attachment-to-vault.test.ts`

| Case | Assert |
|------|--------|
| Flag false | `canSave…` false; batch save returns 0 |
| Encryption required | locked → error, no success |
| Row-proof | mock store: index appears after persist → success |
| No false success | persist OK but index never appears → failure |
| URL normalization | normalized key matches aggregator lookup |

Expand `verify:vault-sandbox-l1` with:

- `vault-media-index-sqlite-store.test.ts`
- `vault-media-aggregator.test.ts`
- `save-chat-attachment-to-vault.test.ts`

---

## Proof plan (post flag flip)

| Layer | Action |
|-------|--------|
| L1 | `pnpm verify:vault-sandbox-l1` |
| L2 | `pnpm verify:storage-encryption-v1.9.8` |
| L3 | Desktop: DM image → Save to Vault → Vault tab row + preview |
| L4 | Ciphertext under `profiles/{id}/vault/` only |

Chain id: `chain-vault-chat-save-phase6-2026-07`

---

## Owners

| Concern | Module |
|---------|--------|
| Chat orchestration | `save-chat-attachment-to-vault.ts` |
| Bytes + envelope | `local-media-store.ts` |
| Index | `vault-media-index-sqlite-store.ts` |
| Grid | `vault-media-aggregator.ts`, `use-vault-media.ts` |
| UI entry | attachment context menu / lightbox (gated by `canSave…`) |
