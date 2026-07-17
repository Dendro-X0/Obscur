# Charter — Local Encrypted Store (LES) · radical dismantle & reconstruct

**Status:** Maintainer-direction upgrade (2026-07-15) — supersedes soft “intake-2 patch graph” reading of Y  
**Product name (UI):** **Vault** may remain as the user-facing label after cutover  
**Code name:** **LES** — Local Encrypted Store (`apps/pwa/app/features/les/**`)  
**Feasibility:** [vault-chat-intake-feasibility-2026-07.md](./vault-chat-intake-feasibility-2026-07.md)  
**Design:** [vault-les-radical-redesign-2026-07.md](./vault-les-radical-redesign-2026-07.md)

---

## Strategy (unconventional · required)

| This is | This is not |
|---------|-------------|
| **Radical dismantling** of the current Vault *implementation* | Cancelling the encrypted-local-storage **product goal** |
| **Greenfield reconstruction** of intake + catalog + UI data plane | Another month of patching `local-media-store` / aggregator / Phase 6 |
| Delete-old-after-new-proves | “Subtraction” that leaves users with no Vault forever |

Maintainer mandate: *remove the vault (module), do not modify it into health; rewrite local encrypted storage from scratch — better or worse, but actually different.*

---

## 1. Product goal (unchanged)

| Capability | Required |
|------------|----------|
| Per-profile ciphertext on disk | Yes |
| Secure Upload into the store | Yes |
| Save from chat/Media into the **same** store | Yes |
| Catalog survives refresh / relaunch | Yes |
| Success UI only after disk + catalog agree | Yes |
| Explicit export + lock clears plaintext previews | Yes |

Thread **Media** (CDN) stays a separate product surface and must never claim “saved to encrypted vault” without LES commit proof.

---

## 2. Dismantle list (old Vault runtime)

**Freeze immediately:** no feature edits under the old graph except wiring stubs / tombstones needed for compile during cutover.

Target deletion (after LES L3 + cutover flag):

| Path / concern | Action |
|----------------|--------|
| `apps/pwa/app/features/vault/services/local-media-store.ts` | Delete |
| `save-chat-attachment-to-vault.ts` + Phase 6 contracts | Delete |
| `vault-media-aggregator.ts` + message-scan-as-vault-catalog | Delete as catalog authority |
| `vault-disk-inventory` / layout / legacy migrations as write owners | Delete or quarantine under `docs/archive` notes |
| `use-vault-media.ts` dual truth (CDN scan ∪ local) | Replace with LES catalog hook |
| Old SQLite `vault_media_index` + localStorage index keys | Abandon; LES owns new catalog DB |
| `verify:vault-sandbox-l1` as north-star gate | Replace with `verify:les-l1` after cutover |

**May reuse only as libraries (not as Vault owners):**

- Profile PDK / `vault-at-rest` encryption session primitives (or rename later)
- Native FS adapter patterns (copy thin I/O, do not inherit store logic)
- Desktop `data_root` profile folder creation

**Do not** “migrate forward” index rows from the cursed store as the source of truth for LES correctness proofs. Optional one-shot import is a later opt-in; greenfield catalog starts empty unless explicit importer is chartered.

---

## 3. Reconstruct (new silo)

```text
packages/libobscur/src/les/          # Rust authority: paths, catalog, intake
apps/desktop/.../commands/les.rs     # Tauri IPC
apps/pwa/app/features/les/sdk/       # TS invoke SDK only
apps/pwa/app/features/les/ui/        # later: components
```

**Language:** functional rewrite in **Rust**; TypeScript = UI + SDK only.

One Rust `commit_object`. One catalog list. Chat save and Secure Upload are two **SDK callers**, not two stores.

---

## 4. Cutover protocol

1. Build LES behind `LES_RUNTIME_ENABLED` (or route flag) — old Vault route can show “rebuilding” or stay on frozen empty Secure Upload for shipping honesty.  
2. Prove L1 → automated L3 on LES alone.  
3. Flip shell: Vault nav → LES UI.  
4. Point chat Save → `les.intake.commit` only.  
5. **Delete** old `features/vault/**` owners (radical dismantle complete).  
6. No dual-write. No “fallback to local-media-store”.

---

## 5. Slices

| Slice | Work |
|-------|------|
| **R0** | This charter + radical redesign (I1) | **Done** |
| **R1** | LES Rust intake+catalog + TS SDK (`verify:les-l1`) | **Done** |
| **R2** | Secure Upload UI on LES | **Done** (native Vault page → LES) |
| **R3** | Automated cold-hydrate L3 | **PASS** — `pnpm verify:les-l3` |
| **R4** | Chat Save on LES | **Done** |
| **R5** | Cutover + **delete** old vault module owners | **Done** — tombstones + LES-only `/vault`; see `features/vault/RETIRED.md` |
| **R6** | Reuse `VaultMediaGrid` + maintainer soak | **R6a Done** — `useLesVaultMedia` → grid; soak pending |

---

## 6. Refusals

- No Phase 6 flag flip on the old path.  
- No “just fix refresh” in `use-vault-media`.  
- No goal cancellation disguised as dismantling.  
- No month-long debug of the dead graph.

---

## 7. Next

**R5 done.** Next: **R6** — maintainer soak / product copy.
