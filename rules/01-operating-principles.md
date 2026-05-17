# 01 — Operating Principles

1. **Preserve architectural clarity.**
   - Do not add a second owner for the same lifecycle, state, or transport path.
   - If a responsibility already has multiple owners, reduce them instead of adding another layer.

2. **Prefer explicit contracts over ambient behavior.**
   - Pass `profileId`, `publicKeyHex`, runtime capability, and ownership context explicitly where ambiguity could cause drift.
   - Avoid hidden globals, singleton assumptions, and "current active user/profile" fallbacks in shared code.

3. **Local state is not network truth.**
   - Do not treat sender-local optimistic state as proof of delivery, acceptance, or sync completion.
   - UI success states for requests/messages must require evidence-backed outcomes.

4. **One user action should map to one canonical path.**
   - Especially for auth, request sending, direct messaging, profile publish, and relay recovery.
   - Avoid parallel legacy and modern execution paths mutating the same live state.

5. **Fix by subtraction where possible.**
   - If a bug exists because two systems overlap, remove or quarantine one path instead of compensating in UI.

6. **Release claims must follow runtime truth.**
   - Do not describe a flow as working unless desktop/PWA runtime behavior and tests both support that claim.
