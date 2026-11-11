# Design — Cut 1.5 Chat-state demotion (K-CHATSTATE-AUTH)

**Date:** 2026-11-09  
**Status:** **L1 Pass** (desktop L2 soaks optional / owed with 1.6; Soft L3 not claimed)  
**Parent:** [cut1-replacement-authority-design-2026-11-09.md](./cut1-replacement-authority-design-2026-11-09.md) §1.5

```text
HANDOFF ATOMIC STEP: Cut 1.5 K-CHATSTATE-AUTH
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     relationship_edge (CRM) + SQLite messages; chat-state = UI mirror only
PROOF BEFORE DONE:   L1 — import boundary forbids chat-state CRM/message mutations from social/send paths
SURFACE:             Tauri desktop primary; browser degraded
```

## Goal

`chat-state-store-legacy` must not be durable authority for social-graph CRM (`connectionRequests` as TRUSTED/PENDING source of truth) or DM/group message bodies. On native, it is a **UI cache / non-authoritative mirror** (pinned/hidden/unread/sidebar chrome allowed). Soft L3 Fixed is **not** claimed.

## As-built residue (inventory)

| Writer / reader | Path | Status before 1.5 |
|-----------------|------|-------------------|
| Message bodies | `messagingChatStateMessagePort.updateMessages` / `mirrorMessageToChatState` | Already no-op when `isDmKernelChatStateMessageIoSuppressed` |
| Sanitize | `sanitizeChatStateForNativeDmKernelMirror` | Strips messages only — **not** CRM |
| CRM requests | `updateConnectionRequests` via `use-requests-inbox` | **Still writes** chat-state as request/CRM mirror |
| Sticky trust | `usePeerTrust` + `relationship_edge` | Cut 1.1 owns kernel; chat-state hydrate already skipped on native |
| Direct store | `chatStateStoreService` from protocol-adaptation / dm-send | Already absent (good) |

## Deliver

1. **CRM suppress predicate** — `isChatStateCrmIoSuppressed()` ≡ native SQLite + Tauri (same surface as `usesKernelRelationshipAuthority`).
2. **Sanitize** — when CRM suppressed, strip `connectionRequests` from chat-state mirror writes/reads (alongside existing message strip).
3. **Quarantine writer** — `messagingChatStateMessagePort.updateConnectionRequests` no-ops when CRM suppressed.
4. **Import boundary (L1)** — social sticky-trust + protocol send paths must not import `chat-state-store-legacy` or call store-level CRM/message mutators; message-port CRM/message mutators must stay gated.
5. Vitest owner-uniqueness + policy unit coverage.

## Allowed after demotion (UI cache)

- `updatePinnedChats` / `updateHiddenChats` / `updateUnreadCounts` / `updateConnectionOverrides`
- `updateConnections` (sidebar conversation chrome — not sticky TRUSTED)
- Groups metadata via existing ports (not message bodies on native)

## Non-goals

- Soft L3 Fixed · deleting chat-state file entirely · Cut 1.6 lab checklist · Vite UI migrate · Tor/Matrix promote

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | vitest Cut 1.5 owner-uniqueness + dm-kernel-chat-state-io-policy |
| L2 | optional — restart sticky trust / messages already owed under 1.1–1.4 |
| Soft L3 | **paused** — do not claim |

## Cutover law (this slice)

```text
1. Kernel already owns CRM + messages (1.1–1.2).
2. Readers already prefer kernel (1.1 hydrate skip).
3. Subtract chat-state CRM/message authority writers (gate + sanitize).
4. No dual-write forever — LS connectionRequests not sticky CRM on native.
```
