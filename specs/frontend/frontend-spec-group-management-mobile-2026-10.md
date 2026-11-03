# Frontend spec — Group management mobile polish (2026-10)

## Surface

Community **Manage** sheet (`GroupManagementShell` + General panel) on phone preview / mobile shell.

## Problems (from screenshot)

1. Raw keys `groups.manage.convert.*` (missing locale strings).
2. Privacy mode icons (Open / Listed / Invite only) too small for the cards.
3. Save / Cancel visually collide with the app tab bar (fixed layer trapped under a transformed ancestor).
4. App chrome (hamburger) peeks through the sheet.

## Layout contract (compact)

| Region | Behavior |
|--------|----------|
| Overlay | Portal to `document.body`, `z-[10100]`, full viewport (`inset-0`) |
| Header | Community title + close; no app hamburger |
| Tabs | Horizontal scroll; icons `h-5` |
| Body | Scroll; bottom padding clears sticky footer |
| Footer | Sticky; `safe-area-inset-bottom`; Cancel + Save full-width row |

## Privacy chips (compact)

- Icons `h-6 w-6`, card `py-3`, label remains short (Open / Listed / Invite only).

## i18n

Add full `groups.manage.convert.*` set in en + zh/es/fr/de; regenerate chunks.

## Out of scope

Desktop modal layout; governance/members tab content redesign.
