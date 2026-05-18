import { describe, expect, it } from "vitest";
import { resolveRelayStatusPresentation } from "./relay-status-indicator";

describe("resolveRelayStatusPresentation", () => {
  it("shows degraded when recovery reports degraded readiness", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "degraded",
      phase: "healthy",
      writableRelayCount: 1,
      isRecovering: false,
    }).labelFallback).toBe("Degraded");
  });

  it("shows offline when no writable relays and not recovering", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "offline",
      phase: "offline",
      writableRelayCount: 0,
      isRecovering: false,
    }).labelFallback).toBe("Offline");
  });

  it("shows connecting during recovery even with zero writable relays", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "recovering",
      phase: "recovering",
      writableRelayCount: 0,
      isRecovering: true,
    }).labelFallback).toBe("Connecting");
  });
});
