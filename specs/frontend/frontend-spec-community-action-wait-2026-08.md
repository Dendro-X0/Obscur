# Frontend spec: Community action wait (upright)

**Date:** 2026-08-22  
**Owner:** `CommunityActionWaitRing`  
**Backend:** `specs/backend/community-wait-ring-and-delete-hang-design-2026-08.md`

## Layout

- Header: WORKING · title · subtitle (unchanged).
- Hub: 80px dashed ring (may rotate) + inner pulse disc. No labels on rotating nodes.
- Steps: stacked `ol` under the hub, full width, left-aligned copy. Active step: violet border; done: emerald + check.

## Motion

- Rotate **hub ring only**.
- Do not apply `transform: rotate` to step cards or the delete confirmation Card.

## Surfaces

- Create Group overlay (`createWaitPhase`).
- Leave/Delete page while `isLeaving` or `isPurgingLocal`.
