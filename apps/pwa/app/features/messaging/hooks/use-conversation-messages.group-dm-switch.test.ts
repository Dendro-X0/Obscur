import { describe, expect, it } from "vitest";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";

/**
 * Regression: group thread ids must not participate in DM hydrate ref tracking.
 * Full UI flow is covered by Playwright dev-g6-4-group-dm-switch.spec.ts.
 */
describe("useConversationMessages group/DM isolation", () => {
  it("treats community conversation ids as non-DM threads", () => {
    expect(isGroupConversationId("community:v2_abc")).toBe(true);
    expect(isGroupConversationId("dm-thread-1")).toBe(false);
  });
});
