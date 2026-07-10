# Investigation — Phase 6 chat→vault re-enable (G6)

**Status:** Investigation complete (2026-07-09) — **DISABLED** until maintainer unpause + L3 sandbox sign-off  
**Date:** 2026-07-09 (UTC)  
**Band:** `VAULT-SANDBOX-1` · Phase 6  
**Parent plan:** [vault-encryption-sandbox-plan-2026-07.md](./vault-encryption-sandbox-plan-2026-07.md)  
**Prerequisite evidence:** [vault-sandbox-l3-verification-2026-07.md](./vault-sandbox-l3-verification-2026-07.md) §3–§5 (G8)  
**Handoff:** [`docs/handoffs/current-session.md`](../../docs/handoffs/current-session.md)

---

## Summary

Chat→vault save was **disabled** (`VAULT_SAVE_FROM_CHAT_ENABLED = false`) after repeated reports of **success toast without a visible Vault row**. Phases 1–5 hardened the sandbox (encrypt-on-write, legacy migration, SQLite index, controlled export, per-profile layout). Phase 6 may re-enable intake **only** when the save pipeline satisfies the same contracts as Secure Upload and the aggregator proves row visibility before any success toast.

This investigation maps **failure classes**, **canonical owners**, and a **proof chain** for a future design spec. **No code changes** in this document.

---

## Symptom contract (pre-disable)

| Field | Value |
|-------|--------|
| User action | Chat attachment context menu or lightbox → **Save to Vault** (desktop native) |
| Expected | Ciphertext blob under `profiles/{profileId}/vault/`; Vault grid shows new row with LOCAL badge; preview works when unlocked |
| Actual (reported) | Success toast; Vault grid empty or stale until manual reload; intermittent on CDN-hosted attachments |
| Proof tier target | **t4** — save from DM/group thread → navigate Vault → row visible without reload |
| Does not prove | PWA browser-only save; multi-profile cross-leak; portable USB (covered by sandbox L4) |

---

## Evidence inventory

### Historical failure classes (pre-sandbox iterations)

| ID | Class | Mechanism | Sandbox phase impact |
|----|-------|-----------|----------------------|
| F1 | **WebView CORS** | `fetch(attachment.url)` blocked on NIP-96 CDN hosts while playback works | Mitigated by Tauri HTTP + `fetch_remote_bytes` fallback — must remain in chain |
| F2 | **Storage toggle** | `enabled: false` in local media settings blocked explicit saves | `force: true` + `explicitChatSave` on persist path — verify still honored |
| F3 | **UI stale** | Save succeeded but `useVaultMedia` did not refresh | `emitLocalMediaIndexChanged` + `subscribeLocalMediaIndexChanged` — verify event fires after SQLite index write |
| F4 | **Index key mismatch** | Normalized URL ≠ attachment.url used by aggregator scan | `normalizeAttachmentUrl` before index key — parity test required |
| F5 | **Encryption gate** | Write without PDK session → plaintext or silent null | Phase 1: `VaultWriteEncryptionRequiredError` — chat save must surface error, not false success |
| F6 | **Standalone row gate** | Index entry missing `explicitChatSave` / `messageEventId` | Aggregator `buildStandaloneLocalVaultMediaItems` filters — chat save must set flags |
| F7 | **Profile / path scope** | Writes to legacy flat `vault-media/` or wrong profile | Phase 5: `profiles/{id}/vault/` + `resolveEntryStorageRef` — chat save must use same write owner as upload |
| F8 | **False success toast** | `trySaveAsVaultNativeCopy` returns true on partial state | Phase 6.3: toast only after index + aggregator-visible row |

### Current disabled surface

| Entry | Guard |
|-------|-------|
| `canSaveChatAttachmentsToLocalVault()` | `VAULT_SAVE_FROM_CHAT_ENABLED && hasNativeRuntime()` |
| `saveChatAttachmentToLocalVault` | UI still callable in tests; production menu hidden when `canSave…` false |
| `saveChatAttachmentsToLocalVault` | Early return when flag false |

---

## End-to-end flow (target)

```
User: Save to Vault (chat)
        ↓
save-chat-attachment-to-vault.ts
  ├─ classifyAttachmentFetchUrlForVaultSave (blocked_host / unsupported)
  ├─ trySaveAsVaultNativeCopy → saveFileToLocalVault (hash-keyed obscur://vault/local/…)
  └─ persistAttachmentToLocalVault → cacheAttachmentLocally(force, explicitChatSave)
        ↓
local-media-store.ts
  ├─ fetchBytes (Tauri HTTP → native → webview)
  ├─ encryptVaultBytesIfAvailable (PDK required)
  ├─ write profiles/{profileId}/vault/{hash}.obscurvault
  └─ SQLite vault_media_index + emitLocalMediaIndexChanged
        ↓
use-vault-media.ts
  ├─ subscribeLocalMediaIndexChanged → refresh()
  └─ buildStandaloneLocalVaultMediaItems (explicitChatSave rows)
        ↓
Vault grid row visible → success toast (Phase 6.3)
```

**Subtraction rule:** Chat save must not introduce a parallel write path. It delegates to `saveFileToLocalVault` / `cacheAttachmentLocally` only.

---

## Hypotheses (re-enable blockers)

| ID | Hypothesis | Verdict |
|----|------------|---------|
| H1 | Success toast emitted before index persist completes | **Likely historical** — audit toast sites vs `emitLocalMediaIndexChanged` |
| H2 | Aggregator scan misses explicit saves when message scan empty | **Addressed in design** — standalone index rows require `explicitChatSave` |
| H3 | URL normalization splits index lookup from chat attachment url | **Test required** — round-trip `getLocalMediaIndexEntryByRemoteUrl` |
| H4 | Encryption-required errors swallowed as generic failure | **Test required** — locked profile must error, not toast success |
| H5 | Re-enable before L3 invalidates marketing claim | **Policy** — G8 blocks flip until sandbox sign-off |

---

## Canonical owners

| Concern | Owner | Notes |
|---------|-------|-------|
| Chat save orchestration | `save-chat-attachment-to-vault.ts` | Flag + toast policy |
| Bytes + envelope + path | `local-media-store.ts` | Same as Secure Upload |
| Index persist | `vault-media-index-sqlite-store.ts` | `explicit_chat_save` column |
| Grid data | `vault-media-aggregator.ts` + `use-vault-media.ts` | Standalone rows + refresh |
| UI entry points | `attachment-context-menu.tsx`, `lightbox.tsx`, `chat-view.tsx` | Gated by `canSaveChatAttachmentsToLocalVault` |

---

## Remediation options (design — pick one in design spec)

| Option | Description | Risk |
|--------|-------------|------|
| **A — Minimal flip** | Re-enable flag after L1 chain + L3 sandbox sign-off; keep existing dual path (native copy + persist) | F8 may recur without toast/row gate |
| **B — Upload-parity only** | Chat save always `saveFileToLocalVault` after fetch; drop `persistAttachmentToLocalVault` remote-url index coupling | Duplicate rows if same bytes saved twice — dedupe by content hash |
| **C — Row-proof gate (recommended)** | New helper: `saveChatAttachmentAndAwaitVaultRow` — persist → wait for index snapshot contains url → refresh hook callback → then toast | Slightly slower UX; closes F3/F8 |
| **D — Defer indefinitely** | Keep disabled; demos use Secure Upload only | Product expectation gap for chat power users |

**Recommended:** **C** on top of existing fetch stack — smallest behavioral guarantee aligned with Phase 6.3.

---

## Re-enable checklist (maintainer)

Before `VAULT_SAVE_FROM_CHAT_ENABLED = true`:

1. G8 closed — L3 §3 + L4 §4 signed on commit ≥ `3e0d9387`
2. L1 — `pnpm verify:vault-sandbox-l1` green
3. New L1 tests — save-chat attachment: encryption required, explicitChatSave flag, URL normalization parity, no success without index entry
4. L3 chain — CodaCtrl: DM with CDN image → Save to Vault → Vault tab row without reload
5. Design spec published (option C) with owner map
6. CHANGELOG + handoff unpause note

---

## Proof plan (post-fix)

| Layer | Command / action |
|-------|------------------|
| **L1** | `pnpm verify:vault-sandbox-l1` + new `save-chat-attachment-to-vault.test.ts` |
| **L2** | `pnpm verify:storage-encryption-v1.9.8` — chat save path uses envelope |
| **L3** | MCP: `client_session_connect` → send/receive image in DM → save → `client_navigate` Vault → `client_surface_probe` row count +1 |
| **L4** | Saved chat item on disk is `.obscurvault` under `profiles/{id}/vault/` (reuse sandbox soak) |

### CodaCtrl capture sequence (draft)

1. `client_dev_environment_get` → desktop `:9230`
2. Unlock Tester1 → open DM with hosted image attachment
3. Context menu → Save to Vault (after re-enable)
4. Navigate Vault → probe grid item count / preview
5. `client_investigation_chain_create` `chain-vault-chat-save-phase6-2026-07`
6. Explorer spot-check: ciphertext only in profile vault dir

---

## Out of scope

- Cloud sync of vault blobs
- Chat auto-cache on receive (separate from explicit save)
- PWA browser save-to-vault
- Re-enable before Phases 1–5 L3/L4 evidence (G8)
- Process-isolated viewer (T8)

---

## Next step

1. Maintainer signs [vault-sandbox-l3-verification-2026-07.md](./vault-sandbox-l3-verification-2026-07.md) §5 (G8)  
2. Design spec: option C (`saveChatAttachmentAndAwaitVaultRow`)  
3. Implement + L1 → flip flag → L3 chain  
4. Update plan Phase 6 status + CHANGELOG
