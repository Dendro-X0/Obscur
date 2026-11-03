# Single-door unlock loop — investigation (2026-11)

```text
HANDOFF ATOMIC STEP: optional L3 desktop soak (key once → bind → lock → password only → chat)
ACTIVE BAND / SCOPE:   Single-door Slice A+B+C L3 soak failure (unlock loop)
PAUSED / CANCELLED:    Soft L3 · Tor Verified · Spaces · Matrix promote · Continuity UI
FORBIDDEN THIS TASK:   greenfield · OAuth · derive PDK from nsec · Nostr decoupling mega-refactor
CANONICAL OWNER:       AuthScreen + AuthGateway (bind-pending) · native-storage-at-rest (PDK)
PROOF BEFORE DONE:     L1 vitest · L2 auth-screen/gateway · L3 desktop soak unlock → chat
SURFACE:               Tauri desktop (static shell)
```

## Symptom (maintainer report + screenshot)

1. **Log In** with device password → UI claims password is **incorrect**.
2. **Import Key** → appears to succeed briefly or bounce → back to Auth **Log In / Device password**.
3. Perceived **endless loop**; shell never stably usable.

Screenshot: Tester1, passphrase-primary tabs visible (Log In + Import Key), device-password field filled — **not** the Slice A `device_password_bind` form.

## Runtime evidence (dev terminal)

| Signal | Meaning |
|--------|---------|
| `[SESSION] Native session cleared for profile default` (×2) | Lock / sign-out cleared OS session |
| `[STORAGE] SQLite encrypted at rest.` | Envelope present — PDK required; plaintext `desktop_db_ensure_open` must **fail** |
| `[SESSION] Native session initialized and persisted for npub1uplk0…` | **Private-key (or stay-signed-in) identity unlock succeeded** at least once |

So identity unlock via key is **not** universally broken; the loop is after (or beside) that success.

## Owners

| Concern | Owner |
|---------|-------|
| Identity passphrase / key unlock | `use-identity` (`unlockIdentityAction`, `unlockWithPrivateKeyHexAction`) |
| Keep Auth mounted while PDK bind needed | `device-password-bind-pending` + `AuthGateway.isShellReady` |
| Bind UI + Welcome Back gate | `AuthScreen` local React state (`devicePasswordBindRequired`, `importKeyGuideStep`) |
| PDK open / restore | `syncNativeVaultEncryptionSessionAfterIdentityUnlock` / `restoreNativeVaultEncryptionSessionIfNeeded` |

## Failure modes (ranked)

### FM1 — Bind-pending holds shell; bind UI state is only React-local (HIGH)

**Mechanism**

1. Advanced key unlock → identity unlocked → `restore` / `ensureNativeSqliteOpenForWrites` false (encrypted envelope).
2. `setDevicePasswordBindPending(true)` (module) + `setDevicePasswordBindRequired(true)` + `importKeyGuideStep = "set_device_password"` (**React state**).
3. `AuthGateway.isShellReady = false` → Auth stays mounted (correct for Slice A).
4. Any **AuthScreen remount** (route, profile shell, Strict Mode, runtime phase) resets React state → default Log In / enter_key, while **module bind-pending stays true**.
5. User sees password Auth again; shell never opens.

**Amplifiers**

- `handleLoginUsername` / `handleLoginFinal` early-return when `isProfileWindowUnlockedForAppShell` is true (identity unlocked). With bind-pending, Log In / Import Key become **silent no-ops** — feels like a dead loop.
- Clicking Import Key tab resets `importKeyGuideStep` to `"enter_key"` (button handlers) even if bind was required.

**Matches:** key → back to password screen; screenshot without bind form; terminal session init without durable chat.

### FM2 — “Incorrect password” is identity-wrap mismatch (HIGH for password path)

`unlockIdentityAction` throws bare `"Incorrect password"` only when password-encrypted candidates exist but **none decrypt**.

Likely after Slice A/C churn:

- `completeDevicePasswordBindAfterKey` / optional `resetPassphraseWithPrivateKey` on key unlock **re-wraps** identity to a new device password.
- Maintainer retries the **previous** daily password → correct product error, terrible UX if rewrap was incidental or bind UI was lost (FM1).

Not the same as PDK failure: PDK fail after successful decrypt throws `"Local database is locked…"` with identity possibly left unlocked (`requireNativeOpen: true` path).

### FM3 — Passphrase unlock opens identity then fatals on PDK (MEDIUM)

`syncVaultEncryptionSessionBestEffort({ passphrase, requireNativeOpen: true })` after identity unlock:

- Activate with daily password → if PDK was minted under a **different** passphrase / keychain-only PDK, activate may fail; restore may recover.
- If both fail → throw; identity can remain unlocked while Auth shows an error → soft half-state, then FM1-like Auth hold if anything sets bind-pending inconsistently.

### FM4 — Architecture / “scrap Nostr / remove keys” (OUT OF BAND)

Maintainer frustration about Nostr ceiling and key UX is real as **product feeling**, but handoff forbids greenfield, key removal (self-custody root), and mega-decouple. Decoupling track is already strangler D0–S5. **This investigation does not charter that work.**

## Non-goals

- Continuity / BKP-2 / Soft L3 / Tor / Spaces / Matrix
- OAuth or PDK-from-nsec
- Rewriting auth from scratch

## Fix direction (design next — subtraction first)

1. **Single owner for bind UX:** module (or gateway) flag must drive UI — on AuthScreen mount, if `isDevicePasswordBindPending()`, force `device_password_bind` step (do not rely on ephemeral React-only `devicePasswordBindRequired`).
2. **No silent early-return** while bind-pending: if identity unlocked && bind-pending → show bind form; password/key submits route to bind / no-op with explicit copy.
3. **Do not reset guide step** to `enter_key` from tab clicks while bind-required.
4. **Rewrap discipline:** only re-wrap identity passphrase on explicit bind success (already mostly true for bind helper); avoid optional upgrade on key path that changes daily password without clear UI.
5. **Error copy:** distinguish identity incorrect password vs local DB / PDK locked (don’t collapse PDK errors into “incorrect password”).

## Proof plan

| Layer | Check |
|-------|--------|
| L1 | Unit: remount / subscribe restores bind UI when module pending; early-return does not swallow bind-pending |
| L2 | `auth-screen` + bind-pending + gateway: key unlock + closed PDK → bind form survives remount; password wrong stays passphrase-primary |
| L3 | Desktop: Import Key → bind once → Welcome Back → lock → **password only** → chat; restart + keychain PDK |

## Status

- Investigation: **closed for FM1** (design + impl landed L1/L2/L3)
- FM2 (true wrap mismatch after rewrap): still possible — treat as password education, not scrap
- Claim: FM1 unlock-loop **L3 Pass** for Lock → inactive session → password → shell (2026-11-02)
- Prior Fail root cause + fix: [fm1-l3-session-active-auth-gate-investigation-2026-11.md](./fm1-l3-session-active-auth-gate-investigation-2026-11.md) / [design](./fm1-l3-session-active-auth-gate-design-2026-11.md)
- Soak artifact: [single-door-fm1-l3-soak-latest.md](../../docs/handoffs/single-door-fm1-l3-soak-latest.md)
