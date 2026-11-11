# Investigation — Soft L3 Local Dev Mesh persist / reload clobber (2026-11-08)

```text
Handoff NEXT: Soft L3 persist hygiene study (not Fixed)
PAUSED: Soft L3 Fixed · Tor · Matrix · Continuity · A4 · invite Fixed without cut
Related: specs/backend/local-relay-pool-zero-active-investigation-2026-11-08.md (pool hung CONNECTING — separate)
```

## Claim bounds

- May say: Soft L3 **Apply pack** writes exclusive `ws://localhost:7000`; hard reload **clobbers** via `mergePublicBootIntoLoopbackOnlyList` + lab force-off; investigation Pass
- Must not say: Soft L3 Fixed · pool Fixed · Tor Verified · packaged NSIS CDP Pass

## Repro (CDP Tester1 `:9230`, 2026-11-08)

| Step | Storage `obscur.relay_list.v2…` | Runtime `enabledRelayUrls` |
|------|--------------------------------|----------------------------|
| After **Replace and apply** Local Dev Mesh | `[{url:"ws://localhost:7000",enabled:true}]` | `["ws://localhost:7000"]` |
| After **hard reload** | Public Default Stable **enabled** + `http://127.0.0.1:8788` disabled + `ws://localhost:7000` **disabled** | `["wss://nos.lol","wss://relay.primal.net"]` (damus may lag) |

## Causal chain

1. **Apply pack (Replace)** persists a **loopback-only** list (Soft L3 exclusive).
2. On every cold load, `resolveLoadedRelayList` → `mergePublicBootIntoLoopbackOnlyList(parsed, DEFAULT_RELAYS)` (`use-relay-list.ts`).
3. `isLoopbackOnlyRelayList` is true → merge inserts **Default Stable** rows with `enabled: true` and appends loopback rows (often still enabled at merge time).
4. Healed list is **written back** to storage (`saveRelayListToStorage`).
5. Later `reconcileLocalDevWorkspaceRelay`: `hasEnabledNonLocalRelay` true → **force-off** lab assists (`isLocalLabAssistRelayUrl`), unless URL matches operator Team workspace override — Local Dev Mesh exclusive sessions usually **disable** `:7000`.
6. Operator must re-Apply Local Dev Mesh for leave/invite/block Soft L3 soaks.

## Owners

| Concern | Owner |
|---------|-------|
| Load heal / public boot merge | `relay-transport-scope.ts` · `mergePublicBootIntoLoopbackOnlyList` |
| Load path | `use-relay-list.ts` · `resolveLoadedRelayList` |
| Lab force-off when remotes on | `workspace-dev-relay-bootstrap.ts` · `reconcileLocalDevWorkspaceRelay` |
| Soft L3 pack contents | `LOCAL_DEV_MESH_PRESET` (`transport-preset-catalog.ts`) |

## Non-causes (this band)

- Docker `:7000` down (probe open-ok during soaks)
- Hung-CONNECTING pool trap (separate; leave L2 already Pass in-session)
- Release NSIS CDP absence (packaged soak blocker; not this storage clobber)

## Evidence pointers

- Unit already documents merge intent: `relay-transport-scope.test.ts` “merges public boot rows into loopback-only stored lists”
- Comment on merge: prod-first “so metrics show the public pool”
- Comment on `DEFAULT_RELAYS`: “Local Dev Mesh is an optional pack, not boot”

## Next

Design hygiene that preserves **intentional Soft L3 exclusive** across reload without claiming Soft L3 Fixed (pool/unlock bands remain separate).
