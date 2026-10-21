import { describe, expect, it, vi } from "vitest";
import {
  isHaveLocalOfferInvalidState,
  runHostOfferDispatchCoalesced,
  type HostOfferInFlightMap,
} from "./voice-call-host-offer-coalesce";

describe("runHostOfferDispatchCoalesced", () => {
  it("runs dispatch once when two callers race the same room", async () => {
    const inFlight: HostOfferInFlightMap = new Map();
    const dispatch = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });
      return true;
    });
    const [a, b] = await Promise.all([
      runHostOfferDispatchCoalesced({ roomId: "room-1", inFlight, dispatch }),
      runHostOfferDispatchCoalesced({ roomId: "room-1", inFlight, dispatch }),
    ]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(inFlight.size).toBe(0);
  });

  it("allows a second dispatch after the first settles", async () => {
    const inFlight: HostOfferInFlightMap = new Map();
    const dispatch = vi.fn(async () => true);
    await runHostOfferDispatchCoalesced({ roomId: "room-1", inFlight, dispatch });
    await runHostOfferDispatchCoalesced({ roomId: "room-1", inFlight, dispatch });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});

describe("isHaveLocalOfferInvalidState", () => {
  it("detects InvalidState / have-local-offer messages", () => {
    expect(isHaveLocalOfferInvalidState("InvalidStateError: Failed to execute 'setLocalDescription'")).toBe(true);
    expect(isHaveLocalOfferInvalidState("Failed to set local answer sdp: Called in wrong state: have-local-offer")).toBe(true);
    expect(isHaveLocalOfferInvalidState("network timeout")).toBe(false);
  });
});
