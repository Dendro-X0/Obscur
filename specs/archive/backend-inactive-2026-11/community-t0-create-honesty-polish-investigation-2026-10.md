# Investigation — CU-UX-2b T0 create honesty polish

**Date (UTC):** 2026-10-20  
**Charter:** [community-dual-tier-ux-charter-2026-08.md](../../docs/program/community-dual-tier-ux-charter-2026-08.md)  
**Parent design:** [community-dual-tier-ux-design-2026-08.md](./community-dual-tier-ux-design-2026-08.md)

---

## 1. What already landed (CU-UX-2)

- Create dialog defaults to Quick group (`sovereign_room`).
- Public Quiet hosts allowed via `assessQuickGroupCreate` + mandatory ack checkbox when `isPublicQuietHost`.
- Amber honesty panel (`create-group-public-relay-honesty`) lists delete / directory / roster limits.
- Team tier still blocked on public defaults via managed gates.

## 2. Gaps vs charter / design

| Expectation | Observed |
|-------------|----------|
| Default T0 screen: no guarantee tag clouds, no relay-baseline essays | Still rendered for Quick path (~relay baseline card + mode/guarantee pills) |
| User-facing “Public relays” / Quick copy on create | Tier uses Public keys; mode card still surfaces “Sovereign Room” i18n |
| Descriptor `hostingTier: "public_quiet"` | **Missing** — no `hostingTier` in types, create payload, or descriptor contracts |
| Ack must not carry across host changes | Ack resets on tier→Quick only; Quiet→Quiet host swap keeps prior ack |

## 3. Blast radius (read-only)

- UI: `apps/pwa/app/features/groups/components/create-group-dialog.tsx`
- Policy: `community-quick-group-create.ts`
- Persist: `global-dialog-manager.tsx` create metadata + `GroupConversation`
- Types: `GroupMetadata`, messaging `GroupConversation`, `community-descriptor-contracts.ts`

## 4. Non-goals (this investigation)

- CU-UX-3 Operator one-click
- App-wide rename of “Sovereign Room”
- L3 two-profile Quiet soak (follow-up)

## 5. Verdict

Ship **CU-UX-2b**: subtract T0 clutter, reset ack on host change, persist additive `hostingTier`. Wire `communityMode` stays `sovereign_room`.
