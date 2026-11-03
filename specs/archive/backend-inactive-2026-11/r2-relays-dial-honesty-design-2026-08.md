# Design — R2 relays dial honesty probe

**Date (UTC):** 2026-08-02  
**Investigation:** [r2-relays-dial-honesty-investigation-2026-08.md](./r2-relays-dial-honesty-investigation-2026-08.md)

---

## Script

`scripts/r2-relays-dial-honesty-desktop.mjs` · `pnpm verify:r2-relays-dial-honesty`

### Attach

- CDP A `OBSCUR_CDP_URL` default `:9230`  
- CDP B `OBSCUR_CDP_B_URL` default `:9231` (required for Pass; Blocked if missing)  
- App base via `resolvePlaywrightAppBase`  
- Shell: UI chrome OR session unlocked (same Soft L3 Track A rule)

### Per-profile probe

From `window.obscurRelayRuntime.getSnapshot()` + body text:

- `enabledRelayUrls`  
- `writableRelayCount` / phase  
- Open/public evidence: connection list if present, else body `POOL MEMBER`/`CONNECTED`/`Quiet` near nos|primal|damus, else enabled remotes + writable≥2 with remotes enabled (weak), prefer open URL list from runtime connections when exposed

Classify URLs:

- `isLocal` — localhost / 127.0.0.1 :7000  
- `isPublicClearnet` — nos.lol | primal.net | damus.io  

`publicOpenCount` — open public clearnet sockets (or body POOL MEMBER for that host when connections array missing).  
`localOnlyTrap` — ≥1 public enabled AND zero public open AND ≥1 local open.

### Pass

```
pass ⇔ profileA.ok ∧ profileB.ok
profile.ok ⇔ shell ∧ writable≥1 ∧ publicOpen≥1 ∧ !localOnlyTrap
```

Exit: `0` Pass · `1` Fail (`F-DIAL`) · `2` Blocked (CDP/shell).

### Claim language

| May say | When |
|---------|------|
| R2 **Pass** | Report `r2.pass === true` |
| R2 **Fail** | `failClass: F-DIAL` |
| Public Nostr fixed | **Never** from R2 alone |

---

## Proof

| Layer | Command |
|-------|---------|
| L2/L3 | `pnpm verify:r2-relays-dial-honesty` on live dual CDP |
| L1 | reuse `verify:s-pool-delivery-l3:unit` for app-base (no new unit required) |
