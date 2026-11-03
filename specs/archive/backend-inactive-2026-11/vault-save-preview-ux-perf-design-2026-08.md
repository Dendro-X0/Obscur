# Design — Vault save feedback + lazy preview decrypt (2026-08-20)

**Parent:** [vault-save-preview-ux-perf-investigation-2026-08.md](./vault-save-preview-ux-perf-investigation-2026-08.md)

## Slice 1 — Chat Save to Vault UX

| Step | Behavior |
|------|----------|
| Click Save to Vault | Close message menu immediately |
| Start | `toast` loading/info: saving N attachment(s) |
| Per file | Reuse LES save; `errors-only` for N>1; suppress `alreadyInVault` info under errors-only |
| End | One summary: success / partial / all failed / all already saved |
| Unlock | Existing unlock dialog unchanged |

Owner: `useChatVaultSaveWithUnlock` (+ optional thin batch helper in `les-chat-save`).

## Slice 2 — LES batch efficiency

- One `listLesObjects` for already-saved set when saving many.
- `emitLesCatalogChanged` once after batch (not per successful commit).
- Single-attachment path unchanged except toastPolicy respect for already_saved.

## Slice 3 — Lazy vault preview

- Eager decrypt: **image** only (grid thumbs).
- Audio / video / file: keep placeholder until `ensurePreview(remoteUrl)`.
- Skip re-decrypt when cached blob URL still registered.
- `VaultMediaGrid` calls ensure on tile select / preview open.

## Proof

| L | Check |
|---|--------|
| L1 | saveMany / toastPolicy / lazy preview unit or contract tests |
| L3 | Dual MP3 Save → immediate toast + summary; open audio tile without multi-second freeze |
