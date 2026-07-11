import { describe, expect, it } from "vitest";
import {
  resolveConnectionReceiveLifecycleTag,
  resolveContactRequestReceiveRoute,
  shouldAcceptSandboxQna,
  shouldBlockUntaggedStrangerDm,
} from "./contact-request-receive-classifier";

describe("contact-request-receive-classifier", () => {
  it("classifies connection-request and connection-qna lifecycle tags", () => {
    expect(resolveConnectionReceiveLifecycleTag([["t", "connection-request"]])).toBe("connection-request");
    expect(resolveConnectionReceiveLifecycleTag([["t", "connection-qna"]])).toBe("connection-qna");
    expect(resolveContactRequestReceiveRoute({ tags: [["t", "connection-qna"]] })).toEqual({
      kind: "sandbox_message",
      lifecycleTag: "connection-qna",
    });
  });

  it("classifies lifecycle terminal tags", () => {
    expect(resolveContactRequestReceiveRoute({ tags: [["t", "connection-accept"], ["e", "req-id"]] })).toEqual({
      kind: "lifecycle",
      lifecycleTag: "connection-accept",
    });
    expect(resolveContactRequestReceiveRoute({ tags: [["t", "connection-decline"]] })).toEqual({
      kind: "lifecycle",
      lifecycleTag: "connection-decline",
    });
  });

  it("blocks untagged stranger DMs offline", () => {
    expect(shouldBlockUntaggedStrangerDm({
      isSelfAuthored: false,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
    })).toBe(true);
    expect(shouldBlockUntaggedStrangerDm({
      isSelfAuthored: false,
      isPeerAcceptedByTrust: false,
      requestStatus: { status: "pending", isOutgoing: true },
    })).toBe(true);
    expect(shouldBlockUntaggedStrangerDm({
      isSelfAuthored: false,
      isPeerAcceptedByTrust: true,
      requestStatus: null,
    })).toBe(false);
    expect(shouldBlockUntaggedStrangerDm({
      isSelfAuthored: true,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
    })).toBe(false);
  });

  it("accepts sandbox Q&A only while pending (or self echo)", () => {
    expect(shouldAcceptSandboxQna({
      lifecycleTag: "connection-qna",
      isSelfAuthored: false,
      requestStatus: { status: "pending", isOutgoing: false },
    })).toBe(true);
    expect(shouldAcceptSandboxQna({
      lifecycleTag: "connection-qna",
      isSelfAuthored: false,
      requestStatus: { status: "accepted", isOutgoing: false },
    })).toBe(false);
    expect(shouldAcceptSandboxQna({
      lifecycleTag: "connection-qna",
      isSelfAuthored: true,
      requestStatus: null,
    })).toBe(true);
  });
});
