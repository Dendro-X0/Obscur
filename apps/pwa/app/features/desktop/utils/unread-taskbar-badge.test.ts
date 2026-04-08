import { describe, expect, it } from "vitest";
import { unreadTaskbarBadgeInternals } from "./unread-taskbar-badge";

describe("unread-taskbar-badge", () => {
  it("normalizes unread counts to non-negative integers", () => {
    expect(unreadTaskbarBadgeInternals.normalizeUnreadCount(-2)).toBe(0);
    expect(unreadTaskbarBadgeInternals.normalizeUnreadCount(0)).toBe(0);
    expect(unreadTaskbarBadgeInternals.normalizeUnreadCount(4.8)).toBe(4);
    expect(unreadTaskbarBadgeInternals.normalizeUnreadCount(Number.NaN)).toBe(0);
  });

  it("formats badge labels with 99+ overflow", () => {
    expect(unreadTaskbarBadgeInternals.toBadgeDisplayLabel(0)).toBe("");
    expect(unreadTaskbarBadgeInternals.toBadgeDisplayLabel(1)).toBe("1");
    expect(unreadTaskbarBadgeInternals.toBadgeDisplayLabel(99)).toBe("99");
    expect(unreadTaskbarBadgeInternals.toBadgeDisplayLabel(100)).toBe("99+");
  });
});
