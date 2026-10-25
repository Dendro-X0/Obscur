# Frontend spec — Profile picker carousel (mobile)

**Status:** approved for implement  
**Surface:** `/profiles` picker (`ProfilePickerCardGrid`) on mobile shell / phone preview  
**API:** none (layout-only; existing launch/switch/remove handlers)

## Goal

Replace the narrow vertical stack of profile tiles with a **horizontal snap carousel** so one profile is the focus and neighbors peek — fits phone width without a long scroll of identical cards.

## Layout

| Breakpoint / shell | Layout |
|--------------------|--------|
| Mobile shell **or** `__OBSCUR_MOBILE_PREVIEW__` **or** viewport `≤640px` | Horizontal snap carousel: one primary card (~70vw), peek of neighbors, scroll-snap, animated dots |
| Wide desktop without the above | Keep current wrap grid |

## Motion

- Active slide: scale 1, opacity 1; neighbors: scale 0.9, opacity 0.55, slight `y`
- Spring (`stiffness` 380 / `damping` 32); press: `whileTap` scale 0.97
- Dot width expands for the active index

## Interaction

- Tap card → existing primary launch
- Overflow menu unchanged
- Add tile is last carousel slide (same dashed Add card)
- Swipe / trackpad / arrow keys move slides; dots jump to index
- `aria-roledescription="carousel"` + live slide label

## Copy

- Mobile subtitle: profiles are isolated accounts on this device (not “desktop windows”)
- Desktop subtitle unchanged

## Out of scope

- Title bar / window chrome
- Keychain isolation for preview
- Advanced management / show-on-startup footer placement beyond fitting under carousel
