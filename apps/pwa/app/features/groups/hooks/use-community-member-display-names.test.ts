import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useCommunityMemberDisplayNames } from "./use-community-member-display-names";

const PK = "aa".repeat(32) as PublicKeyHex;

describe("useCommunityMemberDisplayNames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("issues scoped kind-0 REQ and CLOSE on dialog lifecycle (Path B B2-3)", () => {
    const sendToOpen = vi.fn();
    const unsubscribe = vi.fn();
    const subscribeToMessages = vi.fn(() => unsubscribe);
    const pool = { sendToOpen, subscribeToMessages };

    const { unmount } = renderHook(() => useCommunityMemberDisplayNames({
      enabled: true,
      memberPubkeys: [PK],
      pool,
    }));

    expect(subscribeToMessages).toHaveBeenCalledTimes(1);
    expect(sendToOpen).toHaveBeenCalledTimes(1);
    const reqPayload = JSON.parse(sendToOpen.mock.calls[0]![0] as string) as unknown[];
    expect(reqPayload[0]).toBe("REQ");
    expect((reqPayload[2] as { kinds: number[] }).kinds).toEqual([0]);
    expect((reqPayload[2] as { authors: string[] }).authors).toEqual([PK]);

    unmount();

    expect(sendToOpen).toHaveBeenCalledTimes(2);
    const closePayload = JSON.parse(sendToOpen.mock.calls[1]![0] as string) as unknown[];
    expect(closePayload[0]).toBe("CLOSE");
    expect(closePayload[1]).toBe(reqPayload[1]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when disabled or member list is empty", () => {
    const sendToOpen = vi.fn();
    const subscribeToMessages = vi.fn(() => vi.fn());
    const pool = { sendToOpen, subscribeToMessages };

    renderHook(() => useCommunityMemberDisplayNames({
      enabled: false,
      memberPubkeys: [PK],
      pool,
    }));
    renderHook(() => useCommunityMemberDisplayNames({
      enabled: true,
      memberPubkeys: [],
      pool,
    }));

    expect(subscribeToMessages).not.toHaveBeenCalled();
    expect(sendToOpen).not.toHaveBeenCalled();
  });
});
