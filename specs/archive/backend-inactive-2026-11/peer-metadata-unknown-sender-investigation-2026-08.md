# Investigation — peer display “Unknown sender” / hex labels + metadata retry

**Date (UTC):** 2026-08-04  
**Status:** Investigation only — **no implementation this step**  
**Evidence:** Maintainer manual dual-profile DM (Tester1 ↔ Tester2) — DM delivery works; thread shows pubkey hex headers + message label **Unknown sender**; relay toasts for `nos.lol` / `damus.io` with partial `K/N` active relays.

---

```text
NEXT ATOMIC STEP:     Manual core verify evidence → peer metadata retry (this investigation)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      useProfileMetadata · useResolvedProfileMetadata · SenderName (message-list)
PROOF BEFORE DONE:    Investigation accepted → design → L1 metadata retry + display fallback
OUT OF SCOPE:         AUTH-SESSION restore · community · Soft L3 Docker ship claim
```

---

## Symptoms (from screenshots)

| Surface | Observation |
|---------|-------------|
| Chat list / thread header | Peer shown as full/truncated **pubkey hex**, not Tester1/Tester2 |
| Incoming bubbles | Label **Unknown sender** |
| Local self | “YOU” / TESTER1·TESTER2 chrome OK |
| DM | Markers and replies deliver — **transport OK** |

---

## Canonical owners

| Concern | Owner |
|---------|--------|
| Kind-0 fetch + cache | `apps/pwa/app/features/profile/hooks/use-profile-metadata.ts` |
| Self vs peer resolve | `use-resolved-profile-metadata.ts` |
| Bubble label | `SenderName` in `message-list.tsx` → `metadata?.displayName \|\| "Unknown sender"` |
| Publish own kind 0 | `use-profile-publisher.ts` → `seedProfileMetadataCache` |

Not AUTH-SESSION (cancelled). Not community display-name helpers (PAUSED).

---

## Mental model (one open-thread action)

```text
Open DM with peer pubkey
  → SenderName / header call useProfileMetadata(pubkey)
  → cache / discovery / connectionStore (if connection row exists)
  → pool.subscribe kinds:[0] + one-shot fetchLatestEventFromRelayUrls
  → if kind 0 has display_name/name → show name
  → else → "Unknown sender" / hex header forever (today)
```

---

## Root-cause hypotheses (ordered)

### H1 — No scheduled retry after empty/failed kind-0 fetch (matches user ask)

`shouldFetchDirect` runs once while `!directFetchState.has(pubkey)`. Fetch completes (null or error) → `directFetchState.delete` → **effect does not re-schedule** unless `pubkey` / `enabledRelayUrlsKey` / remount changes.

When relays are partially down (`Couldn't reach nos.lol` / `damus.io` ×N) the first fetch often fails; later `2/3` or `1/4` healthy still **does not auto-retry** metadata.

**Fit to user ask:** “If the system fails to identify the other party initially, it should automatically retry to retrieve the metadata.”

### H2 — Kind 0 never published for Tester profiles

If Tester1/Tester2 never successfully published kind 0 to the shared public pool, no amount of retry yields a name until publish succeeds. Local username (TESTER1) is only applied for **self** in `useResolvedProfileMetadata`.

### H3 — Connection-store name not wired into SenderName

`useProfileMetadata` can apply `connection.displayName` when a connection row exists, but `SenderName` only renders `metadata?.displayName`. Header may use a different path that falls back to raw hex. Invite path already has `resolveInviteConnectionDisplayName` (Unknown contact) — DM thread does not reuse that fallback policy.

### H4 — Hex treated as “name” nowhere but shown as title

UI titles use pubkey string when `displayName` missing — looks like “random strings.”

---

## Proposed fix slices (after design)

| ID | Slice | Proof |
|----|-------|-------|
| **M0** | This investigation | Doc review |
| **M1** | Auto-retry kind-0 hydrate: backoff when `needsRelayHydration` and fetch empty/fail; also retry when pool health improves (writable/open count↑) | **Pass** (L1) — 2026-08-04 · [peer-metadata-m1-retry-design-2026-08.md](./peer-metadata-m1-retry-design-2026-08.md) |
| **M2** | Display fallback: connection / invite resolve / short pubkey preview — never silent raw 64-hex as “name”; keep Unknown sender only briefly while retrying | **Pass** (L1) — [peer-metadata-m2-display-fallback-design-2026-08.md](./peer-metadata-m2-display-fallback-design-2026-08.md) |
| **M3** | Ensure profile publish of kind 0 on username set (if gap) so peer can resolve | L1 publisher + optional L3 dual-profile |

Do **not** invent a parallel metadata cache. Extend `useProfileMetadata` owner.

---

## Neighbor modules (must not regress)

- Mesh DM `publishToUrls` (already working per maintainer)
- Relay toast / native-error-store (separate R-band — see companion note)
- AUTH-SESSION cancelled paths

---

## Acceptance (product)

1. After open DM, if kind 0 missing/unreachable, client **retries** metadata fetch with backoff while thread is open / when relays recover.  
2. While unresolved, prefer connection display name or short `npub`/hex preview over raw 64-char title spam; bubble may show “Unknown sender” only during active retry, then resolved name.  
3. When peer has published kind 0 to a shared relay, both sides show human names without manual refresh.
