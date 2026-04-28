import { describe, expect, it } from "vitest";
import { useChatActionsInternals } from "./use-chat-actions";

describe("use-chat-actions upload concurrency", () => {
  it("uses a bounded attachment upload concurrency", () => {
    expect(useChatActionsInternals.resolveAttachmentUploadConcurrency(0)).toBe(1);
    expect(useChatActionsInternals.resolveAttachmentUploadConcurrency(1)).toBe(1);
    expect(useChatActionsInternals.resolveAttachmentUploadConcurrency(2)).toBe(2);
    expect(useChatActionsInternals.resolveAttachmentUploadConcurrency(3)).toBe(3);
    expect(useChatActionsInternals.resolveAttachmentUploadConcurrency(7)).toBe(3);
  });

  it("runs all tasks while respecting the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const order: number[] = [];

    const tasks = Array.from({ length: 5 }, (_, index) => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push(index);
      active -= 1;
      return index;
    });

    const results = await useChatActionsInternals.runWithConcurrencyLimit(tasks, 2);

    expect(peak).toBeLessThanOrEqual(2);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(order).toHaveLength(5);
  });
});
