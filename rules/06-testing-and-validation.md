# 06 — Testing and Validation

1. **Validate at the narrowest useful level first.**
   - unit test,
   - focused integration test,
   - typecheck,
   - then runtime/manual instructions.

2. **Every fix in critical paths should leave behind one of:**
   - a new test,
   - a typed contract,
   - a diagnostics surface,
   - or a doc update explaining the gate/risk.

3. **Core communication work is not done without two-user reasoning.**
   - For identity, request, DM, relay, and multi-profile work, always reason about sender and receiver states separately.

**Docs:** encyclopedia **06**, `docs/trust/`
