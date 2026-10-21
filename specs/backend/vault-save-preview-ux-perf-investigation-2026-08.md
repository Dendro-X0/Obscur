# Investigation — Vault save lag + silent multi-audio save (2026-08-20)

**Status:** Investigated · implement from companion design

## Evidence

- Message `…` menu → Save to Vault on bubble with **2 MP3s**
- Operator: lag, **no prompts**
- Vault grid has tiles; opening preview can lag

## Root causes

### A — Silent multi-save (`useChatVaultSaveWithUnlock.saveMany`)

For `attachments.length > 1`, each call uses `toastPolicy: "errors-only"`.  
Success toasts are suppressed per file, and **saveMany never emits a final summary toast** (unlike `saveChatAttachmentsToLes`).  
Menu closes only **after** `await saveMany` → UI feels frozen with no feedback while CDN fetch + LES encrypt runs for large audio.

### B — Work on main interaction path

Sequential per attachment: `listLesObjects` (already check) → fetch bytes → `commitLesObjectWithProof` → `emitLesCatalogChanged`.  
Two multi-minute MP3s amplify wall-clock latency.

### C — Preview lag (`useLesVaultMedia.refresh`)

On every catalog change / mount, **all** objects are re-decrypted (concurrency 3), including full audio/video, with a `setMediaItems` per object.  
Clicking preview while decrypt is in flight (or AudioPlayer peak-decode on large blobs) feels laggy.

## Fix direction

1. Immediate progress + summary feedback; close menu first.
2. Batch already-check + single catalog emit for multi-save.
3. Eager decrypt images only; decrypt audio/video/file on preview open; reuse live blob cache.
