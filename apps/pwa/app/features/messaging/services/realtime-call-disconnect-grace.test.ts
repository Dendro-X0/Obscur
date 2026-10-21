import { describe, expect, it } from "vitest";
import {
  REALTIME_CALL_DISCONNECT_GRACE_MS,
  resolveRealtimeCallConnectionStateAction,
  shouldEndCallAfterDisconnectGrace,
} from "./realtime-call-disconnect-grace";

describe("realtime-call-disconnect-grace", () => {
  it("starts one grace window on disconnected and ignores repeats", () => {
    expect(REALTIME_CALL_DISCONNECT_GRACE_MS).toBe(4_000);
    expect(resolveRealtimeCallConnectionStateAction({
      connectionState: "disconnected",
      gracePending: false,
    })).toBe("start_grace");
    expect(resolveRealtimeCallConnectionStateAction({
      connectionState: "disconnected",
      gracePending: true,
    })).toBe("ignore");
  });

  it("cancels grace when the peer connection recovers", () => {
    expect(resolveRealtimeCallConnectionStateAction({
      connectionState: "connected",
      gracePending: true,
    })).toBe("cancel_grace");
    expect(resolveRealtimeCallConnectionStateAction({
      connectionState: "connecting",
      gracePending: true,
    })).toBe("cancel_grace");
    expect(resolveRealtimeCallConnectionStateAction({
      connectionState: "connected",
      gracePending: false,
    })).toBe("ignore");
  });

  it("ends immediately on failed even if a grace timer is pending", () => {
    expect(resolveRealtimeCallConnectionStateAction({
      connectionState: "failed",
      gracePending: true,
    })).toBe("end_interrupted");
    expect(resolveRealtimeCallConnectionStateAction({
      connectionState: "closed",
      gracePending: true,
    })).toBe("ignore");
  });

  it("ends after grace only while still disconnected or failed", () => {
    expect(shouldEndCallAfterDisconnectGrace("disconnected")).toBe(true);
    expect(shouldEndCallAfterDisconnectGrace("failed")).toBe(true);
    expect(shouldEndCallAfterDisconnectGrace("connected")).toBe(false);
    expect(shouldEndCallAfterDisconnectGrace("connecting")).toBe(false);
  });
});