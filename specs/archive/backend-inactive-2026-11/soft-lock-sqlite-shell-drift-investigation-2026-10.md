# Investigation — Soft-lock SQLite closed while shell stays unlocked

**Date (UTC):** 2026-10-11  
**Status:** Closed for eng · slices 1–3 **L1** (2026-10-13) · L3 P5 deferred (client unusable)  
**Surface:** Track L dual CDP · `pnpm dev:desktop:no-coord` · Tor OFF  
**Related:** [manual-lock-native-rehydrate-investigation-2026-08.md](./manual-lock-native-rehydrate-investigation-2026-08.md) (inverse: lock undone by keychain rehydrate)

---

```text
HANDOFF ATOMIC STEP:  P5 group live (invite + dual send) — blocked here
PAUSED / CANCELLED:   Dialects · M1–M3 · ASE-2 as GTM
CANONICAL OWNER:      desktop DbState · storage_at_rest · auth-kernel
PROOF BEFORE DONE:    L3 group send without "Local database is locked"
```

---

## 1. Symptom

After Soft Lock / lock cycle during Track L:

1. Shell shows **unlocked** chat UI (Tester1 / Tester2, Connected 1/1, communities list).  
2. Group create can still produce a local community row (`PB1A-*`, `ws://localhost:7000`).  
3. Group **send** fails with UI: `Failed to send group message. Check relay scope and retry.`  
4. Console true cause: `Failed to send message: Local database is locked. Unlock this profile to continue.`

Relay pool is healthy (`enabledRelayUrls: ["ws://localhost:7000"]`, `writableRelayCount: 1`). Failure is **not** Quiet-scope.

## 2. Evidence (2026-10-11)

| Probe | Result |
|-------|--------|
| Native error string | `apps/desktop/src-tauri/src/commands/db.rs` — `DbState.with_db` when `db: None` |
| Keychain restore | `desktop_storage_at_rest_restore_keychain` → `null` (no PDK for profile) |
| Soft toast | Unrelated nos.lol storm (mitigated separately via `shouldSurfaceSoftRelayConnectToast`) |
| Groups | `PB1A-1791732040`, `PB1A-1791732571` on ledger; send both fail locked |

## 3. Mechanism (current understanding)

| Layer | State after soft-lock drift |
|-------|-----------------------------|
| JS identity / session | Present — shell renders unlocked |
| `DbState.db` | `None` — SQLite closed (and may be encrypted at rest) |
| OS keychain PDK | Missing for these demo profiles → restore cannot reopen DB |
| UI copy | Surfaces as “relay scope” on group send — **misleading** |

Inverse of 2026-08 manual-lock investigation: there, keychain **reopened** session against manual lock; here, identity UI stays up while **storage** stays locked.

## 4. Hypotheses (ranked)

1. **H1 (likely):** Soft Lock / `desktop_storage_at_rest_lock` closed SQLite; subsequent identity restore skipped passphrase/`activateNativeStorageAtRestUnlock` because stay-signed-in / session already looked valid.  
2. **H2:** HMR / dual-window profile switch left `DbState` closed for default profile while WebView kept chat state.  
3. **H3:** Group create path writes enough to localStorage/ledger without SQLite write; send path requires SQLite → fails.

## 5. Fix direction (design next — no code this pass)

1. **Honesty:** Map `Local database is locked` to a dedicated toast (not “relay scope”).  
2. **Gate:** If shell is “unlocked” but `with_db` would fail, force auth/storage unlock surface (or auto-call `ensureNativeVaultEncryptionSessionForWrites` / restore before group send).  
3. **P5 ops:** Operator passphrase unlock (or Import Key + unlock) that runs `desktop_storage_at_rest_unlock` with PDK; then invite + dual send.

## 6. Stop / next

- Soft-toast Phase 1 shipped (suppress when any relay healthy) — reduces CDP click interception.  
- P5 remains operator/storage unlock gated.  
- Next design slice when opened: `soft-lock-sqlite-shell-drift-design-2026-10.md`.

---

_Last updated: 2026-10-11_
