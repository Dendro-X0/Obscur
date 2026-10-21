import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { useEscapeDismissLayer } from "./use-escape-dismiss-layer";

describe("useEscapeDismissLayer", () => {
  it("calls onClose on Escape when enabled", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeDismissLayer({ enabled: true, onClose }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape when blocked", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeDismissLayer({ enabled: true, onClose, blocked: true }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
