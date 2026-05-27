import { describe, expect, it, vi } from "vitest";
import { classifyTransportFailure } from "./transport-connection-problem";

describe("classifyTransportFailure", () => {
  it("returns offline when navigator reports offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const result = classifyTransportFailure(new Error("anything"));
    expect(result.kind).toBe("offline");
    vi.unstubAllGlobals();
  });

  it("classifies relay websocket errors as connection problems", () => {
    const result = classifyTransportFailure(new Error("WebSocket connection to wss://relay failed"));
    expect(result.kind).toBe("connection");
    expect(result.retryable).toBe(true);
  });

  it("classifies timeouts distinctly", () => {
    const result = classifyTransportFailure(new Error("Native command timed out after 5000ms"));
    expect(result.kind).toBe("timeout");
  });
});
