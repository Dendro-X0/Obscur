# Frontend spec — Relay connect warning tone

**Backend:** [relay-connect-error-panel-ux-design-2026-07.md](../backend/relay-connect-error-panel-ux-design-2026-07.md)

## Tone

- Amber / soft warning surface (not vivid destructive red)
- Title: **Relay connection issue** (+ xN if count > 1)
- Body: one short line, e.g. “Couldn't reach relay.primal.net.”
- Technical probe text in collapsed **Details** only
- Retry + dismiss unchanged

## Stacking

At most **one** connect-failure card on screen at a time (store coalesce).
