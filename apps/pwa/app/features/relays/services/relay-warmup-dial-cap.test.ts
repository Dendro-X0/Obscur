import { beforeEach, describe, expect, it } from "vitest";
import {
  RELAY_WARMUP_PUBLIC_DIAL_CAP,
  clearProcessPublicWarmupDials,
  isPublicDefaultRelayUrl,
  listProcessPublicWarmupDialsForTests,
  partitionWarmupDialUrls,
  releaseProcessPublicWarmupDial,
  shouldAllowRelayDialDuringWarmup,
  tryClaimProcessPublicWarmupDial,
} from "./relay-warmup-dial-cap";

describe("relay-warmup-dial-cap", () => {
  beforeEach(() => {
    clearProcessPublicWarmupDials();
  });

  it("recognizes public Quiet URLs", () => {
    expect(isPublicDefaultRelayUrl("wss://nos.lol")).toBe(true);
    expect(isPublicDefaultRelayUrl("wss://relay.primal.net")).toBe(true);
    expect(isPublicDefaultRelayUrl("ws://localhost:7000")).toBe(false);
  });

  it("dials private first then ≤cap public alongside", () => {
    expect(RELAY_WARMUP_PUBLIC_DIAL_CAP).toBe(2);
    const { immediate, deferredPublic } = partitionWarmupDialUrls([
      "ws://localhost:7000",
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://relay.damus.io",
    ]);
    expect(immediate).toEqual([
      "ws://localhost:7000",
      "wss://nos.lol",
      "wss://relay.primal.net",
    ]);
    expect(deferredPublic).toEqual([]);
  });

  it("caps public-only pool at RELAY_WARMUP_PUBLIC_DIAL_CAP", () => {
    const { immediate, deferredPublic } = partitionWarmupDialUrls([
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://relay.damus.io",
    ]);
    expect(immediate).toEqual(["wss://nos.lol", "wss://relay.primal.net"]);
    expect(deferredPublic).toEqual([]);
  });

  it("always allows private / local relays during warmup", () => {
    expect(
      shouldAllowRelayDialDuringWarmup({
        url: "ws://localhost:7000",
        inFlightPublicDefaultUrls: ["wss://nos.lol", "wss://relay.damus.io"],
        warmupStartedAtUnixMs: 1_000,
        nowUnixMs: 1_500,
      }),
    ).toBe(true);
  });

  it("caps concurrent public Quiet dials during warmup", () => {
    expect(
      shouldAllowRelayDialDuringWarmup({
        url: "wss://relay.damus.io",
        inFlightPublicDefaultUrls: ["wss://nos.lol", "wss://relay.primal.net"],
        warmupStartedAtUnixMs: 1_000,
        nowUnixMs: 1_500,
        publicDialCap: RELAY_WARMUP_PUBLIC_DIAL_CAP,
      }),
    ).toBe(false);
  });

  it("allows a second public Quiet dial under cap=2", () => {
    expect(
      shouldAllowRelayDialDuringWarmup({
        url: "wss://relay.primal.net",
        inFlightPublicDefaultUrls: ["wss://nos.lol"],
        warmupStartedAtUnixMs: 1_000,
        nowUnixMs: 1_500,
      }),
    ).toBe(true);
  });

  it("allows the same in-flight public URL (reuse)", () => {
    expect(
      shouldAllowRelayDialDuringWarmup({
        url: "wss://nos.lol",
        inFlightPublicDefaultUrls: ["wss://nos.lol"],
        warmupStartedAtUnixMs: 1_000,
        nowUnixMs: 1_500,
      }),
    ).toBe(true);
  });

  it("lifts the cap after the warmup window", () => {
    expect(
      shouldAllowRelayDialDuringWarmup({
        url: "wss://relay.primal.net",
        inFlightPublicDefaultUrls: ["wss://nos.lol", "wss://relay.damus.io"],
        warmupStartedAtUnixMs: 1_000,
        nowUnixMs: 1_000 + 60_000,
      }),
    ).toBe(true);
  });

  it("process-wide Quiet claim allows two hosts then refuses a third", () => {
    expect(tryClaimProcessPublicWarmupDial("wss://nos.lol")).toBe(true);
    expect(tryClaimProcessPublicWarmupDial("wss://relay.primal.net")).toBe(true);
    expect(tryClaimProcessPublicWarmupDial("wss://relay.damus.io")).toBe(false);
    expect(listProcessPublicWarmupDialsForTests()).toEqual([
      "wss://nos.lol",
      "wss://relay.primal.net",
    ]);
    releaseProcessPublicWarmupDial("wss://nos.lol");
    expect(tryClaimProcessPublicWarmupDial("wss://relay.damus.io")).toBe(true);
  });

  it("process-wide Quiet claim never blocks private/local dials", () => {
    expect(tryClaimProcessPublicWarmupDial("wss://nos.lol")).toBe(true);
    expect(tryClaimProcessPublicWarmupDial("wss://relay.primal.net")).toBe(true);
    expect(tryClaimProcessPublicWarmupDial("ws://localhost:7000")).toBe(true);
  });
});
