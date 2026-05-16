import { describe, expect, it } from "vitest";
import type { Message } from "../types";
import { applyBatchMessageSelectionToggle } from "./batch-message-selection";

const row = (id: string): Message => ({
  id,
  kind: "user",
  content: id,
  timestamp: new Date(0),
  isOutgoing: false,
  status: "delivered",
});

describe("applyBatchMessageSelectionToggle", () => {
  const messages = ["m1", "m2", "m3", "m4", "m5"].map(row);

  it("toggles a single message and moves the anchor", () => {
    const first = applyBatchMessageSelectionToggle({
      messages,
      currentSelectedIds: new Set(),
      anchorMessageId: null,
      toggle: { messageId: "m2", shiftKey: false },
    });
    expect(Array.from(first.selectedIds)).toEqual(["m2"]);
    expect(first.anchorMessageId).toBe("m2");

    const second = applyBatchMessageSelectionToggle({
      messages,
      currentSelectedIds: first.selectedIds,
      anchorMessageId: first.anchorMessageId,
      toggle: { messageId: "m4", shiftKey: false },
    });
    expect(Array.from(second.selectedIds).sort()).toEqual(["m2", "m4"]);
  });

  it("selects an inclusive vertical range when shift is held", () => {
    const result = applyBatchMessageSelectionToggle({
      messages,
      currentSelectedIds: new Set(["m2"]),
      anchorMessageId: "m2",
      toggle: { messageId: "m5", shiftKey: true },
    });
    expect(Array.from(result.selectedIds)).toEqual(["m2", "m3", "m4", "m5"]);
  });

  it("selects upward when shift-clicking above the anchor", () => {
    const result = applyBatchMessageSelectionToggle({
      messages,
      currentSelectedIds: new Set(["m4"]),
      anchorMessageId: "m4",
      toggle: { messageId: "m1", shiftKey: true },
    });
    expect(Array.from(result.selectedIds)).toEqual(["m1", "m2", "m3", "m4"]);
  });
});
