# 22 Theme Contrast Guidelines

_Last reviewed: 2026-03-22 (baseline commit 3938654)._

This document defines the baseline visual-contrast contract for both light and dark themes.

## Goal

- Keep UI readable in both themes without relying on parent text inheritance.
- Preserve global gradient identity while guaranteeing legible text, icon, and control contrast.
- Prevent regressions where cards inside colored bubbles become unreadable in light mode.

## Canonical Tokens

Defined in `apps/pwa/app/globals.css`:

- `--gradient-surface-contrast`
- `--surface-contrast-text-primary`
- `--surface-contrast-text-secondary`
- `--surface-contrast-border`

Utility classes:

- `.bg-gradient-surface-contrast`
- `.text-surface-contrast-primary`
- `.text-surface-contrast-secondary`
- `.border-surface-contrast`

## Required Rules

1. Any card rendered inside message bubbles must set explicit text colors.
2. Do not use `text-current` for primary content on cards embedded in outgoing bubbles.
3. For gradient cards, always pair:
   - `bg-gradient-surface-contrast`
   - `text-surface-contrast-primary`
   - `border-surface-contrast`
4. Secondary labels should use `text-surface-contrast-secondary`, not opacity-only white/black text.
5. Interactive controls (buttons/inputs/chips) must keep visible border + foreground in both themes.

## Applied References

- Community invite card:
  - `apps/pwa/app/features/groups/components/community-invite-card.tsx`
- Voice note card:
  - `apps/pwa/app/features/messaging/components/voice-note-card.tsx`
- Global theme tokens:
  - `apps/pwa/app/globals.css`
