# Investigation — Trust notice false positives on casual chat (off-platform)

**Date (UTC):** 2026-08-21  
**Status:** Findings → design  
**Evidence:** Maintainer screenshot — accepted peer **Tester2**, Standard sensitivity, banner *“This contact tries to move you off Obscur…”* during casual Segment H chat

---

```text
HANDOFF ATOMIC STEP: none — greenfield / demo Segment H pivot
PAUSED / CANCELLED:  dialect research · Tor Verified (not this band)
CANONICAL OWNER:     dm-kernel-trust-assessment-port · dm-kernel-trust-social-engineering-signals
PROOF BEFORE DONE:   L1 assessment + SE signal tests · corpus fixtures updated
OUT OF SCOPE:        LLM / server NLP · blocking delivery · ASE L2–L4 action gates
```

---

## Symptom

Recipient-local ASE banner shows **elevated** “Trust notice” on an **accepted** contact after ordinary chat. Product feel: redundant, annoying; module looks broken.

Maintainer judgment: deterministic regex cannot do live LLM intent; current module over-fires.

## Root cause

| Layer | Problem |
|-------|---------|
| **Patterns** | `OFF_PLATFORM_REDIRECT_PATTERNS` includes bare `(telegram\|whatsapp\|…).*(dm\|chat\|message\|group\|channel)` and Spanish `(en\|por)\s+(telegram\|…)` — matches casual mentions, not only redirect intent. |
| **Composition** | `thread.off_platform_redirect` is in `SE_STANDALONE_SIGNALS` → **elevated** even when peer is accepted and not cold — contradicts design §5.1 (“SE without cold → usually **info**”). |
| **Architecture** | Non-AI by contract (`trust-non-ai-intelligence-*`); fix is **tighter patterns + weak-signal policy**, not an LLM. |

## Prior art

[trust-non-ai-intelligence-investigation-2026-07.md](./trust-non-ai-intelligence-investigation-2026-07.md) already fixed `msg.rate` FP (accepted → info). Same composition principle applies to weak off-platform.

## Fix direction

See [trust-off-platform-false-positive-design-2026-08.md](./trust-off-platform-false-positive-design-2026-08.md).
