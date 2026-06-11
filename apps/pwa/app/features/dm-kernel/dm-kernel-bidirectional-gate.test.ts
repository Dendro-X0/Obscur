import { describe, expect, it } from "vitest";
import { evaluateDmKernelBidirectionalSnapshots } from "./dm-kernel-bidirectional-gate";

describe("dm-kernel bidirectional gate", () => {
  const peer = "bb".repeat(32);

  it("skips when thread is empty", () => {
    const result = evaluateDmKernelBidirectionalSnapshots(peer, []);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_sqlite_thread");
  });

  it("fails one-sided threads with messages", () => {
    const result = evaluateDmKernelBidirectionalSnapshots(peer, [
      { id: "1", content: "a", isOutgoing: true, status: "delivered" },
      { id: "2", content: "b", isOutgoing: true, status: "delivered" },
    ]);
    expect(result.skipped).toBe(false);
    expect(result.bidirectional).toBe(false);
    expect(result.reason).toBe("one_sided_thread");
  });

  it("passes bidirectional threads", () => {
    const result = evaluateDmKernelBidirectionalSnapshots(peer, [
      { id: "1", content: "out", isOutgoing: true, status: "delivered" },
      { id: "2", content: "in", isOutgoing: false, status: "delivered" },
    ]);
    expect(result.bidirectional).toBe(true);
    expect(result.reason).toBe("bidirectional_ok");
  });
});
