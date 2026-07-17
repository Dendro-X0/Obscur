# Vault module — RETIRED catalog / write owners (LES R5+)

**Product UI label:** Vault (nav)  
**Runtime authority:** `apps/pwa/app/features/les/**` + Rust `libobscur::les`  
**Preview UI (kept):** `features/vault/components/vault-media-grid.tsx` via `useLesVaultMedia`

## Tombstoned (do not re-enable)

| API / path | Status |
|------------|--------|
| `saveFileToLocalVault` | Throws — use `uploadFilesToLes` / `commitLesObjectWithProof` |
| `persistAttachmentToLocalVault` | Throws — use `saveChatAttachmentToLes` |
| `cacheAttachmentLocally(..., { explicitChatSave: true })` | Throws |
| `scheduleVaultUnlockMaintenance` | No-op — no SQLite vault-index / layout migrations as catalog owners |
| Legacy vault catalog hook as `/vault` owner | Unwired — use `useLesVaultMedia` |

## Still present (intentional)

| Path | Role |
|------|------|
| `VaultMediaGrid` | Client preview / lightbox / filters — fed by LES adapter |
| `local-media-store` | Message local-cache I/O only — not Vault product authority |

## Gates

- `pnpm verify:les-l1`
- `pnpm verify:les-l3`
