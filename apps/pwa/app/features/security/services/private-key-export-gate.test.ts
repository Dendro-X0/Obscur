import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isPrivateKeyExportConfirmed,
  PRIVATE_KEY_EXPORT_CONFIRM_TEXT,
  schedulePrivateKeyClipboardClear,
} from "./private-key-export-gate";

describe("private-key-export-gate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires exact export confirm phrase", () => {
    expect(isPrivateKeyExportConfirmed(PRIVATE_KEY_EXPORT_CONFIRM_TEXT)).toBe(true);
    expect(isPrivateKeyExportConfirmed("export key")).toBe(true);
    expect(isPrivateKeyExportConfirmed("EXPORT")).toBe(false);
  });

  it("schedules clipboard clear", () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    const cancel = schedulePrivateKeyClipboardClear(1_000);
    vi.advanceTimersByTime(1_000);
    expect(writeText).toHaveBeenCalledWith("");
    cancel();
  });
});
