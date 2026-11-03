# Design — Soft-lock drift slice 2 (lock screen when SQLite blocked)

**Date (UTC):** 2026-10-13  
**Status:** Implemented · L1 green (2026-10-13) · L3 deferred (client unusable)  
**Parent:** [soft-lock-sqlite-shell-drift-design-2026-10.md](./soft-lock-sqlite-shell-drift-design-2026-10.md) (slice 1 = send gate · L1 Pass)

```text
HANDOFF ATOMIC STEP: Soft-lock slice 2 — show LockScreen when identity unlocked but SQLite not writable
PAUSED / CANCELLED:  Shell-lag until end · M1–M3 · dialects · ASE-2 · SF-B · NIM until P0 · PB1-C/D · SF-A
CANONICAL OWNER:     startup-auth-state-contracts · main-shell · ensureNativeSqliteOpenForWrites
PROOF BEFORE DONE:   L1 contract + existing sqlite-gate tests · no desktop soak
SURFACE:             Desktop/PWA messenger (not profile picker freeze)
```

---

## Goal

When identity UI is unlocked but native SQLite cannot accept writes (encrypted envelope / closed handle), show the **LockScreen** so the operator must re-enter passphrase / Import Key — instead of a chat shell that fails every send.

## Contract

| Input | Lock screen |
|-------|-------------|
| `nativeSqliteWriteBlocked === true` | **Yes** (even if `identityStatus === "unlocked"`) |
| Slice 1 send gate | Unchanged |
| Soft Lock menu / CDP | Out of scope |

## Wire

1. Extend `shouldShowStoredIdentityLockScreen` with optional `nativeSqliteWriteBlocked`.  
2. `NostrMessengerContent`: when identity unlocked + native runtime, probe `ensureNativeSqliteOpenForWrites`; set blocked = `!ready`.  
3. Pass blocked into lock-screen gate; `errorMessage` honesty: storage locked copy.  
4. Successful passphrase unlock re-runs probe (effect deps on identity).

## Non-goals

- Profile-picker / WebView Not Responding (parked until end)  
- Changing Soft Lock semantics  
- L3 dual-profile send (client unusable)

## Proof

- L1: `startup-auth-state-contracts` cases for blocked flag  
- L1: existing `native-storage-at-rest-service.sqlite-gate` stays green  
