import { describe, expect, it } from "vitest";
import { resolveRelayStatusPresentation } from "./relay-status-indicator";

describe("resolveRelayStatusPresentation", () => {
  it("shows degraded when recovery reports degraded readiness and sockets are open", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "degraded",
      phase: "healthy",
      openRelayCount: 1,
      isRecovering: false,
    }).labelFallback).toBe("Degraded");
  });

  it("shows offline when no open sockets and not recovering", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "offline",
      phase: "offline",
      openRelayCount: 0,
      isRecovering: false,
    }).labelFallback).toBe("Offline");
  });

  it("shows offline when writable/healthy recovery claims but open sockets are zero", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "healthy",
      phase: "healthy",
      openRelayCount: 0,
      isRecovering: false,
    }).labelFallback).toBe("Offline");
  });

  it("shows connecting during recovery even with zero open sockets", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "recovering",
      phase: "recovering",
      openRelayCount: 0,
      isRecovering: true,
    }).labelFallback).toBe("Connecting");
  });

  it("shows connected only when at least one socket is open", () => {
    expect(resolveRelayStatusPresentation({
      readiness: "healthy",
      phase: "healthy",
      openRelayCount: 2,
      isRecovering: false,
    }).labelFallback).toBe("Connected");
  });
});
