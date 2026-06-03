import { describe, expect, it } from "vitest";
import {
  buildMobileShellStatusItems,
  summarizeMobileShellStatusItems,
  type BuildMobileShellStatusItemsInput,
} from "./mobile-shell-status-items";

function baseInput(
  overrides: Partial<BuildMobileShellStatusItemsInput> = {},
): BuildMobileShellStatusItemsInput {
  return {
    showRestoreProgress: false,
    showMissingSharedDataWarning: false,
    showHistorySyncNotice: false,
    showProjectionScopeMismatchNotice: false,
    ...overrides,
  };
}

describe("buildMobileShellStatusItems", () => {
  it("returns empty when no signals are active", () => {
    expect(buildMobileShellStatusItems(baseInput())).toEqual([]);
  });

  it("orders scope mismatch before restore and relay notices", () => {
    const items = buildMobileShellStatusItems(baseInput({
      showProjectionScopeMismatchNotice: true,
      showRestoreProgress: true,
      restoreMessage: "Restoring profile",
      showHistorySyncNotice: true,
      relayBannerCopy: "Relay transport is offline.",
    }));

    expect(items.map((item) => item.id)).toEqual([
      "profile_scope_mismatch",
      "account_restore_progress",
      "history_sync",
      "relay_transport",
    ]);
  });

  it("includes missing shared data warning", () => {
    const items = buildMobileShellStatusItems(baseInput({
      showMissingSharedDataWarning: true,
    }));
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("restore_missing_shared_data");
  });

  it("suppresses loading notices while account data is loading", () => {
    expect(buildMobileShellStatusItems(baseInput({
      suppressAccountLoadingNotices: true,
      showRestoreProgress: true,
      showHistorySyncNotice: true,
      showMissingSharedDataWarning: true,
      relayBannerCopy: "Relay transport is offline.",
    }))).toEqual([]);
  });
});

describe("summarizeMobileShellStatusItems", () => {
  it("returns null primary for empty list", () => {
    expect(summarizeMobileShellStatusItems([])).toEqual({
      primary: null,
      extraCount: 0,
    });
  });

  it("counts extra items for collapsed strip", () => {
    const items = buildMobileShellStatusItems(baseInput({
      showRestoreProgress: true,
      showHistorySyncNotice: true,
      relayBannerCopy: "Degraded",
    }));
    const summary = summarizeMobileShellStatusItems(items);
    expect(summary.primary?.id).toBe("account_restore_progress");
    expect(summary.extraCount).toBe(2);
  });
});
