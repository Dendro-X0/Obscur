# Recovery Triage Workflow

Use this workflow when a core user flow is broken but logs and tests are not enough.

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

If more than one canonical path appears, that is the bug class until proven otherwise.

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

If not fully fixed, write:

- what changed,
- what remains broken,
- what the next maintainer should inspect first.

