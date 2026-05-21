# 11 — Feasibility and Modular Safety

1. **Use a feasibility gate for stalled features.**
   - If a feature shows no meaningful progress after **3 substantial iterations** (code + runtime validation), stop patch-debug loops.
   - Switch to constraint analysis: stack limits, relay/protocol behavior, project architecture, and production UX requirements.
   - Produce one of two outcomes only:
     - **New approach** (different owner/contract/flow, not another patch layer), or
     - **Infeasible decision** (explicitly pause/cancel the module goal).

2. **Do not continue development on unresolved infeasible goals.**
   - If the goal cannot be made reliable under current protocol constraints, mark it as blocked/infeasible and stop implementation churn.
   - Record what evidence proved infeasibility and what prerequisite would make it feasible later.

3. **Protect modular integrity while iterating.**
   - Scope each change to one feature owner boundary whenever possible.
   - A fix must not regress unrelated features; if collateral breakage appears, stop and redesign the boundary before proceeding.
   - Prefer adapters/contracts over cross-feature reach-through.

4. **Honor evidence tiers in distributed systems.**
   - Chat acknowledgment, relay observation, and permission/membership confirmation are different truth levels.
   - UI copy and behavior must reflect uncertainty explicitly; never present soft evidence as hard confirmation.

5. **Optimize for project completion, not local patch velocity.**
   - Reject "token/time sink" loops where repeated small fixes do not improve user-visible reliability.
   - Choose architectural moves that reduce future complexity and isolate failure domains.
