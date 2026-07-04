import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("REL-004 leave path audit", () => {
  it("GroupProvider.leaveGroup commits only after relayConfirmed in authoritative mode", () => {
    const source = readSource("app/features/groups/providers/group-provider-legacy.tsx");
    const leaveGroupBlock = source.slice(source.indexOf("const leaveGroup = useCallback"));
    expect(leaveGroupBlock).toContain("commitCommunityLeaveAfterRelayConfirmation");
    expect(leaveGroupBlock).toContain("relayConfirmed !== true");
    expect(leaveGroupBlock).toContain("removeGroupConversation");
  });

  it("relay-confirmed leave service publishes before any local commit helper exists", () => {
    const source = readSource("app/features/groups/services/community-relay-confirmed-leave.ts");
    expect(source).toContain("publishRelayConfirmedCommunityLeave");
    expect(source).toContain("sendNip29Leave");
    expect(source).toContain("commitCommunityLeaveAfterRelayConfirmation");
    expect(source.indexOf("publishRelayConfirmedCommunityLeave"))
      .toBeLessThan(source.indexOf("commitCommunityLeaveAfterRelayConfirmation"));
    expect(source).not.toContain("removeGroupConversation");
  });

  it("use-sealed-community leaveGroup delegates to relay-confirmed publish", () => {
    const source = readSource("app/features/groups/hooks/use-sealed-community-legacy.ts");
    expect(source).toContain("publishRelayConfirmedCommunityLeave");
    expect(source).not.toContain("noopAsyncFalse");
  });

  it("leave page blocks local exit until relay confirms in authoritative mode", () => {
    const source = readSource("app/groups/leave/page.tsx");
    expect(source).toContain("isRelayAuthoritativeMembershipEnforced");
    expect(source).toMatch(/leaveNip29Group\(\)[\s\S]*applyLocalLeave\(true\)/);
    expect(source).toContain("Relay rejected leave. You remain a member of this community.");
  });

  it("settings bulk-leave enqueues outbox before ledger leave", () => {
    const source = readSource("app/settings/settings-tab-panel-models/use-settings-destructive-actions-model.ts");
    const block = source.slice(source.indexOf("for (const entry of joinedEntries)"));
    const enqueueAt = block.indexOf("enqueueCommunityLeaveOutboxItem");
    const ledgerAt = block.indexOf("persistExplicitCommunityMembershipLeave");
    expect(enqueueAt).toBeGreaterThan(-1);
    expect(ledgerAt).toBeGreaterThan(-1);
    expect(enqueueAt).toBeLessThan(ledgerAt);
  });
});
