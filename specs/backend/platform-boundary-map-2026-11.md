# Platform boundary map — P1 (2026-11)

**Status:** Inventory complete · K1–K8 + P2-S S1–S5 L3 + P3–P6 + P4d–P4h + C3 + P7–P7c landed · Soft L3/Tor/Matrix PAUSED  

**Parent:** [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)  
**Security:** [sandboxed-storage-security-design-2026-11.md](./sandboxed-storage-security-design-2026-11.md) (Storage owns quarantine)

```text
HANDOFF ATOMIC STEP: P1 boundary map
CANONICAL OWNERS:    named below per plane
PROOF:               this doc; next = smallest kill-list deletions or P2/P2-S design
```

## 1. Plane owners (one each)

| Plane | Canonical owner (path / symbol) | Responsibility |
|-------|----------------------------------|----------------|
| **Auth (door + session)** | `auth-kernel` ports → `use-identity` store · `AuthGateway` / `AuthScreen` | Unlock, lock, stay-signed-in, bind-pending → shell ready |
| **Profiles (slots)** | `profiles/services/desktop-profile-runtime` + `ProfileRegistryService` · `resolveIdentityScopeProfileId` | Window↔profile binding, registry, isolation snapshot |
| **Storage (at-rest + media)** | `storage/services/native-storage-at-rest-service` + `vault-at-rest` · Media CAS under `vault/services` | PDK, SQLite envelope, inbound quarantine (P2-S) |
| **PAL** | `protocol-adaptation/layer.ts` → `ProtocolAdaptationLayer` | Active protocol/transport; send/list façade |
| **Nostr adapter** | `protocol-adaptation/nostr/*` + `@obscur/protocol-nostr` | Wire/Nostr-only; not shell identity |
| **Matrix adapter** | `protocol-adaptation/matrix-adapter.ts` | Lab only until promote charter |

## 2. Parallel writers / dual trees (subtraction targets)

### Auth

| Parallel | Problem | Kill / collapse toward |
|----------|---------|-------------------------|
| UI → `use-identity` **and** raw `authKernelIdentityActions` / legacy delegates from scatter | Dual mutation paths | Shell/UI → `useAuthKernelSurfaceActions` / ports only; legacy bridge shrink |
| `window-runtime-supervisor` unlock + AuthScreen unlock | Two “who unlocks” narrators | Runtime calls kernel ports; AuthScreen owns UX only |
| Auth assistant vault + identity wrap + PDK | Three secrets planes (OK if documented) | Keep distinct; document; no fourth |

### Profiles

| Parallel | Problem | Kill / collapse toward |
|----------|---------|-------------------------|
| `features/profiles/*` vs `features/profile/*` (publisher hooks) | Two “profile” trees | Display/publish stays `profile`; **slots/isolation** only `profiles` |
| `resolveIdentityScopeProfileId` vs `getResolvedProfileId` vs registry `activeProfileId` | Scope drift | Desktop: identity scope wins; document web fallback |
| LocalStorage registry keys + native isolation snapshot | Dual source of truth at boot | Boot payload / sync scope → registry; delete stale readers over time |

### Storage

| Parallel | Problem | Kill / collapse toward |
|----------|---------|-------------------------|
| JS `profile-storage-key-session` + native `StorageAtRestState` | Must stay paired | Sole open path: `syncNativeVaultEncryptionSessionAfterIdentityUnlock` / ensure* |
| Media CAS in-memory Map + vault disk | Quarantine gap | P2-S: quarantine dir owner under Storage; CAS reads only via policy |
| Messaging `storage-health-service` | Side diagnostics OK | Must not open/unlock DB |

### PAL / messaging

| Parallel | Problem | Kill / collapse toward |
|----------|---------|-------------------------|
| **`dm-send-with-retry` / `dm-delete-pipeline` import `nostrAdapter` directly** | Bypasses PAL | **K1 done** — `sendDmNostrOnly` (always Nostr wire, layer-owned) |
| `dm-controller` uses layer **and** Nostr `SendConfirmation` type | Rich type leak | **K6 done L1** — PAL `send-confirmation.ts` export (slim canonical still deferred) |
| `listDmMessages` / `listDmConversations` via layer (good) vs send bypass (bad) | Asymmetric compliance | Align send with list |
| Messaging UI `useIdentity` for pubkey | Acceptable read | Must not unlock/mutate identity from composer |

## 3. Nostr leakage into Auth / Profiles / Storage UI

Spot-check (`apps/pwa`): **no direct `nostrAdapter` imports** under `features/auth`, `features/profiles`, `features/storage`, `features/auth-kernel` in this inventory pass.

Residual coupling is **indirect**: identity pubkey hex as Nostr-shaped id, relay settings, account-sync kinds — acceptable until PAL identity-bind port exists; do not block P2 on erasing hex ids.

## 4. Kill list (ordered — smallest first)

| # | Action | Plane | Risk |
|---|--------|-------|------|
| **K1** | Stop `dm-send-with-retry` + `dm-delete-pipeline` importing `nostrAdapter`; call `sendDmNostrOnly` on layer | PAL | **Done** (L1 contracts) |
| **K2** | Ban `nostr-adapter` imports outside `protocol-adaptation/` (contract test) | PAL | **Done** (L1) |
| **K3** | Document Auth mutation entry: kernel ports only; mark `auth-kernel-legacy-delegates` as bridge with removal criteria | Auth | **Done** L1 — `auth-kernel-legacy-bridge-removal.ts` · `platform-k3-auth-mutation-entry.contract.test.ts` |
| **K4** | Rename or README fence: `features/profile` = social display; `features/profiles` = slots | Profiles | **Done** L1 — READMEs + `platform-k4-profile-trees-fence.contract.test.ts` (no mass rename) |
| **K5** | Quarantine path owner module stub under Storage (P2-S S1 policy first) | Storage | **Superseded by P2-S S1–S2b** (policy + quarantine persist) |

Do **not** invent a new “PlatformKernel” package before K1–K2.

## 5. Owner map (quick reference)

```text
AuthGateway ──► useIdentity / auth-kernel ports ──► Storage sync (PDK)
     │                      │
     │                      └── resolveIdentityScopeProfileId ◄── profiles runtime
     │
Messaging UI ──► ProtocolAdaptationLayer ──► nostr | matrix adapters
                      ▲
                      └── KILL direct nostrAdapter from dm-send / dm-delete
```

## 6. Next after P1

1. ~~**Execute K1**~~ **done** — `sendDmNostrOnly` · D1/S4 contracts Pass  
2. ~~**K2**~~ **done** — `decoupling-k2-nostr-adapter-boundary.contract.test.ts`  
3. ~~**P2-S S1–S4 + S2b**~~ **done** (L1) — policy · quarantine · preview · export · AppData persist  
4. ~~**K3**~~ **done** — mutation entry + bridge removal criteria contract  
5. ~~**K4**~~ **done** — `profile` display vs `profiles` slots README fence + contract  
6. ~~**P3** PAL port freeze~~ **done** L1 — `pal-port-freeze-p3-design` · `platform-p3-pal-port-freeze.contract`  
7. ~~**P2** daily-door fence~~ **done** L1 + L3 — Advanced key / passphrase primary contract  
8. ~~**P2-S S5**~~ **done** L1–L3 — CAS + read deny + AppData CDP Pass  
9. ~~**P4** second-carrier~~ **done L1** — pick = `private_dc` (Matrix promote PAUSED)
10. ~~**P4b** private_dc HTTP wire~~ **done L1** — `/v1/conversations` client + adapter · mocked-fetch vitest Pass
11. ~~**P5** naming~~ **done L1** — glossary · Settings Obscur-Nostr / Matrix (lab) / Private DC · no mass path rename

12. ~~**P2** daily-door L3~~ **Pass** — CDP passphrase primary · Advanced · no OAuth · shell reentry
13. ~~**P4c** private_dc L2 lab~~ **Pass** — local `/v1` server · soak + client live-fetch (not production DC)
14. ~~**P6** plane README fences~~ **done L1** — auth-kernel · auth · storage · PAL
15. ~~**K6** SendConfirmation PAL~~ **done L1** — `send-confirmation.ts` · no nostr-adapter export hop
16. ~~**P4d** private_dc adapter CDP~~ **Pass** — lab `/v1` · hooks list/send · adapter L2

17. ~~**P2-S S4 L3**~~ **Pass** — inbound export consent CDP
18. ~~**K7** CanonicalSendConfirmation~~ **done L1** — slim DTO + mapper
19. ~~**K8** onConfirmed Canonical~~ **done L1** — pipeline + dm-controller

20. ~~**P4e** private_dc send profile scope~~ **done L1** — `sendMessage.profileId` · wrong-profile fail-closed
21. ~~**P4f** private_dc connect + listMessages scope~~ **done L1** — `connect(transport, profileId)` · soak listMessages
22. ~~**P4g** private_dc rich list shim~~ **done L1** — listDm* → DC · no Nostr fallthrough
23. ~~**P7** Obscur-Nostr first body leaf~~ **done L1** — `canonical-from-rich` in `@obscur/protocol-nostr`
24. ~~**P7b** Obscur-Nostr capabilities leaf~~ **done L1** — `OBSCUR_NOSTR_CAPABILITIES` in package
25. ~~**P7c** Obscur-Nostr display + hints~~ **done L1** — display name + migration hints in package
26. ~~**P4h** private_dc capabilities + rich map~~ **done L1** — `PRIVATE_DC_CAPABILITIES` · rich-map leaf
27. ~~**C3** Matrix lab capabilities + rich map~~ **done L1** — not Matrix promote

Default recommendation: maintainer-directed cut · Soft L3 / Tor / Matrix promote still PAUSED.

## 7. Status

- P1 map: **written**
- K1–K8 + P2-S S1–S5 L3 + P3 L1 + P2 L1/L3 + P4/P4b/P4c/P4d/P4e/P4f/P4g/P4h + P5 + P6 + P7–P7c L1: **landed**
- Claim: rewrite-band through P7c + C3 + P2/S2–S5 L3 + P4h; Soft L3 / Tor / Matrix promote still PAUSED
