import { describe, expect, it, vi } from "vitest";
import {
  publishCommunityInviteRelayJoin,
  resolveRelayJoinStatusAfterManualRetry,
  shouldShowInviteRelayJoinRetry,
} from "./community-invite-relay-join";

describe("community-invite-relay-join", () => {
  it("returns joined when either join event publishes", async () => {
    const publish = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const status = await publishCommunityInviteRelayJoin({
      publish,
      nip29JoinJson: '["EVENT",{"id":"a"}]',
      sealedJoinJson: '["EVENT",{"id":"b"}]',
      maxAttempts: 1,
      baseBackoffMs: 1,
    });
    expect(status).toBe("joined");
  });

  it("returns retry_scheduled when both publishes fail", async () => {
    const publish = vi.fn().mockResolvedValue(false);
    const status = await publishCommunityInviteRelayJoin({
      publish,
      nip29JoinJson: '["EVENT",{"id":"a"}]',
      sealedJoinJson: '["EVENT",{"id":"b"}]',
      maxAttempts: 1,
      baseBackoffMs: 1,
    });
    expect(status).toBe("retry_scheduled");
  });

  it("retries transient publish errors and returns joined on later success", async () => {
    const publish = vi.fn()
      .mockRejectedValueOnce(new Error("temporary relay timeout"))
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    const status = await publishCommunityInviteRelayJoin({
      publish,
      nip29JoinJson: '["EVENT",{"id":"a"}]',
      sealedJoinJson: '["EVENT",{"id":"b"}]',
      maxAttempts: 2,
      baseBackoffMs: 1,
    });

    expect(status).toBe("joined");
    expect(publish).toHaveBeenCalledTimes(3);
  });

  it("transitions manual retry to terminal_failed after max attempts", () => {
    const first = resolveRelayJoinStatusAfterManualRetry(false, {
      status: "retry_scheduled",
      manualRetryCount: 0,
      updatedAtUnixMs: 0,
    }, 2);
    expect(first.status).toBe("retry_scheduled");
    expect(first.manualRetryCount).toBe(1);

    const terminal = resolveRelayJoinStatusAfterManualRetry(false, first, 2);
    expect(terminal.status).toBe("terminal_failed");
    expect(terminal.manualRetryCount).toBe(2);
  });

  it("transitions manual retry to joined when publish succeeds", () => {
    const joined = resolveRelayJoinStatusAfterManualRetry(true, {
      status: "retry_scheduled",
      manualRetryCount: 1,
      updatedAtUnixMs: 0,
    }, 2);
    expect(joined.status).toBe("joined");
    expect(joined.manualRetryCount).toBe(2);
  });

  it("shows retry only for accepted inbound invites with retry_scheduled", () => {
    expect(shouldShowInviteRelayJoinRetry("accepted", {
      status: "retry_scheduled",
      manualRetryCount: 0,
      updatedAtUnixMs: 0,
    }, false)).toBe(true);
    expect(shouldShowInviteRelayJoinRetry("accepted", {
      status: "joined",
      manualRetryCount: 0,
      updatedAtUnixMs: 0,
    }, false)).toBe(false);
    expect(shouldShowInviteRelayJoinRetry("accepted", {
      status: "retry_scheduled",
      manualRetryCount: 0,
      updatedAtUnixMs: 0,
    }, true)).toBe(false);
    expect(shouldShowInviteRelayJoinRetry("declined", {
      status: "retry_scheduled",
      manualRetryCount: 0,
      updatedAtUnixMs: 0,
    }, false)).toBe(false);
  });
});
