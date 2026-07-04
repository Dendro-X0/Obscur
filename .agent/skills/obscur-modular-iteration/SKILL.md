---
name: obscur-modular-iteration
description: Obscur large-project iteration discipline. Use when planning features, pausing or re-integrating modules, resolving impasses, or when the user asks to fix/build/improve without a spec. Preserves original functional goals unless cancelled or proven infeasible; silo paused modules; explore components then plan/spec, mental simulation, then implement. Do NOT skip exploration for vague requests like fix this or good UI.
---

# Obscur Modular Iteration

Always-on: `.cursor/rules/obscur-modular-iteration.mdc` · Contract: [modular-iteration-contract.md](../../../docs/program/modular-iteration-contract.md)

Run [obscur-session-gate](../obscur-session-gate/SKILL.md) before any diff.

## Goal rules

1. **Original functional goals stand** until objectively infeasible (rules/11 feasibility) or **explicitly CANCELLED** in handoff.
2. **Temporary reduction** is allowed — document honest UX and scope (e.g. local hide vs global delete).
3. **PAUSED ≠ abandoned** — silo strategy: no churn in the band; redesign inside silo; re-integrate only after integration study.
4. **Modular repo** — integrate via explicit contracts; isolate failed modules; redesign before re-merge.

## Mandatory order (no shortcuts)

| Step | Action | Output |
|------|--------|--------|
| 1. Explore | Read relevant features, registers, truth map — not archive, not whole tree | Named components + owners |
| 2. Reason | Parallel paths? Integration surface? Sender vs receiver? | One-paragraph diagnosis |
| 3. Plan / spec | Investigation (bugs) or design (features) in `specs/backend/` or `docs/program/` | Spec file — **no code yet** |
| 4. Mental simulation | Walk one user action end-to-end; list failure modes and neighbor modules | Integration risks in spec |
| 5. Implement | Smallest spec slice; [obscur-subtraction-change](../obscur-subtraction-change/SKILL.md) if overlapping owners | Diff |
| 6. Proof | Name L1–L4 commands executed | Evidence paths in handoff |

**Vague requests** ("fix communities", "build good UI", "make join work") → phases 1–4 only until spec exists or handoff says PAUSED/study-only.

## Silo / impasse

When band is **PAUSED** or ≥3 failed iterations on same hypothesis:

1. Stop feature patches in the silo.
2. Register symptoms + owners ([community-relay-technical-issues-register](../../../docs/program/community-relay-technical-issues-register-2026-06.md) pattern).
3. Redesign **inside silo** (spec + subtraction).
4. Before re-integration: **integration study** — working neighbors, interface contract, conflict scan, automated proof plan.
5. Un-pause only via handoff charter.

## Integration study checklist

Before wiring a redesigned module back:

- [ ] Working neighbor modules listed
- [ ] Interface contract written (inputs, outputs, `profileId`, proof)
- [ ] Parallel writers grep'd — subtraction plan if needed
- [ ] Automated scenario named (e.g. `verify:com-mem-2`) before manual soak
- [ ] Handoff updated with one next atomic step

## Anti-rationalization

| Agent thought | Response |
|---------------|----------|
| "User said fix it — I'll code now" | Explore + spec first; gate PAUSED bands |
| "Goal is impossible — drop it" | Feasibility doc + maintainer; not agent abandonment |
| "PAUSED means low priority patch OK" | PAUSED = no code in silo |
| "UI fix is faster" | Backend owner first ([obscur-foundation-recovery](../obscur-foundation-recovery/SKILL.md)) |
| "I'll re-integrate and see what breaks" | Integration study before merge |
| "Archive v1.3.15 had working code" | Use git tag `v1.3.15` for history — not docs copy |

## References

- [modular-iteration-contract.md](../../../docs/program/modular-iteration-contract.md)
- [design-goals-and-constraints.md](../../../docs/program/design-goals-and-constraints.md)
- [12-core-architecture-truth-map.md](../../../docs/encyclopedia/12-core-architecture-truth-map.md)
- Global: `backend-rigor` workflow phases 0–2
