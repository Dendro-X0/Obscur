# Design — R-RELAY-RUST-6b Offline pack export / import IPC

**Status:** RUST-6b L1 Pass · 6c L3 Pass  
**Prior:** [RUST-6 charter](./r-relay-rust-6-offline-dtn-charter-2026-07.md) · [RUST-6a](./r-relay-rust-6-offline-dtn-charter-2026-07.md) pack schema L1 Pass  
**Slice:** Desktop file export + import · evidence on import · profile scoped

---

## Session gate

```text
HANDOFF ATOMIC STEP:  RUST-6a L1 Pass · next 6b when requested
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      apps/desktop/src-tauri/src/mesh/offline/ (+ transport async IPC)
PROOF BEFORE DONE:    cargo test mesh::offline · vitest host route + contracts L1
OUT OF SCOPE:         BLE/QR · UI · dm-engine persist soak (6c) · claim offline fixed
```

---

## Goal

Move a verified `obscur-offline-pack/v1` file between machines/profiles via **explicit desktop IPC** — not the relay pool, not browser pool failover.

| Action | Result |
|--------|--------|
| **exportOfflinePack** | Encode + write file → evidence `offline_export_ready` |
| **importOfflinePack** | Read + verify MAC/expiry/profile → evidence `imported_offline` **or** `offline_pack_rejected` |

Invariant: `imported` ≠ live relay `accepted`. No ambient current-user — `scope.profileId` required.

---

## Mental simulation

1. Sender invokes `exportOfflinePack` with `scope.profileId`, ciphertext envelopes, `packKeyHex`, destination path.
2. Rust encodes pack (schema matches 6a TS), HMAC-SHA256, writes `.obscur-offline-pack.json`.
3. Courier copies file (USB / share) — out of band.
4. Receiver invokes `importOfflinePack` with **their** `scope.profileId`, same `packKeyHex`, file path.
5. Soft reject if MAC/expiry/hint/envelope profile mismatch — never write wrong vault.
6. Success returns verified envelopes + `imported_offline` evidence for host/dm-engine (persist soak = **6c**).

---

## Contract

### Transport methods (desktop async, same pattern as mesh configure)

| Method | Payload (camelCase) | Outcome |
|--------|---------------------|---------|
| `exportOfflinePack` | `envelopes[]` (wire), `packKeyHex`, optional `filePath` / `fileName`, optional `expiresAtUnixMs` | `{ ok, filePath, evidence[], rejectReason? }` |
| `importOfflinePack` | `filePath`, `packKeyHex` | `{ ok, envelopes[], evidence[], rejectReason? }` |

- Profile from `request.scope.profileId` only (also used as `profileIdHint` on export).
- Pack key: caller-supplied hex (keychain ownership later — not 6b).
- File: absolute path **or** workspace-exports `fileName` ending `.obscur-offline-pack.json`.
- libobscur headless: `desktop_required` stubs (parity with other mesh methods).

### Owners

| Concern | Owner |
|---------|--------|
| Pack encode/verify (Rust mirror of 6a) | `mesh/offline/pack.rs` |
| File read/write | `mesh/offline/io.rs` |
| IPC | `commands/transport_engine.rs` + `tauri-engine-host` route |
| TS schema (reference + web encode) | `@obscur/conduit-mesh-contracts` offline-pack (unchanged owner) |
| Persist messages into vault | **6c** — not silent SQLite in 6b |

### Subtract / forbid

- No publish to live mesh from offline pack
- No thickening `relay-browser-pool-runtime`
- No BLE/QR
- No ambient profileId

---

## Proof plan

| Layer | Command |
|-------|---------|
| L1 Rust | `cd apps/desktop/src-tauri && cargo test mesh::offline -- --nocapture` |
| L1 TS | vitest `tauri-engine-host` route + offline-pack contracts |
| L3 | Deferred to **RUST-6c** two-profile sneakernet |

**Claim:** Offline transfer **implemented** (IPC L1). Not **fixed** until 6c.

---

## Next

After L1 Pass → handoff next **RUST-6c** when requested.
