# Investigation — Contacts empty after relays disabled / restore (2026-11)

```text
HANDOFF ATOMIC STEP: A1–A5 feedback readiness · A5 honesty adjacent
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER: account-sync restore merge · rehydrate · peerTrust
PROOF BEFORE DONE: L1 vitest mergeRelayList + manual restore preflight; L2 applied heal
SURFACE: desktop shell (TESTER1)
```

## Symptom (operator)

Relays were all **Disabled** → messaging offline. After **Enable all** / reconnect:

- **Groups** still listed (localhost communities).
- **All People** empty / “No connections on this device” — “Tester 2” missing.
- Manual **Restore from relays** toast: success, then sometimes one **Trusted** hex row (no display name).
- Settings → Relays can show **all DISABLED** again after restore.

## Product model (not accidental wipe of groups)

| Domain | Storage | Survives blank contact UI? |
|--------|---------|----------------------------|
| Groups / communities | Local membership ledger + room keys | Yes — local |
| Contacts | Profile-scoped `peerTrust` (+ projection) | Only if local or restored from encrypted backup |
| Display names | Kind 0 / profile cache | Need live relays |

Unlock does **not** auto-restore encrypted backup on native. Empty All People with intact Groups is expected until restore / re-add.

## Confirmed code defects (evidence)

1. **`mergeRelayList` last-write-wins on `enabled`**  
   Incoming backup / merge can force `enabled: false` over local re-enables (`encrypted-account-backup-service` + `restore-merge-module`). Persist path does **not** run `reenableWhenNoRelaysEnabled`.

2. **Rehydrate treats Kind 3 as relay list**  
   `account-rehydrate-service` fetches `10002|3` and parses Kind 3 **content** as relay URL map, then `saveRelayListToStorage` — a newer contact-list event can clobber the local relay enable set. Kind 3 **p-tags** are not applied to `peerTrust`.

3. **Manual restore honesty**  
   `runManualAccountSyncRestore` can report success with zero open relays / empty `peerTrust`; UI copy says “restored” while Network stays empty.

## Not claimed without further proof

- Encrypted backup on relays lacked Tester 2 (possible if never published after accept).
- Projection cutover wiped legacy peers (legacy_hold exists for empty projection).

## Follow-on evidence (Tester1 vs Tester2, 2026-11)

- Relay restore toast: backup had **no trusted contacts** (and effectively no chat history for Tester1).
- **Tester2** still has local SQLite/call history — other device was never wiped.
- **Tester1** DM works after re-add, but old history cannot return from an empty/sparse relay backup.
- Continuity gate re-prompted **every launch** because dismiss lived in **sessionStorage** (cleared on desktop cold start).

## Recovery (operator, now)

1. Settings → Relays → **Enable all** (keep at least one public relay open).
2. Network → **Restore from relays** (or import backup).
3. If a **Trusted** hex appears — that is likely Tester 2; name returns when Kind 0 fetches.
4. Else **Add / Find People** and re-accept Tester 2, then wait for backup publish.
5. After Continue empty / restore, relaunch must **not** re-nag (durable dismiss).
6. Old Tester1 history: only from a fuller backup/import or the peer device — not inventable from an empty relay payload.

## Fix band (this session)

| Item | Change |
|------|--------|
| A | Merge relays with **OR enabled**; heal all-disabled before persist on restore/rehydrate |
| B | Rehydrate relay list from **Kind 10002 only** (stop Kind 3 as relay list) |
| C | Manual restore: refuse when no open relays; message includes restored accepted-peer count |
