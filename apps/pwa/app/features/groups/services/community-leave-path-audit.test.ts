import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("REL-004 leave path audit", () => {
  it("GroupProvider.leaveGroup enqueues outbox before persisting chat-state only", () => {
    const source = readSource("app/features/groups/providers/group-provider.tsx");
    const leaveGroupBlock = source.slice(source.indexOf("const leaveGroup = useCallback"));
    expect(leaveGroupBlock).toContain("applyCoordinatorExplicitLeave");
    expect(leaveGroupBlock.indexOf("enqueueCommunityLeaveOutboxItem")).toBeGreaterThan(-1);
    expect(leaveGroupBlock.indexOf("applyCoordinatorExplicitLeave"))
      .toBeLessThan(leaveGroupBlock.indexOf("enqueueCommunityLeaveOutboxItem"));
  });

  it("removeGroupConversation enqueues outbox when a matched group is removed", () => {
    const source = readSource("app/features/groups/providers/group-provider.tsx");
    const block = source.slice(source.indexOf("const removeGroupConversation = useCallback"));
    expect(block).toContain("enqueueCommunityLeaveOutboxItem");
    expect(block).toContain("applyCoordinatorExplicitLeave");
  });

  it("sealed leave enqueues outbox before relay publish", () => {
    const source = readSource("app/features/groups/hooks/use-sealed-community.ts");
    const block = source.slice(source.indexOf("const leaveGroup = useCallback"));
    const enqueueAt = block.indexOf("enqueueCommunityLeaveOutboxItem");
    const publishAt = block.indexOf("sendNip29Leave");
    expect(enqueueAt).toBeGreaterThan(-1);
    expect(publishAt).toBeGreaterThan(-1);
    expect(enqueueAt).toBeLessThan(publishAt);
  });

  it("settings bulk-leave enqueues outbox before ledger leave", () => {
    const source = readSource("app/settings/settings-tab-panel-model-provider.tsx");
    const block = source.slice(source.indexOf("for (const entry of joinedEntries)"));
    const enqueueAt = block.indexOf("enqueueCommunityLeaveOutboxItem");
    const ledgerAt = block.indexOf("persistExplicitCommunityMembershipLeave");
    expect(enqueueAt).toBeGreaterThan(-1);
    expect(ledgerAt).toBeGreaterThan(-1);
    expect(enqueueAt).toBeLessThan(ledgerAt);
  });
});
