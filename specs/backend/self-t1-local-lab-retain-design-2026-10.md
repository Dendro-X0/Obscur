# Design — Self T1 operator-retained local lab dial

**Date (UTC):** 2026-10-13  
**Status:** Implemented · L1 green (2026-10-13) · await operator L3  
**Investigation:** [self-t1-local-lab-retain-investigation-2026-10.md](./self-t1-local-lab-retain-investigation-2026-10.md)  
**Amends:** [relay-local-lab-adaptive-demote-design-2026-08.md](./relay-local-lab-adaptive-demote-design-2026-08.md) (average-user demote unchanged)

```text
NEXT ATOMIC STEP:     retainLabUrl exemption in lab demote + wire from operator workspace URL
PAUSED / CANCELLED:   Shell lag · M1–M3 · dialects · ASE-2 · SF-B · NIM code until P0 · PB1-B/C/D eng honesty
CANONICAL OWNER:      relay-local-lab-adapt · relay-primary-selector · relay-provider
PROOF BEFORE DONE:    L1 vitest adapt + selector (retain cases) · no L2 soak
SURFACE:              n/a automated · operator manual: Enable/Save localhost + remotes → pool contains lab
```

---

## Product rules

| Actor | Remotes enabled | Local lab in dial pool | Primary |
|-------|-----------------|------------------------|---------|
| Average user (no operator workspace lab) | Yes | **No** (unchanged Nostr-first) | Remote |
| Soft L3 only (no remotes) | No | Yes | Lab OK |
| Self T1 / operator: `readOperatorWorkspaceRelayUrl()` matches lab | Yes | **Yes** (retain) | Still **remote** when remotes live |

`http://127.0.0.1:8788` mesh assist is never retainable via this slice (NIM operator note: do not add as relay). Retain applies only when the operator workspace URL is a local **WS** lab (`isLocalDevWorkspaceRelayUrl`).

---

## Contract

### `shouldDemoteLocalLabFromActivePool`

Add optional `retainLabUrl?: string | null`.

| Condition | Demote |
|-----------|--------|
| `remotesEnabled === false` | No |
| URL not local lab assist | No |
| Lab + remotes + `workspaceRelayUrlsMatch(localUrl, retainLabUrl)` and retain is local WS lab | **No** |
| Lab + remotes + no retain match | **Yes** |

### Primary (separate)

`shouldAvoidLocalLabAsPrimary({ localUrl, remotesEnabled })` → true when remotes enabled and URL is local WS lab — **ignore retain**. Wire into `reconcilePrimarySelection` / initial primary pick so retained lab never owns DM primary while remotes are enabled.

### Pool

`filterDemotedLocalLabUrls` + `resolveActivePoolRelayUrls` accept `retainLabUrl`. Provider passes `readOperatorWorkspaceRelayUrl()` when it is a local WS lab URL.

### Bootstrap

Existing list exemption for operator workspace URL stays. No change required for Self T1 Save path beyond dial retain.

---

## Files

- `relay-local-lab-adapt.ts` + `.test.ts`
- `relay-primary-selector.ts` + `.test.ts` (retain: pool contains lab; primary still remote)
- `relay-provider.tsx` — pass `retainLabUrl`
- Amend note on 2026-08 demote design (pointer)

---

## Proof

- **L1:** vitest green for adapt + selector retain cases  
- **L3 (operator):** Tor OFF · Docker `:7000` · Operator Setup Save `ws://localhost:7000` · public remotes enabled → Relays shows lab in active pool / open socket · primary remains a public host when healthy
