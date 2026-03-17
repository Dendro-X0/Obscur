import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountEvent } from "../account-event-contracts";

const mocks = vi.hoisted(() => ({
  appendAccountEvents: vi.fn(),
  loadEvents: vi.fn(),
  replayAccountEvents: vi.fn(),
  logAppEvent: vi.fn(),
}));

vi.mock("./account-event-store", () => ({
  accountEventStore: {
    appendAccountEvents: mocks.appendAccountEvents,
    loadEvents: mocks.loadEvents,
  },
}));

vi.mock("./account-event-reducer", () => ({
  replayAccountEvents: mocks.replayAccountEvents,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: mocks.logAppEvent,
}));

import { accountProjectionRuntime } from "./account-projection-runtime";

const PROFILE_ID = "default";
const ACCOUNT_PUBKEY = "a".repeat(64) as PublicKeyHex;

const makeEvent = (): AccountEvent => ({
  type: "CONTACT_ACCEPTED",
  eventId: "evt-1",
  profileId: PROFILE_ID,
  accountPublicKeyHex: ACCOUNT_PUBKEY,
  source: "legacy_bridge",
  observedAtUnixMs: Date.now(),
  idempotencyKey: "idemp-1",
  peerPublicKeyHex: "b".repeat(64) as PublicKeyHex,
  direction: "incoming",
});

describe("accountProjectionRuntime.appendCanonicalEvents", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    accountProjectionRuntime.reset();
    mocks.loadEvents.mockResolvedValue([]);
    mocks.replayAccountEvents.mockReturnValue(null);
    await accountProjectionRuntime.replay({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
    });
  });

  it("skips replay for dedupe-only appends", async () => {
    mocks.appendAccountEvents.mockResolvedValue({
      appendedCount: 0,
      dedupeCount: 1,
      lastSequence: 5,
    });
    const replaySpy = vi.spyOn(accountProjectionRuntime, "replay").mockResolvedValue(
      accountProjectionRuntime.getSnapshot()
    );

    await accountProjectionRuntime.appendCanonicalEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
      events: [makeEvent()],
    });

    expect(replaySpy).not.toHaveBeenCalled();
  });

  it("replays when new canonical events are appended", async () => {
    mocks.appendAccountEvents.mockResolvedValue({
      appendedCount: 1,
      dedupeCount: 0,
      lastSequence: 6,
    });
    const replaySpy = vi.spyOn(accountProjectionRuntime, "replay").mockResolvedValue(
      accountProjectionRuntime.getSnapshot()
    );

    await accountProjectionRuntime.appendCanonicalEvents({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
      events: [makeEvent()],
    });

    expect(replaySpy).toHaveBeenCalledTimes(1);
    expect(replaySpy).toHaveBeenCalledWith({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
    });
  });

  it("coalesces concurrent append-triggered replays for the same account", async () => {
    mocks.appendAccountEvents.mockResolvedValue({
      appendedCount: 1,
      dedupeCount: 0,
      lastSequence: 7,
    });
    const replaySpy = vi.spyOn(accountProjectionRuntime, "replay").mockResolvedValue(
      accountProjectionRuntime.getSnapshot()
    );

    await Promise.all([
      accountProjectionRuntime.appendCanonicalEvents({
        profileId: PROFILE_ID,
        accountPublicKeyHex: ACCOUNT_PUBKEY,
        events: [makeEvent()],
      }),
      accountProjectionRuntime.appendCanonicalEvents({
        profileId: PROFILE_ID,
        accountPublicKeyHex: ACCOUNT_PUBKEY,
        events: [makeEvent()],
      }),
    ]);

    expect(replaySpy).toHaveBeenCalledTimes(1);
  });
});
