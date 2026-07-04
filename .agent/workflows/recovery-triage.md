# Recovery Triage Workflow

Use when a core user flow is broken but logs and tests are not enough.

**Skill:** [obscur-foundation-recovery](../skills/obscur-foundation-recovery/SKILL.md)  
**Pre-diff:** [obscur-session-gate](../skills/obscur-session-gate/SKILL.md)  
**Parallel paths:** [obscur-subtraction-change](../skills/obscur-subtraction-change/SKILL.md)

**Hard stop:** Community / `groups/**` membership patches while handoff marks band **PAUSED** — register and owner documentation only.

## Step 1: Classify the failure

Choose one primary class first:

- identity/session ownership,
- profile/window binding,
- runtime lifecycle ordering,
- relay transport/publish scope,
- inbound event routing/decrypt,
- local persistence/sync checkpointing,
- UI projection only.

Do not start with UI unless transport/runtime causes have been ruled out.

## Step 2: Reduce the path

For the broken user action, write:

1. entry point,
2. canonical service/controller,
3. network publish/receive boundary,
4. persistence boundary,
5. UI projection boundary.

If more than one canonical path appears, apply **subtraction discipline** — that is the bug class until proven otherwise.

## Step 3: Add proof points

Prefer diagnostics that answer:

- who owns this window/profile,
- which pubkey is active,
- which relays were targeted,
- what inbound event was seen,
- whether decrypt/routing succeeded,
- why state did or did not mutate.

## Step 4: Repair in order

1. lifecycle ownership,
2. transport scope,
3. persistence correctness,
4. UI projection.

## Step 5: Leave a handoff

If not fully fixed:

- what changed,
- what remains broken,
- proof commands run vs needed,
- what the next maintainer should inspect first,
- one **next atomic step** in `docs/handoffs/current-session.md`.

## Stuck loop

≥3 failed iterations on the same band → feasibility review only ([rules/11](../../rules/11-feasibility-and-modular-safety.md)). No patch #4 without updated investigation spec.
