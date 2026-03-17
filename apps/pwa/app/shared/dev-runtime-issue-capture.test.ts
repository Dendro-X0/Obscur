import { beforeEach, describe, expect, it, vi } from "vitest";
import { devRuntimeIssueCaptureInternals } from "./dev-runtime-issue-capture";

describe("dev-runtime-issue-capture internals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("detects dev mode flag from legacy and scoped storage keys", () => {
    expect(devRuntimeIssueCaptureInternals.isDevModeStorageEnabled()).toBe(false);

    localStorage.setItem("obscur_dev_mode", "true");
    expect(devRuntimeIssueCaptureInternals.isDevModeStorageEnabled()).toBe(true);

    localStorage.clear();
    localStorage.setItem("profile:abc:obscur_dev_mode", "true");
    expect(devRuntimeIssueCaptureInternals.isDevModeStorageEnabled()).toBe(true);
  });

  it("normalizes unknown error values into readable messages", () => {
    expect(devRuntimeIssueCaptureInternals.normalizeUnknownErrorMessage("boom")).toBe("boom");
    expect(devRuntimeIssueCaptureInternals.normalizeUnknownErrorMessage(42)).toBe("42");
    expect(devRuntimeIssueCaptureInternals.normalizeUnknownErrorMessage(new Error("kaboom"))).toBe("kaboom");
  });

  it("extracts message from ErrorEvent when available", () => {
    const event = new ErrorEvent("error", {
      message: "runtime crashed",
      filename: "app.ts",
      lineno: 12,
    });
    expect(devRuntimeIssueCaptureInternals.getWindowErrorMessage(event)).toBe("runtime crashed");
  });

  it("falls back to embedded error object when message is empty", () => {
    const event = new ErrorEvent("error", {
      message: "",
      error: new Error("fallback message"),
    });
    expect(devRuntimeIssueCaptureInternals.getWindowErrorMessage(event)).toBe("fallback message");
  });

  it("handles circular objects without throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(devRuntimeIssueCaptureInternals.normalizeUnknownErrorMessage(circular)).toBe("Unknown runtime error");
  });
});
