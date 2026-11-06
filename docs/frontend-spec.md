# Frontend spec — Identity link chip + connection profile chrome (2026-11-06)

## Surfaces

1. Settings → Profile → **Copy identity link** (ghost text control)
2. Network → Connection profile hero card + **Connect** CTA + Public Identity card

## Goals

- Clear control boundary: bordered chip, no soft “floating text pill.”
- Connect CTA: solid indigo fill, tight shadow (no wide purple bloom).
- Cards: readable `border` + restrained elevation vs pure glow blobs.

## Non-goals

New layout, light theme redesign, changing Connect lifecycle copy.

## Tokens

Reuse existing zinc/indigo borders; avoid new purple glow utilities.
