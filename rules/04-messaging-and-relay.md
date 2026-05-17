# 04 — Messaging and Relay

1. **Treat transport as a system, not a widget.**
   - Request send/receive bugs are usually transport, identity, or lifecycle bugs before they are UI bugs.

2. **Request transport must converge on recipient evidence.**
   - Sender-local pending is provisional.
   - Receipt ACK, accept, or confirmed relay evidence are the durable state transitions.

3. **Publish scope must be explicit.**
   - Recipient relay resolution must flow into the actual publish contract.
   - Do not rely on side effects on a shared relay pool to imply target scope.

4. **Incoming routing must be diagnosable.**
   - For request/DM receive paths, capture:
     - subscription ownership,
     - recipient filter,
     - decrypt result,
     - routing result,
     - final state mutation.

5. **Unsupported runtime paths must fail deterministically.**
   - Do not silently degrade into optimistic success when publish evidence is unavailable.

**Docs shelf:** `docs/messaging/`, `docs/relay/`, encyclopedia **04** and **13**.
