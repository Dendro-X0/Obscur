# Frontend spec — Mobile thread composer flush (2026-10)

## Surface

Mobile shell / phone-preview DM thread: `Composer` footer + `ChatView` floating chrome + `MobileDmThreadHeader` overflow menu. Desktop messaging column unchanged.

## Problems (from screenshot)

1. Protocol capability chips + composer status strip make the input feel like a desktop glass slab floating above a black footer band.
2. Floating “Search Messages” pill sits on the chip row and fights the input.
3. Dev build stamp (`ExperimentShellIndicator`) overlaps the composer bottom edge in thread mode.
4. Floating overlay offset still budgets for chips + status after those rows are hidden.

## Layout contract (mobile shell / preview thread)

| Region | Behavior |
|--------|----------|
| Composer chrome | `MESSAGING_SHELL_BOTTOM_CHROME_MOBILE_CLASS` — border-t, no glass slab, `pb-composer-safe` only |
| Chips / status | Hidden on mobile product shell (`isMobileShellProduct`) |
| Input capsule | Keep rounded row; reduce outer pad so it reads as a bar, not a floating card |
| History search | Open from thread header ⋮ menu via `CHAT_HISTORY_SEARCH_OPEN_EVENT`; no always-visible floating trigger |
| Floating chrome | Batch-delete / open search panel only; shorter `bottom` offset (~composer height + safe area) |
| Build stamp | In `data-obscur-mobile-chrome=thread`, sit above composer (`~4.5rem` + safe inset), not on the input |

## Desktop / lab

Unchanged: chips, status row, hover-reveal floating search trigger, existing float offset.

## Out of scope

Relay connectivity UX relocation; tab-bar layout; production build-stamp policy.
