# Transport pool + presets — design (v1.9.14 S1)

**Date:** 2026-07-17  
**Investigation:** [transport-pool-presets-investigation-2026-07.md](./transport-pool-presets-investigation-2026-07.md)  
**Scope:** Preset catalog + Settings wiring + honesty copy (no pool refactor)

---

## Invariants

1. **Encryption on client** — presets only configure **which endpoints carry ciphertext**; they never change E2EE or LES owners.
2. **One relay list owner** — `useRelayList` / settings model; presets call `replaceRelays` only.
3. **Conduit Mesh remains default pool** on desktop when `shouldUseConduitMeshRelayPoolHook()` is true.
4. **Explicit profile scope** — pool runtime already keyed by `getResolvedProfileId()` in mesh hook.

---

## Preset catalog (`transport-preset-catalog.ts`)

```typescript
type TransportPresetId =
  | "default_stable"
  | "high_redundancy"
  | "low_latency"
  | "local_dev_mesh";

type TransportPreset = {
  id: TransportPresetId;
  labelKey: string;           // i18n
  descriptionKey: string;     // i18n — shown on apply toast / help
  relays: string[];
  transportMode: "basic" | "redundancy";
};
```

| Preset | Relays | Mode | Use case |
|--------|--------|------|----------|
| `default_stable` | damus + nos.lol + primal | basic | Default public |
| `high_redundancy` | 5 public relays | redundancy | Resilience |
| `low_latency` | primal + damus + nos.lol | basic | Latency bias |
| `local_dev_mesh` | `ws://localhost:7000` | basic | Local relay dev stack |

`applyTransportPreset(presetId)` returns relay rows `{ url, enabled: true }` + `transportMode`.

---

## Settings integration

- `settings-tab-panel-shared.tsx` re-exports `RELAY_PRESETS` / `RelayPresetId` from catalog (backward compat).
- `use-relays-settings-model.applyRelayPreset` uses catalog + sets `relayTransportMode` from preset.
- `translateRelayPresetLabel` handles `local_dev_mesh` i18n key.
- Relays panel: one-line **encryption note** under connectivity (S3).

---

## Out of scope (this slice)

- Tri-route hook subtraction
- Tor-required preset (needs C13 L3)
- Rust move of pool policy
- Onboarding wizard

---

## Acceptance

- [ ] Catalog unit tests: all preset ids resolve, local dev URL present
- [ ] Contract: settings import catalog, not duplicate relay arrays
- [ ] Apply local dev preset enables localhost relay
- [ ] i18n keys for new preset + encryption note
