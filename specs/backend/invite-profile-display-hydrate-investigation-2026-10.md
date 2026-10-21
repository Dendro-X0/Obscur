# Investigation — Invite & secondary profile display names (2026-10)

## Handoff

- Atomic step remains P5 group live; this is a **display blocker** for invite selection.
- PAUSED bands (M1 / ASE-2 / dialects): not touched.
- Constraint: fragile surface — **hydrate only**, no connection-store privilege or peerTrust changes.

## Symptoms

1. Invite Connections shows pubkey preview (`3db055b4…d946830f`) + generic avatar, not “Tester2” + picture.
2. Profile picker: Tester1 OK; second card “Profile slot / Needs setup”.

## Findings

### Invite Connections

| Source | Path | Result for Tester2 |
|--------|------|--------------------|
| `peerTrust.acceptedPeers` | pubkey list only | Peer present (row exists) |
| `createdConnections[].displayName` | DM sidebar | Often empty / “Unknown contact” |
| `discoveryCache.getProfile` | kind-0 cache | Miss when never hydrated **or case mismatch** |
| `resolvedIdentityCache` | friend-code / search | Often missing `display` (codes carry pubkey only) |
| `useResolvedProfileMetadata(..., { live: true })` | relay kind-0 | Fails when soft-l3 has no kind-0 / matcher was case-sensitive |
| Local profile-slot hints | `buildAccountDisplayHintsByPublicKey` | **Empty across dual CDP windows** — partitions do not share localStorage |
| Fallback | `formatPeerPubkeyPreview` | **What user saw after first UX pass** |

Additional bugs found after “Trusted connection” subtitle shipped (confirming new UI was live):

1. `createdConnections.find(c => c.pubkey === pk)` was **case-sensitive** while `peerTrust` normalizes lowercase.
2. Invite list passed **already-resolved** presentation (often hex) back into ConnectionRow as `connectionDisplayName`, dropping the raw DM label path.
3. Discovery / resolved-identity / kind-0 hydrate caches used case-sensitive pubkey equality.

### Profile picker second card

`enrichDesktopProfilePreview` invents `Account <8hex>` when `publicKeyHex` exists. `hasSavedAccountPickerPresence` is true for any 64-char pubkey.

Therefore “Profile slot / Needs setup” means **`publicKeyHex` is absent** for that registry entry — empty slot, not a failed enrich of Tester2.

**Do not** invent Tester2 onto an empty registry slot.

## Fix (hydrate only)

1. Case-insensitive DM / discovery / resolved / kind-0 lookups.
2. Invite presentation also consults `resolvedDisplayName`.
3. On invite open: upgrade Unknown DM labels from caches; async IndexedDB account hints.
4. Experiment-online only: `seedLabPeerDisplayHintsIfNeeded` seeds Tester1/Tester2 **public** fixture pubkeys into discovery/resolved/metadata so dual-window soft-l3 invite rows stay human-readable without re-privileging connectionStore.
5. **Avatar:** local name seeds must not set `appliedRelayKind0` / cancel kind-0 retries (was blocking pictures). Seed avatars from local profile-slot hints when readable; `UserAvatar` also reads discovery `picture`.

## Proof plan

- L1: unit tests — presentation, findDmConnectionByPubkey, lab seed gate
- L2: `pnpm --filter @obscur/pwa exec` targeted vitest + `build:static`; reopen Invite Connections → expect **Tester2**
- Profile picker empty slot stays Needs setup until that slot has a bound account
