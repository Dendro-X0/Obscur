import { beforeEach, describe, expect, it, vi } from "vitest";
import { relayTransportJournal } from "./relay-transport-journal";

describe("relayTransportJournal", () => {
  beforeEach(() => {
    relayTransportJournal.resetForTests();
  });

  it("tracks subscription state and pending outbound totals", () => {
    relayTransportJournal.setSubscriptionState({
      desiredSubscriptionCount: 4,
      pendingSubscriptionBatchCount: 2,
    });
    relayTransportJournal.setPendingOutbound("profile_transport_queue:default", 3);
    relayTransportJournal.setPendingOutbound("contact_request_outbox", 2);

    const snapshot = relayTransportJournal.getSnapshot();
    expect(snapshot.desiredSubscriptionCount).toBe(4);
    expect(snapshot.pendingSubscriptionBatchCount).toBe(2);
    expect(snapshot.pendingOutboundCount).toBe(5);
    expect(snapshot.pendingOutboundBySource).toEqual({
      "profile_transport_queue:default": 3,
      "contact_request_outbox": 2,
    });
  });

  it("tracks replay attempt and result metadata", () => {
    relayTransportJournal.markSubscriptionReplayAttempt({
      reasonCode: "manual",
      detail: "active=2",
    });
    relayTransportJournal.markSubscriptionReplayResult({
      result: "ok",
      detail: "sent=2;skipped_empty=0",
    });

    const snapshot = relayTransportJournal.getSnapshot();
    expect(snapshot.lastSubscriptionReplayReasonCode).toBe("manual");
    expect(snapshot.lastSubscriptionReplayResult).toBe("ok");
    expect(snapshot.lastSubscriptionReplayDetail).toContain("sent=2");
    expect(typeof snapshot.lastSubscriptionReplayAttemptAtUnixMs).toBe("number");
    expect(typeof snapshot.lastSubscriptionReplayResultAtUnixMs).toBe("number");
  });

  it("notifies subscribers on updates", () => {
    const listener = vi.fn();
    const unsubscribe = relayTransportJournal.subscribe(listener);

    relayTransportJournal.setPendingOutbound("profile_transport_queue:default", 1);
    relayTransportJournal.clearPendingOutbound("profile_transport_queue:default");
    unsubscribe();
    relayTransportJournal.setPendingOutbound("profile_transport_queue:default", 1);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
