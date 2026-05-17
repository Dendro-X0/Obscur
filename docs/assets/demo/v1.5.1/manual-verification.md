# v1.5.1 Manual Verification Checklist

**Status:** Not started — fill after client testing, before tag.

Mark each gate on **Web (PWA)** and **Desktop (Tauri)** after replay.

| # | Scenario | Web | Desktop | Pass criteria |
|---|----------|-----|---------|---------------|
| C1 | Hide single incoming DM | ☐ | ☐ | Row gone; survives refresh |
| C2 | Hide single outgoing DM | ☐ | ☐ | Same |
| C3 | Hide → account restore | ☐ | ☐ | Row still hidden |
| C4 | Show again | ☐ | ☐ | Row returns; no duplicate rows |
| C5 | Batch hide 3 messages | ☐ | ☐ | Copy correct; all hidden |
| C6 | Send/receive smoke | ☐ | ☐ | Unaffected |
| C7 | Community / group thread | ☐ | ☐ | No DM hide regression in group UI |

## Final verdict

- [ ] Manual verification pass accepted for v1.5.1 closeout
- **Tester / date:**
- **Notes:**
