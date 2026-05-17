# 05 — Auth and Identity

1. **Import/create/unlock should succeed locally first.**
   - Relay/account-sync work may enrich the session later but must not redefine the local success decision.

2. **Remember-me and native session restore must reflect actual ownership.**
   - Never show a stale authenticated identity chip when the runtime is locked or auth-required.

3. **Identity mismatches should surface explicitly.**
   - If stored identity, native session, and bound profile disagree, fail visibly instead of silently switching.
